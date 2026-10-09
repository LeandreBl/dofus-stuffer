import { createHash, timingSafeEqual } from 'node:crypto';

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Admin access is off unless ADMIN_TOKEN holds a long random secret. */
export function adminEnabled(): boolean {
  return (process.env.ADMIN_TOKEN || '').length >= 32;
}

export function verifyAdmin(authorization: unknown): boolean {
  const given = typeof authorization === 'string' ? /^Bearer (\S{1,512})$/.exec(authorization)?.[1] : undefined;
  if (!given || !adminEnabled()) return false;
  return timingSafeEqual(Buffer.from(hashToken(given), 'hex'), Buffer.from(hashToken(process.env.ADMIN_TOKEN!), 'hex'));
}
