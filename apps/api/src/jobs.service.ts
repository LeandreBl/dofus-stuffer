import { HttpException, Inject, Injectable, NotFoundException, ServiceUnavailableException, type OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
import type { Catalog, OptimizationRequest, QueueStatus } from '@dofus/shared';
import { cancellationKey, QUEUE_NAME, RETENTION_SECONDS, tokenKey } from './config.js';
import { RedisService } from './redis.service.js';
import { hashToken, issueToken, validJobId, verifyToken } from './security.js';
import { countStat, isTerminal, readSnapshot, writeSnapshot, type JobSnapshot } from './state.js';
import { CatalogService } from './catalog.service.js';
import { clientId } from './abuse-limits.js';
import { reservationKey, reserveJob } from './job-admission.js';

export interface OptimizationJobData { request: OptimizationRequest; createdAt: string; catalogVersion: string; catalogRevision?: string }

@Injectable()
export class JobsService implements OnModuleDestroy {
  readonly queue: Queue<OptimizationJobData>;

  constructor(@Inject(RedisService) private readonly redis: RedisService, @Inject(CatalogService) private readonly catalog: CatalogService) {
    this.queue = new Queue<OptimizationJobData>(QUEUE_NAME, {
      connection: this.redis.client,
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: { age: RETENTION_SECONDS, count: 500 },
        removeOnFail: { age: RETENTION_SECONDS, count: 500 },
      },
      streams: { events: { maxLen: 1_000 } },
    });
    this.queue.on('error', () => {});
  }

  async onModuleDestroy() { await this.queue.close(); }

  async create(request: OptimizationRequest, catalog: Catalog = this.catalog.data, identity = clientId('127.0.0.1')) {
    const id = randomUUID();
    let admission: number;
    try { admission = await reserveJob(this.redis.client, this.queue, identity, id); }
    catch { throw new ServiceUnavailableException('Le contrôle des recherches est temporairement indisponible.'); }
    if (admission === 1) throw new ServiceUnavailableException('La file de recherche est pleine. Réessayez dans quelques instants.');
    if (admission === 2) throw new HttpException('Maximum trois recherches en attente ou en cours. Terminez ou annulez une recherche.', 429);
    const token = issueToken();
    const now = new Date().toISOString();
    const snapshot: JobSnapshot = {
      id, status: 'queued', createdAt: now, updatedAt: now,
      progress: { percent: 0, evaluated: 0, feasible: 0, elapsedMs: 0, bestScore: null },
      results: [], catalogVersion: catalog.version, catalogRevision: catalog.revision,
      message: 'Recherche en attente d’un moteur disponible.',
    };
    try {
      await this.redis.client.set(tokenKey(id), hashToken(token), 'EX', RETENTION_SECONDS);
      await writeSnapshot(this.redis.client, snapshot);
      await this.queue.add('optimize', { request, createdAt: now, catalogVersion: catalog.version, catalogRevision: catalog.revision }, { jobId: id });
    } catch {
      // A lost Redis response can occur after the job was added. Preserve its slot and receipt in that case.
      let queued: boolean;
      try { queued = Boolean(await this.queue.getJob(id)); }
      catch { throw new ServiceUnavailableException('Le moteur de recherche est temporairement indisponible.'); }
      if (!queued) {
        await writeSnapshot(this.redis.client, { ...snapshot, status: 'failed', message: 'La recherche n’a pas pu être mise en file.' });
        throw new ServiceUnavailableException('Le moteur de recherche est temporairement indisponible.');
      }
    } finally {
      await this.redis.client.zrem(reservationKey(this.queue), id).catch(() => {});
    }
    await countStat(this.redis.client, 'created').catch(() => {});
    return { id, token, status: 'queued' as const };
  }

  async authorize(id: string, token: unknown): Promise<void> {
    if (!validJobId(id)) throw new NotFoundException('Recherche introuvable ou accès expiré.');
    const expectedHash = await this.redis.client.get(tokenKey(id));
    if (!verifyToken(token, expectedHash)) throw new NotFoundException('Recherche introuvable ou accès expiré.');
  }

  async snapshot(id: string, token: unknown): Promise<JobSnapshot> {
    await this.authorize(id, token);
    return this.read(id);
  }

  /** Reads a job the caller has already authorized. */
  async read(id: string): Promise<JobSnapshot> {
    const snapshot = await readSnapshot(this.redis.client, id);
    if (!snapshot) throw new NotFoundException('Recherche introuvable ou accès expiré.');
    // A worker can disappear after writing a running snapshot. BullMQ owns truth for terminal failures.
    if (!isTerminal(snapshot.status)) {
      const job = await this.queue.getJob(id);
      const state = await job?.getState();
      if (state === 'failed') {
        const failed = { ...snapshot, status: 'failed' as const, updatedAt: new Date().toISOString(),
          message: 'La recherche a été interrompue. Relancez-la pour reprendre.', error: 'Le moteur a interrompu cette recherche.' };
        await writeSnapshot(this.redis.client, failed);
        return failed;
      }
    }
    return snapshot;
  }

  async queueStatus(id: string, token: unknown): Promise<QueueStatus> {
    await this.authorize(id, token);
    const paused = await this.queue.isPaused();
    // BullMQ LPUSHes waiting jobs (into `paused` while paused) and workers take from the right: everything to our right is ahead.
    const wait = this.queue.toKey(paused ? 'paused' : 'wait');
    const [replies, workers] = await Promise.all([
      this.redis.client.multi().llen(wait).lpos(wait, id).llen(this.queue.toKey('active')).exec(),
      this.queue.getWorkersCount(),
    ]);
    if (!replies || replies.some(([error]) => error)) throw new ServiceUnavailableException('La file de recherche est temporairement indisponible.');
    const [waiting, index, active] = replies.map(([, value]) => value as number | null);
    return { ahead: index === null ? null : Number(waiting) - 1 - index, waiting: Number(waiting), active: Number(active), workers, paused };
  }

  async cancel(id: string, token: unknown): Promise<JobSnapshot> {
    await this.authorize(id, token);
    return this.stop(id);
  }

  /** Stops a job the caller has already authorized (owner token or admin). */
  async stop(id: string): Promise<JobSnapshot> {
    const snapshot = await this.read(id);
    if (isTerminal(snapshot.status)) return snapshot;
    await this.redis.client.set(cancellationKey(id), '1', 'EX', RETENTION_SECONDS);
    const job = await this.queue.getJob(id);
    if (job) {
      try {
        const state = await job.getState();
        if (state === 'waiting' || state === 'delayed') {
          await job.remove();
          const cancelled = { ...snapshot, status: 'cancelled' as const,
            updatedAt: new Date().toISOString(), message: 'Recherche annulée avant son démarrage.' };
          await writeSnapshot(this.redis.client, cancelled);
          return cancelled;
        }
      } catch {
        // If it became active meanwhile, the worker will observe the cancellation key.
      }
    }
    return { ...snapshot, message: 'Arrêt demandé ; le moteur termine le candidat en cours.' };
  }
}
