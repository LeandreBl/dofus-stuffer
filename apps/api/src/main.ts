import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { clientAddress, clientId, consumeRate, proxyTrust, refreshProxyHosts } from './abuse-limits.js';
import { RedisService } from './redis.service.js';

if (process.env.ROLE === 'maintenance') {
  const { startMaintenance } = await import('./maintenance.js');
  await startMaintenance();
} else if (process.env.ROLE === 'worker') {
  const { startWorker } = await import('./worker.js');
  await startWorker();
} else {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  await refreshProxyHosts();
  const refresh = setInterval(() => { void refreshProxyHosts().catch(() => {}); }, 30_000);
  refresh.unref();
  const trusted = (address: string) => proxyTrust()(address);
  app.set('trust proxy', trusted);
  app.use(helmet());
  const redis = app.get(RedisService).client;
  app.use(async (request: Parameters<typeof clientAddress>[0], response: { status: (status: number) => { json: (body: object) => void } }, next: () => void) => {
    try {
      if (!await consumeRate(redis, 'http', clientId(clientAddress(request, trusted)), 240)) {
        response.status(429).json({ message: 'Trop de requêtes. Réessayez dans une minute.' });
        return;
      }
    } catch {
      response.status(503).json({ message: 'Le service est temporairement indisponible.' });
      return;
    }
    next();
  });
  app.useBodyParser('json', { limit: '512kb' });
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT || 3000), '0.0.0.0');
}
