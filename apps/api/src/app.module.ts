import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { CatalogService } from './catalog.service.js';
import { JobsGateway } from './jobs.gateway.js';
import { JobsService } from './jobs.service.js';
import { RedisService } from './redis.service.js';

@Module({ controllers: [AppController], providers: [RedisService, CatalogService, JobsService, JobsGateway] })
export class AppModule {}
