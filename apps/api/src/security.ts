import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export function issueToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function verifyToken(token: unknown, expectedHash: string | null): boolean {
  if (typeof token !== 'string' || token.length !== 43 || !/^[A-Za-z0-9_-]+$/.test(token)
    || !expectedHash || !/^[a-f0-9]{64}$/.test(expectedHash)) return false;
  return timingSafeEqual(Buffer.from(hashToken(token), 'hex'), Buffer.from(expectedHash, 'hex'));
}

export function validJobId(id: unknown): id is string {
  return typeof id === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id);
}

export function bearerToken(authorization: unknown): string | undefined {
  return typeof authorization === 'string' ? /^Bearer ([A-Za-z0-9_-]{43})$/i.exec(authorization)?.[1] : undefined;
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
