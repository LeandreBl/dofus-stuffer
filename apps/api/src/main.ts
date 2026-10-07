import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module.js';

if (process.env.ROLE === 'maintenance') {
  const { startMaintenance } = await import('./maintenance.js');
  await startMaintenance();
} else if (process.env.ROLE === 'worker') {
  const { startWorker } = await import('./worker.js');
  await startWorker();
} else {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  app.useBodyParser('json', { limit: '512kb' });
  app.use(helmet());
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT || 3000), '0.0.0.0');
}
