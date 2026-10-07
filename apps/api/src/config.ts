export const QUEUE_NAME = 'dofus-optimization';
export const UPDATE_CHANNEL = 'dofus:job-updates';
export const RETENTION_SECONDS = 86_400;
export const MAX_QUEUED_JOBS = 100;
export const redisUrl = () => process.env.REDIS_URL || 'redis://127.0.0.1:6379';
export const snapshotKey = (id: string) => `dofus:job:${id}:snapshot`;
export const tokenKey = (id: string) => `dofus:job:${id}:token`;
export const cancellationKey = (id: string) => `dofus:job:${id}:cancel`;
