import { BadRequestException, Controller, Get, Header, HttpCode, HttpException, Inject, NotFoundException, Param, Post, Query, Req, type OnModuleDestroy } from '@nestjs/common';
import { Queue, type JobType } from 'bullmq';
import type { IncomingMessage } from 'node:http';
import type { JobSnapshot } from '@dofus/shared';
import { CatalogService } from './catalog.service.js';
import { JobsService } from './jobs.service.js';
import { RedisService } from './redis.service.js';
import { clientAddress, clientId, consumeRate } from './abuse-limits.js';
import { adminEnabled, validJobId, verifyAdmin } from './security.js';
import { snapshotKey, statsKey } from './config.js';
import { getMaintenanceStatus, MAINTENANCE_QUEUE } from './maintenance.js';

const JOB_STATES: Record<string, JobType[]> = {
  live: ['active', 'waiting', 'prioritized', 'delayed', 'paused'],
  completed: ['completed'],
  failed: ['failed'],
};
const STATS_DAYS = 30;

@Controller('admin')
export class AdminController implements OnModuleDestroy {
  private readonly maintenance: Queue;

  constructor(@Inject(CatalogService) private readonly catalog: CatalogService, @Inject(RedisService) private readonly redis: RedisService,
    @Inject(JobsService) private readonly jobs: JobsService) {
    this.maintenance = new Queue(MAINTENANCE_QUEUE, { connection: this.redis.client });
    this.maintenance.on('error', () => {});
  }

  async onModuleDestroy() { await this.maintenance.close(); }

  private async guard(request: IncomingMessage) {
    if (!adminEnabled()) throw new NotFoundException();
    if (verifyAdmin(request.headers.authorization)) return;
    // Only failures spend this budget, so a valid token is never locked out by someone else's guesses.
    const allowed = await consumeRate(this.redis.client, 'admin', clientId(clientAddress(request)), 10, 900_000).catch(() => false);
    throw new HttpException(allowed ? 'Jeton administrateur invalide.' : 'Trop de tentatives. Réessayez plus tard.', allowed ? 401 : 429);
  }

  @Get('overview')
  @Header('Cache-Control', 'no-store')
  async overview(@Req() request: IncomingMessage) {
    await this.guard(request);
    const days = Array.from({ length: STATS_DAYS }, (_, index) =>
      new Date(Date.now() - (STATS_DAYS - 1 - index) * 86_400_000).toISOString().slice(0, 10));
    const pipeline = this.redis.client.pipeline();
    for (const day of days) pipeline.hgetall(statsKey(day));
    const [counts, workers, paused, ping, replies] = await Promise.all([
      this.jobs.queue.getJobCounts('active', 'waiting', 'prioritized', 'delayed', 'paused', 'completed', 'failed'),
      this.jobs.queue.getWorkersCount(), this.jobs.queue.isPaused(),
      this.redis.client.ping().catch(() => null), pipeline.exec(),
    ]);
    const stats = days.map((day, index) => {
      const hash = (replies?.[index]?.[1] || {}) as Record<string, string>;
      const value = (field: string) => Number(hash[field] || 0);
      return { day, created: value('created'), completed: value('completed'), cancelled: value('cancelled'),
        failed: value('failed'), computeMs: value('computeMs'), evaluated: value('evaluated') };
    });
    const { version, revision, items, spells, classes, servers } = this.catalog.data;
    return { redis: ping === 'PONG', workers, paused, counts, stats,
      catalog: { version, revision, items: items.length, spells: spells.length, classes: classes.length, servers: servers.length },
      maintenance: getMaintenanceStatus() };
  }

  @Get('jobs')
  @Header('Cache-Control', 'no-store')
  async list(@Req() request: IncomingMessage, @Query('state') state: unknown) {
    await this.guard(request);
    const jobs = (await this.jobs.queue.getJobs(JOB_STATES[String(state)] || JOB_STATES.live, 0, 99)).filter(job => job?.id);
    const raw = jobs.length ? await this.redis.client.mget(jobs.map(job => snapshotKey(job.id!))) : [];
    const classes = new Map(this.catalog.data.classes.map(entry => [entry.id, entry.name]));
    return jobs.map((job, index) => {
      const snapshot = raw[index] ? JSON.parse(raw[index]!) as JobSnapshot : null;
      const input = job.data.request;
      return { id: job.id, status: snapshot?.status || 'unknown', createdAt: job.data.createdAt,
        startedAt: job.processedOn, finishedAt: job.finishedOn,
        className: classes.get(input?.character?.classId) || '—', level: input?.character?.level,
        seconds: input?.seconds, constraints: input?.constraints?.length || 0,
        progress: snapshot?.progress, results: snapshot?.results.length || 0,
        message: snapshot?.error || snapshot?.message || job.failedReason };
    }).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }

  @Post('jobs/:id/cancel')
  @HttpCode(200)
  async cancel(@Req() request: IncomingMessage, @Param('id') id: string) {
    await this.guard(request);
    if (!validJobId(id)) throw new NotFoundException('Recherche introuvable.');
    return this.jobs.stop(id);
  }

  @Post('queue/:action')
  @HttpCode(200)
  async queue(@Req() request: IncomingMessage, @Param('action') action: string) {
    await this.guard(request);
    if (action === 'pause') await this.jobs.queue.pause();
    else if (action === 'resume') await this.jobs.queue.resume();
    else throw new BadRequestException('Action inconnue.');
    return { paused: await this.jobs.queue.isPaused() };
  }

  @Post('maintenance/run')
  @HttpCode(200)
  async runMaintenance(@Req() request: IncomingMessage) {
    await this.guard(request);
    // One id per minute absorbs double clicks; the maintenance worker runs one refresh at a time.
    await this.maintenance.add('admin-refresh', {}, { jobId: `admin-${Math.floor(Date.now() / 60_000)}`, removeOnComplete: 30, removeOnFail: 30 });
    return { queued: true };
  }
}
