import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller.js';
import { AppController } from './app.controller.js';
import { CatalogService } from './catalog.service.js';

@Module({ controllers: [AppController, AdminController], providers: [CatalogService] })
export class AppModule {}
