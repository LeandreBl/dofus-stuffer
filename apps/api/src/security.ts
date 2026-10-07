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
