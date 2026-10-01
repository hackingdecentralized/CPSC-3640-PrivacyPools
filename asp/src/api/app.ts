import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { adminRoutes } from './admin.ts';
import type { ApiContext } from './context.ts';
import { publicRoutes } from './public.ts';
import { teachingRoutes } from './teaching.ts';

export function createApp(ctx: ApiContext): Hono {
  const app = new Hono();

  app.use(
    '*',
    cors({
      origin: ctx.corsOrigins === '*' ? '*' : ctx.corsOrigins,
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization', 'X-Pool-Scope', 'X-Labels'],
      maxAge: 600,
    }),
  );

  app.get('/health', (c) => c.json({ ok: true, chainId: ctx.chainId, ...ctx.health }));
  app.route('/', publicRoutes(ctx));
  app.route('/', teachingRoutes(ctx));
  app.route('/', adminRoutes(ctx));

  app.notFound((c) => c.json({ error: 'not found' }, 404));
  app.onError((err, c) => {
    if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
    console.error(err);
    return c.json({ error: 'internal error' }, 500);
  });

  return app;
}
