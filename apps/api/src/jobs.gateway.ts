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
import type { IncomingMessage } from 'node:http';
import { clientAddress, clientId, consumeRate } from './abuse-limits.js';
import { admitSocket, allowedOrigin, releaseSocket, renewSocket, type SocketLease } from './socket-security.js';

@WebSocketGateway({
  path: '/socket.io',
  maxHttpBufferSize: 16_384,
  transports: ['websocket', 'polling'],
  serveClient: false,
  connectTimeout: 10_000,
  allowRequest: (request: IncomingMessage, callback: (error: string | null, accepted: boolean) => void) => callback(null, allowedOrigin(request)),
})
export class JobsGateway implements OnGatewayInit, OnModuleDestroy {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(JobsGateway.name);
  private readonly pendingRooms = new WeakMap<Socket, Set<string>>();
  private readonly subscribeUpdates = () => {
    void this.redis.subscriber.subscribe(UPDATE_CHANNEL).catch(() => {
      this.logger.warn('Abonnement Redis indisponible ; nouvelle tentative à la reconnexion.');
    });
  };

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

  afterInit() {
    const leases = new WeakMap<IncomingMessage, SocketLease>();
    this.server.engine.opts.allowRequest = (request, callback) => {
      void admitSocket(this.redis.client, request).then(lease => {
        if (lease) leases.set(request, lease);
        callback(null, Boolean(lease));
      }).catch(() => callback('Connexion temporairement indisponible.', false));
    };
    this.server.engine.on('connection', socket => {
      const lease = leases.get(socket.request);
      if (!lease) { socket.close(true); return; }
      const heartbeat = setInterval(() => {
        void renewSocket(this.redis.client, lease).then(renewed => { if (!renewed) socket.close(true); })
          .catch(() => socket.close(true));
      }, 25_000);
      heartbeat.unref();
      socket.once('close', () => {
        clearInterval(heartbeat);
        void releaseSocket(this.redis.client, lease).catch(() => {});
      });
    });
    this.redis.subscriber.on('message', this.relay);
    this.redis.subscriber.on('ready', this.subscribeUpdates);
    if (this.redis.subscriber.status === 'ready') this.subscribeUpdates();
  }

  async onModuleDestroy() {
    this.redis.subscriber.off('message', this.relay);
    this.redis.subscriber.off('ready', this.subscribeUpdates);
  }

  private async permitEvent(client: Socket): Promise<boolean> {
    const now = Date.now();
    if (now - Number(client.data.windowStart || 0) > 60_000) {
      client.data.windowStart = now;
      client.data.subscriptionAttempts = 0;
    }
    client.data.subscriptionAttempts = Number(client.data.subscriptionAttempts || 0) + 1;
    if (client.data.subscriptionAttempts > 30) return false;
    return consumeRate(this.redis.client, 'socket-events', clientId(clientAddress(client.request)), 60);
  }

  @SubscribeMessage('subscribe')
  async subscribe(@ConnectedSocket() client: Socket, @MessageBody() payload: unknown) {
    let reservedRoom: string | undefined;
    let joinedRoom: string | undefined;
    try {
      if (!await this.permitEvent(client)) return { ok: false, error: 'Trop de demandes de connexion.' };
      if (!payload || typeof payload !== 'object') return { ok: false, error: 'Abonnement invalide.' };
      const { jobId, token } = payload as { jobId?: unknown; token?: unknown };
      if (!validJobId(jobId)) return { ok: false, error: 'Identifiant invalide.' };
      const room = `job:${jobId}`;
      const pending = this.pendingRooms.get(client) || new Set<string>();
      this.pendingRooms.set(client, pending);
      if (pending.has(room)) return { ok: false, error: 'Abonnement déjà en cours.' };
      const followed = new Set([...client.rooms].filter(value => value.startsWith('job:')).concat([...pending]));
      if (!client.rooms.has(room) && followed.size >= 5) {
        return { ok: false, error: 'Maximum cinq recherches suivies simultanément.' };
      }
      pending.add(room);
      reservedRoom = room;
      await this.jobs.authorize(jobId, token);
      if (!client.connected) return { ok: false, error: 'Connexion fermée.' };
      await client.join(room);
      joinedRoom = room;
      // Join before reading so updates occurring during reconnection are not lost.
      const snapshot = await this.jobs.snapshot(jobId, token);
      client.emit('job:update', snapshot);
      return { ok: true, snapshot };
    } catch {
      if (joinedRoom) await client.leave(joinedRoom);
      return { ok: false, error: 'Recherche introuvable ou accès expiré.' };
    } finally {
      if (reservedRoom) this.pendingRooms.get(client)?.delete(reservedRoom);
    }
  }

  @SubscribeMessage('unsubscribe')
  async unsubscribe(@ConnectedSocket() client: Socket, @MessageBody() payload: unknown) {
    try { if (!await this.permitEvent(client)) return { ok: false }; }
    catch { return { ok: false }; }
    if (!payload || typeof payload !== 'object') return { ok: false };
    const { jobId } = payload as { jobId?: unknown };
    if (!validJobId(jobId)) return { ok: false };
    await client.leave(`job:${jobId}`);
    return { ok: true };
  }
}
