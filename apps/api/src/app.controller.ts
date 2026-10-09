import { Controller, Get, Header, Inject } from '@nestjs/common';
import { CatalogService } from './catalog.service.js';

@Controller()
export class AppController {
  constructor(@Inject(CatalogService) private readonly catalog: CatalogService) {}

  @Get('health')
  @Header('Cache-Control', 'no-store')
  health() {
    const { version, items, spells } = this.catalog.data;
    return { status: 'ok', catalogVersion: version, items: items.length, spells: spells.length };
  }

  @Get('catalog')
  @Header('Cache-Control', 'no-cache')
  catalogData() { return this.catalog.data; }
}
