import { Hono, type Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { isAddress, isHex } from 'viem';
import { AuthError, loginMessage } from '../auth.ts';
import { PolicyError } from '../policy.ts';
import type { Address, Settings } from '../types.ts';
import type { ApiContext } from './context.ts';

type Env = { Variables: { admin: Address } };

const readJson = async (c: Context): Promise<Record<string, unknown>> => {
  try {
    const body = await c.req.json();
    if (body && typeof body === 'object' && !Array.isArray(body)) return body as Record<string, unknown>;
  } catch {
    // fall through
  }
  throw new HTTPException(400, { message: 'expected a JSON object body' });
};

const SETTING_RULES: Record<keyof Settings, (v: unknown) => boolean> = {
  autoApproveDelaySec: (v) => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 86_400,
  publishIntervalSec: (v) => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 3_600,
  freezeRoots: (v) => typeof v === 'boolean',
};

function parseSettingsPatch(body: Record<string, unknown>): Partial<Settings> {
  const keys = Object.keys(body);
  if (keys.length === 0) throw new HTTPException(400, { message: 'no settings given' });
  for (const key of keys) {
    const rule = SETTING_RULES[key as keyof Settings];
    if (!rule) throw new HTTPException(400, { message: `unknown setting ${key}` });
    if (!rule(body[key])) throw new HTTPException(400, { message: `invalid value for ${key}` });
  }
  return body as Partial<Settings>;
}

export function adminRoutes(ctx: ApiContext): Hono<Env> {
  const app = new Hono<Env>();

  const requireAdmin = createMiddleware<Env>(async (c, next) => {
    const header = c.req.header('Authorization');
    const admin = header?.startsWith('Bearer ') ? ctx.auth.verifyToken(header.slice('Bearer '.length)) : null;
    if (!admin) throw new HTTPException(401, { message: 'admin sign-in required' });
    c.set('admin', admin);
    await next();
  });

  app.post('/admin/nonce', async (c) => {
    const { address } = await readJson(c);
    if (typeof address !== 'string' || !isAddress(address)) throw new HTTPException(400, { message: 'address is required' });
    const nonce = ctx.auth.issueNonce();
    return c.json({ nonce, message: loginMessage(address, nonce) });
  });

  app.post('/admin/login', async (c) => {
    const { address, nonce, signature } = await readJson(c);
    if (typeof address !== 'string' || !isAddress(address) || typeof nonce !== 'string' || typeof signature !== 'string' || !isHex(signature)) {
      throw new HTTPException(400, { message: 'address, nonce and signature are required' });
    }
    try {
      return c.json(await ctx.auth.login(address, nonce, signature));
    } catch (err) {
      if (err instanceof AuthError) throw new HTTPException(401, { message: err.message });
      throw err;
    }
  });

  app.use('/admin/deposits/*', requireAdmin);
  app.use('/admin/settings', requireAdmin);

  app.post('/admin/deposits/:label/:action', (c) => {
    const action = c.req.param('action');
    if (action !== 'approve' && action !== 'decline') throw new HTTPException(404, { message: `unknown action ${action}` });
    const label = c.req.param('label');
    if (!/^[0-9]+$/.test(label)) throw new HTTPException(400, { message: 'label must be a decimal integer' });
    try {
      const decision = ctx.policy.decide(BigInt(label), action === 'approve' ? 'approved' : 'declined', c.get('admin'));
      return c.json({ label, status: decision.status });
    } catch (err) {
      if (err instanceof PolicyError) throw new HTTPException(err.code === 'not_found' ? 404 : 409, { message: err.message });
      throw err;
    }
  });

  app.post('/admin/settings', async (c) => c.json(ctx.store.updateSettings(parseSettingsPatch(await readJson(c)))));

  return app;
}
