import { Controller, Get, Header, HttpException, Inject, NotFoundException, Req } from '@nestjs/common';
import type { IncomingMessage } from 'node:http';
import { CatalogService } from './catalog.service.js';
import { clientAddress, clientId, consumeRate } from './abuse-limits.js';
import { adminEnabled, verifyAdmin } from './security.js';

@Controller('admin')
export class AdminController {
  constructor(@Inject(CatalogService) private readonly catalog: CatalogService) {}

  private guard(request: IncomingMessage) {
    if (!adminEnabled()) throw new NotFoundException();
    if (verifyAdmin(request.headers.authorization)) return;
    // Only failures spend this budget, so a valid token is never locked out by someone else's guesses.
    const allowed = consumeRate('admin', clientId(clientAddress(request)), 10, 900_000);
    throw new HttpException(allowed ? 'Jeton administrateur invalide.' : 'Trop de tentatives. Réessayez plus tard.', allowed ? 401 : 429);
  }

  @Get('overview')
  @Header('Cache-Control', 'no-store')
  overview(@Req() request: IncomingMessage) {
    this.guard(request);
    const { version, revision, items, spells, classes, servers } = this.catalog.data;
    return { catalog: { version, revision, items: items.length, spells: spells.length, classes: classes.length, servers: servers.length } };
  }
}
