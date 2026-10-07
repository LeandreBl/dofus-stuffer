import type { Redis } from 'ioredis';
import type { JobSnapshot } from '@dofus/shared';
import { RETENTION_SECONDS, UPDATE_CHANNEL, snapshotKey } from './config.js';

export type { JobSnapshot } from '@dofus/shared';
export type JobStatus = JobSnapshot['status'];

export const isTerminal = (status: JobStatus) => ['completed', 'cancelled', 'failed'].includes(status);

export async function readSnapshot(redis: Redis, id: string): Promise<JobSnapshot | null> {
  const raw = await redis.get(snapshotKey(id));
  return raw ? JSON.parse(raw) as JobSnapshot : null;
}

export async function writeSnapshot(redis: Redis, snapshot: JobSnapshot): Promise<void> {
  const payload = JSON.stringify(snapshot);
  const replies = await redis.multi()
    .set(snapshotKey(snapshot.id), payload, 'EX', RETENTION_SECONDS)
    .publish(UPDATE_CHANNEL, payload)
    .exec();
  if (!replies || replies.some(([error]) => error)) throw new Error('Impossible de sauvegarder la progression dans Redis.');
}
