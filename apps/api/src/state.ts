import type { Redis } from 'ioredis';
import type { JobSnapshot } from '@dofus/shared';
import { RETENTION_SECONDS, STATS_RETENTION_SECONDS, UPDATE_CHANNEL, snapshotKey, statsKey } from './config.js';
import { ownerKey, RELEASE_SCRIPT } from './job-admission.js';

export type { JobSnapshot } from '@dofus/shared';
export type JobStatus = JobSnapshot['status'];

export const isTerminal = (status: JobStatus) => ['completed', 'cancelled', 'failed'].includes(status);

export async function readSnapshot(redis: Redis, id: string): Promise<JobSnapshot | null> {
  const raw = await redis.get(snapshotKey(id));
  return raw ? JSON.parse(raw) as JobSnapshot : null;
}

export async function writeSnapshot(redis: Redis, snapshot: JobSnapshot): Promise<void> {
  const payload = JSON.stringify(snapshot);
  const transaction = redis.multi()
    .set(snapshotKey(snapshot.id), payload, 'EX', RETENTION_SECONDS)
    .publish(UPDATE_CHANNEL, payload);
  if (isTerminal(snapshot.status)) {
    transaction.eval(RELEASE_SCRIPT, 1, ownerKey(snapshot.id), 'dofus:security:active:', snapshot.id);
    const key = statsKey(new Date().toISOString().slice(0, 10));
    transaction.hincrby(key, snapshot.status, 1).hincrby(key, 'computeMs', Math.round(snapshot.progress.elapsedMs))
      .hincrby(key, 'evaluated', Math.round(snapshot.progress.evaluated)).expire(key, STATS_RETENTION_SECONDS);
  }
  const replies = await transaction.exec();
  if (!replies || replies.some(([error]) => error)) throw new Error('Impossible de sauvegarder la progression dans Redis.');
}

export async function countStat(redis: Redis, field: string): Promise<void> {
  const key = statsKey(new Date().toISOString().slice(0, 10));
  await redis.multi().hincrby(key, field, 1).expire(key, STATS_RETENTION_SECONDS).exec();
}
