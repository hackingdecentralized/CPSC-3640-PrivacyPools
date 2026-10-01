import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { getAddress, isAddressEqual, verifyMessage, type Hex } from 'viem';
import type { Store } from './db.ts';
import type { Address, Clock } from './types.ts';

export type AuthDeps = {
  store: Store;
  secret: string;
  admins: Address[];
  clock: Clock;
  nonceTtlSec?: number;
  tokenTtlSec?: number;
};

export class AuthError extends Error {}

export function loginMessage(address: Address, nonce: string): string {
  return `Privacy Pool Teaching ASP: admin sign-in\nAddress: ${getAddress(address)}\nNonce: ${nonce}`;
}

export type Auth = ReturnType<typeof createAuth>;

export function createAuth({ store, secret, admins, clock, nonceTtlSec = 300, tokenTtlSec = 8 * 3600 }: AuthDeps) {
  const mac = (payload: string): string => createHmac('sha256', secret).update(payload).digest('base64url');
  const isAdmin = (address: string): boolean => admins.some((a) => isAddressEqual(a, address as Address));

  return {
    issueNonce(): string {
      const nonce = randomBytes(16).toString('hex');
      store.createNonce(nonce, clock());
      return nonce;
    },

    async login(address: Address, nonce: string, signature: Hex): Promise<{ token: string; expiresAt: number }> {
      if (!isAdmin(address)) throw new AuthError('not an admin address');
      if (!store.consumeNonce(nonce, clock(), nonceTtlSec)) throw new AuthError('invalid or expired nonce');
      const valid = await verifyMessage({ address, message: loginMessage(address, nonce), signature });
      if (!valid) throw new AuthError('bad signature');
      const expiresAt = clock() + tokenTtlSec;
      const payload = Buffer.from(JSON.stringify({ sub: getAddress(address), exp: expiresAt })).toString('base64url');
      return { token: `${payload}.${mac(payload)}`, expiresAt };
    },

    verifyToken(token: string): Address | null {
      const [payload, given] = token.split('.');
      if (!payload || !given) return null;
      const expected = Buffer.from(mac(payload));
      const actual = Buffer.from(given);
      if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
      let claims: { sub?: unknown; exp?: unknown };
      try {
        claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
      } catch {
        return null;
      }
      if (typeof claims.sub !== 'string' || typeof claims.exp !== 'number' || claims.exp <= clock()) return null;
      return isAdmin(claims.sub) ? getAddress(claims.sub) : null;
    },
  };
}
