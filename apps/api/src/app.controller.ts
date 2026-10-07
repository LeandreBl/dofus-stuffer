import { Body, Controller, Get, Header, Headers, HttpCode, HttpException, Inject, Param, Post, Query, Req, ServiceUnavailableException } from '@nestjs/common';
import { CatalogService } from './catalog.service.js';
import { JobsService } from './jobs.service.js';
import { RedisService } from './redis.service.js';
import { validateRequest } from './validation.js';
import { getMaintenanceStatus, getServerPrices } from './maintenance.js';
import { clientAddress, clientId, consumeRate } from './abuse-limits.js';
import type { IncomingMessage } from 'node:http';
import { bearerToken } from './security.js';

@Controller()
export class AppController {
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
  async create(@Body() body: unknown, @Req() request: IncomingMessage) {
    const identity = clientId(clientAddress(request));
    let permitted: boolean;
    try { permitted = await consumeRate(this.redis.client, 'create', identity, 20); }
    catch { throw new ServiceUnavailableException('Le contrôle des recherches est temporairement indisponible.'); }
    if (!permitted) throw new HttpException('Trop de recherches. Réessayez dans une minute.', 429);
    const catalog = this.catalog.data;
    const input = validateRequest(body, catalog);
    try { permitted = await consumeRate(this.redis.client, 'compute', identity, 1_800, 600_000, input.seconds); }
    catch { throw new ServiceUnavailableException('Le contrôle des recherches est temporairement indisponible.'); }
    if (!permitted) throw new HttpException('Budget de calcul atteint. Réessayez dans quelques minutes.', 429);
    return this.jobs.create(input, catalog, identity);
  }

  @Get('jobs/:id')
  @Header('Cache-Control', 'no-store')
  snapshot(@Param('id') id: string, @Headers('authorization') authorization: unknown) { return this.jobs.snapshot(id, bearerToken(authorization)); }

  @Post('jobs/:id/cancel')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  cancel(@Param('id') id: string, @Body() body: unknown, @Headers('authorization') authorization: unknown) {
    const token = body && typeof body === 'object' ? (body as { token?: unknown }).token : undefined;
    return this.jobs.cancel(id, bearerToken(authorization) || token);
  }
}
