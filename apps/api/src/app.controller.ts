import { Body, Controller, Get, Header, HttpCode, HttpException, Inject, Param, Post, Query, Req, ServiceUnavailableException } from '@nestjs/common';
import { CatalogService } from './catalog.service.js';
import { JobsService } from './jobs.service.js';
import { RedisService } from './redis.service.js';
import { validateRequest } from './validation.js';
import { getMaintenanceStatus, getServerPrices } from './maintenance.js';

@Controller()
export class AppController {
  private readonly requestWindows = new Map<string, { since: number; count: number }>();

  constructor(@Inject(CatalogService) private readonly catalog: CatalogService, @Inject(RedisService) private readonly redis: RedisService,
    @Inject(JobsService) private readonly jobs: JobsService) {}

  @Get('health')
  @Header('Cache-Control', 'no-store')
  async health() {
    try {
      const ping = await this.redis.client.ping();
      const workers = await this.jobs.queue.getWorkersCount();
      return { status: ping === 'PONG' ? 'ok' : 'degraded', redis: ping === 'PONG', workers,
        catalogVersion: this.catalog.data.version, items: this.catalog.data.items.length, spells: this.catalog.data.spells.length };
    } catch { throw new ServiceUnavailableException({ status: 'unavailable', redis: false }); }
  }

  @Get('catalog')
  @Header('Cache-Control', 'no-cache')
  catalogData() { return this.catalog.data; }

  @Get('maintenance')
  @Header('Cache-Control', 'no-store')
  maintenance() { return getMaintenanceStatus(); }

  @Get('prices')
  @Header('Cache-Control', 'no-store')
  prices(@Query('server') server: unknown) {
    const catalog = this.catalog.data;
    if (typeof server !== 'string' || !catalog.servers.includes(server)) throw new HttpException('Serveur inconnu.', 400);
    const prices = getServerPrices(server), ids = new Set(catalog.items.map(item => String(item.id)));
    prices.values = Object.fromEntries(Object.entries(prices.values).filter(([id]) => ids.has(id)));
    return prices;
  }

  @Post('jobs')
  @Header('Cache-Control', 'no-store')
  async create(@Body() body: unknown, @Req() request: { ip?: string }) {
    const now = Date.now();
    for (const [key, value] of this.requestWindows) if (now - value.since > 60_000) this.requestWindows.delete(key);
    const key = request.ip || 'local';
    const bucket = this.requestWindows.get(key) || { since: now, count: 0 };
    if (bucket.count >= 20 || this.requestWindows.size > 10_000) throw new HttpException('Trop de recherches. Réessayez dans une minute.', 429);
    bucket.count += 1;
    this.requestWindows.set(key, bucket);
    const catalog = this.catalog.data;
    return this.jobs.create(validateRequest(body, catalog), catalog);
  }

  @Get('jobs/:id')
  @Header('Cache-Control', 'no-store')
  snapshot(@Param('id') id: string, @Query('token') token: unknown) { return this.jobs.snapshot(id, token); }

  @Post('jobs/:id/cancel')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  cancel(@Param('id') id: string, @Body() body: unknown, @Query('token') queryToken?: unknown) {
    const token = body && typeof body === 'object' ? (body as { token?: unknown }).token : undefined;
    return this.jobs.cancel(id, token || queryToken);
  }
}
