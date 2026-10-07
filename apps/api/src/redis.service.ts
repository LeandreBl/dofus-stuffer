import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { redisUrl } from './config.js';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  readonly client = new Redis(redisUrl(), { maxRetriesPerRequest: 2, connectTimeout: 5_000 });
  readonly subscriber = new Redis(redisUrl(), { maxRetriesPerRequest: null, connectTimeout: 5_000 });

  constructor() {
    for (const connection of [this.client, this.subscriber]) {
      connection.on('error', () => this.logger.warn('Connexion Redis indisponible ; reconnexion automatique.'));
    }
  }

  async onModuleDestroy() {
    await Promise.allSettled([this.client.quit(), this.subscriber.quit()]);
  }
}
