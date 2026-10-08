export const QUEUE_NAME = 'dofus-optimization';
export const UPDATE_CHANNEL = 'dofus:job-updates';
export const RETENTION_SECONDS = 86_400;
export const MAX_QUEUED_JOBS = 100;
export const redisUrl = () => {
  const url = new URL(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
  if (process.env.REDIS_PASSWORD) url.password = process.env.REDIS_PASSWORD;
  return url.href;
};
export const snapshotKey = (id: string) => `dofus:job:${id}:snapshot`;
export const tokenKey = (id: string) => `dofus:job:${id}:token`;
export const cancellationKey = (id: string) => `dofus:job:${id}:cancel`;
export const STATS_RETENTION_SECONDS = 90 * 86_400;
/** One hash per UTC day: created/completed/cancelled/failed counters plus summed compute. */
export const statsKey = (day: string) => `dofus:stats:${day}`;
