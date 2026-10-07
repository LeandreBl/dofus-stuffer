import { Inject, Injectable, NotFoundException, ServiceUnavailableException, type OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
import type { Catalog, OptimizationRequest } from '@dofus/shared';
import { cancellationKey, MAX_QUEUED_JOBS, QUEUE_NAME, RETENTION_SECONDS, tokenKey } from './config.js';
import { RedisService } from './redis.service.js';
import { hashToken, issueToken, validJobId, verifyToken } from './security.js';
import { isTerminal, readSnapshot, writeSnapshot, type JobSnapshot } from './state.js';
import { CatalogService } from './catalog.service.js';

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

  async create(request: OptimizationRequest, catalog: Catalog = this.catalog.data) {
    const counts = await this.queue.getJobCounts('wait', 'active', 'delayed');
    if ((counts.wait || 0) + (counts.active || 0) + (counts.delayed || 0) >= MAX_QUEUED_JOBS) {
      throw new ServiceUnavailableException('La file de recherche est pleine. Réessayez dans quelques instants.');
    }
    const id = randomUUID();
    const token = issueToken();
    const now = new Date().toISOString();
    const snapshot: JobSnapshot = {
      id, status: 'queued', createdAt: now, updatedAt: now,
      progress: { percent: 0, evaluated: 0, feasible: 0, elapsedMs: 0, bestScore: null },
      results: [], catalogVersion: catalog.version, catalogRevision: catalog.revision,
      message: 'Recherche en attente d’un moteur disponible.',
    };
    await this.redis.client.set(tokenKey(id), hashToken(token), 'EX', RETENTION_SECONDS);
    await writeSnapshot(this.redis.client, snapshot);
    try {
      await this.queue.add('optimize', { request, createdAt: now, catalogVersion: catalog.version, catalogRevision: catalog.revision }, { jobId: id });
    } catch {
      await writeSnapshot(this.redis.client, { ...snapshot, status: 'failed', message: 'La recherche n’a pas pu être mise en file.' });
      throw new ServiceUnavailableException('Le moteur de recherche est temporairement indisponible.');
    }
    return { id, token, status: 'queued' as const };
  }

  async authorize(id: string, token: unknown): Promise<void> {
    if (!validJobId(id)) throw new NotFoundException('Recherche introuvable ou accès expiré.');
    const expectedHash = await this.redis.client.get(tokenKey(id));
    if (!verifyToken(token, expectedHash)) throw new NotFoundException('Recherche introuvable ou accès expiré.');
  }

  async snapshot(id: string, token: unknown): Promise<JobSnapshot> {
    await this.authorize(id, token);
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

  async cancel(id: string, token: unknown): Promise<JobSnapshot> {
    const snapshot = await this.snapshot(id, token);
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
