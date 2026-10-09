import { Controller, Get, Header, HttpCode, HttpException, Inject, NotFoundException, Post, Req, type OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import type { IncomingMessage } from 'node:http';
import { CatalogService } from './catalog.service.js';
import { RedisService } from './redis.service.js';
import { clientAddress, clientId, consumeRate } from './abuse-limits.js';
import { adminEnabled, verifyAdmin } from './security.js';
import { getMaintenanceStatus, MAINTENANCE_QUEUE } from './maintenance.js';

@Controller('admin')
export class AdminController implements OnModuleDestroy {
  private readonly maintenance: Queue;

  constructor(@Inject(CatalogService) private readonly catalog: CatalogService, @Inject(RedisService) private readonly redis: RedisService) {
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
    const ping = await this.redis.client.ping().catch(() => null);
    const { version, revision, items, spells, classes, servers } = this.catalog.data;
    return { redis: ping === 'PONG',
      catalog: { version, revision, items: items.length, spells: spells.length, classes: classes.length, servers: servers.length },
      maintenance: getMaintenanceStatus() };
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
