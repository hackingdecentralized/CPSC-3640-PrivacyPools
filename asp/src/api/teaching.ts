import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { treeView } from '../tree.ts';
import type { ApiContext } from './context.ts';

const DECIMAL = /^[0-9]+$/;

const optionalDecimal = (value: string | undefined, name: string): bigint | undefined => {
  if (value === undefined || value === '') return undefined;
  if (!DECIMAL.test(value)) throw new HTTPException(400, { message: `${name} must be a decimal integer` });
  return BigInt(value);
};

export function teachingRoutes(ctx: ApiContext): Hono {
  const app = new Hono();

  app.get('/teaching/settings', (c) => c.json(ctx.store.getSettings()));

  app.get('/teaching/deposits', (c) => {
    const settings = ctx.store.getSettings();
    const statuses = ctx.policy.statuses();
    const symbols = new Map(ctx.pools.map((p) => [p.scope, p.symbol]));
    return c.json({
      now: ctx.clock(),
      settings,
      deposits: ctx.store
        .listDeposits()
        .reverse()
        .map((d) => ({
          label: d.label.toString(),
          scope: d.scope.toString(),
          pool: d.pool,
          symbol: symbols.get(d.scope) ?? '?',
          depositor: d.depositor,
          value: d.value.toString(),
          commitment: d.commitment.toString(),
          precommitment: d.precommitment.toString(),
          txHash: d.txHash,
          block: d.block,
          timestamp: d.timestamp,
          status: statuses.get(d.label.toString()) ?? 'pending',
          approveAt: d.timestamp + settings.autoApproveDelaySec,
          decisions: ctx.store.decisionHistory(d.label).map(({ status, source, actor, at }) => ({ status, source, actor, at })),
        })),
    });
  });

  app.get('/teaching/snapshots', async (c) => {
    const onchain = await ctx.publisher.onchainRoot();
    return c.json({
      onchainRoot: onchain === null ? null : onchain.toString(),
      snapshots: ctx.store.listSnapshots(50).map((s) => ({
        id: s.id,
        root: s.root.toString(),
        cid: s.cid,
        labels: s.labels.map(String),
        status: s.status,
        txHash: s.txHash,
        block: s.block,
        createdAt: s.createdAt,
        confirmedAt: s.confirmedAt,
        error: s.error,
      })),
    });
  });

  app.get('/teaching/tree', (c) => {
    const scope = optionalDecimal(c.req.query('scope'), 'scope');
    if (scope === undefined) throw new HTTPException(400, { message: 'scope is required' });
    const pool = ctx.pools.find((p) => p.scope === scope);
    if (!pool) throw new HTTPException(404, { message: `unknown pool scope ${scope}` });
    const label = optionalDecimal(c.req.query('label'), 'label');
    const commitment = optionalDecimal(c.req.query('commitment'), 'commitment') ?? (label === undefined ? undefined : ctx.store.getDeposit(label)?.commitment);
    const snapshot = ctx.store.latestConfirmedSnapshot();
    return c.json({
      asp: treeView(snapshot?.labels ?? [], label),
      state: treeView(ctx.store.listLeaves(pool.scope), commitment),
    });
  });

  app.get('/snapshots/:cid', (c) => {
    const snapshot = ctx.store.snapshotByCid(c.req.param('cid'));
    if (!snapshot) throw new HTTPException(404, { message: 'unknown snapshot' });
    return c.body(snapshot.document, 200, { 'Content-Type': 'application/json' });
  });

  return app;
}
