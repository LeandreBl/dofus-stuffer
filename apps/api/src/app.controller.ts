import { Controller, Get, Header, HttpException, Inject, Query, ServiceUnavailableException } from '@nestjs/common';
import { CatalogService } from './catalog.service.js';
import { RedisService } from './redis.service.js';
import { getMaintenanceStatus, getServerPrices } from './maintenance.js';

@Controller()
export class AppController {
  constructor(@Inject(CatalogService) private readonly catalog: CatalogService, @Inject(RedisService) private readonly redis: RedisService) {}

  @Get('health')
  @Header('Cache-Control', 'no-store')
  async health() {
    try {
      const ping = await this.redis.client.ping();
      return { status: ping === 'PONG' ? 'ok' : 'degraded', redis: ping === 'PONG',
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
}
