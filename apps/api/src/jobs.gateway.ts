import { Inject, Logger, type OnModuleDestroy } from '@nestjs/common';
import {
  ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer,
  type OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UPDATE_CHANNEL } from './config.js';
import { JobsService } from './jobs.service.js';
import { RedisService } from './redis.service.js';
import { validJobId } from './security.js';
import type { JobSnapshot } from './state.js';

@WebSocketGateway({
  path: '/socket.io',
  maxHttpBufferSize: 16_384,
  transports: ['websocket', 'polling'],
})
export class JobsGateway implements OnGatewayInit, OnModuleDestroy {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(JobsGateway.name);

  constructor(@Inject(RedisService) private readonly redis: RedisService, @Inject(JobsService) private readonly jobs: JobsService) {}

  private readonly relay = (channel: string, payload: string) => {
    if (channel !== UPDATE_CHANNEL) return;
    try {
      const snapshot = JSON.parse(payload) as JobSnapshot;
      if (validJobId(snapshot.id)) this.server.to(`job:${snapshot.id}`).emit('job:update', snapshot);
    } catch {
      this.logger.warn('Message de progression Redis invalide ignoré.');
    }
  };

  async afterInit() {
    this.redis.subscriber.on('message', this.relay);
    await this.redis.subscriber.subscribe(UPDATE_CHANNEL);
  }

  async onModuleDestroy() {
    this.redis.subscriber.off('message', this.relay);
  }

  @SubscribeMessage('subscribe')
  async subscribe(@ConnectedSocket() client: Socket, @MessageBody() payload: unknown) {
    try {
      const now = Date.now();
      const windowStart = Number(client.data.windowStart || 0);
      if (now - windowStart > 60_000) {
        client.data.windowStart = now;
        client.data.subscriptionAttempts = 0;
      }
      client.data.subscriptionAttempts = Number(client.data.subscriptionAttempts || 0) + 1;
      if (client.data.subscriptionAttempts > 30) return { ok: false, error: 'Trop de demandes de connexion.' };
      if (!payload || typeof payload !== 'object') return { ok: false, error: 'Abonnement invalide.' };
      const { jobId, token } = payload as { jobId?: unknown; token?: unknown };
      if (!validJobId(jobId)) return { ok: false, error: 'Identifiant invalide.' };
      if (!client.rooms.has(`job:${jobId}`) && client.rooms.size >= 6) {
        return { ok: false, error: 'Maximum cinq recherches suivies simultanément.' };
      }
      await this.jobs.authorize(jobId, token);
      await client.join(`job:${jobId}`);
      // Join before reading so updates occurring during reconnection are not lost.
      const snapshot = await this.jobs.snapshot(jobId, token);
      client.emit('job:update', snapshot);
      return { ok: true, snapshot };
    } catch {
      return { ok: false, error: 'Recherche introuvable ou accès expiré.' };
    }
  }

  @SubscribeMessage('unsubscribe')
  async unsubscribe(@ConnectedSocket() client: Socket, @MessageBody() payload: unknown) {
    if (!payload || typeof payload !== 'object') return { ok: false };
    const { jobId } = payload as { jobId?: unknown };
    if (!validJobId(jobId)) return { ok: false };
    await client.leave(`job:${jobId}`);
    return { ok: true };
  }
}
