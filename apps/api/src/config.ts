export const redisUrl = () => {
  const url = new URL(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
  if (process.env.REDIS_PASSWORD) url.password = process.env.REDIS_PASSWORD;
  return url.href;
};
