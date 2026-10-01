import { Hono, type Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { PoolConfig } from '../types.ts';
import type { ApiContext } from './context.ts';
import { activity, iso, last24h, paginate, parsePaging, poolStats, timeStats, tokenAddr, type PoolData } from './views.ts';

const DECIMAL = /^[0-9]+$/;

export function publicRoutes(ctx: ApiContext): Hono {
  const app = new Hono();

  const requireChain = (c: Context, allowAll = false): void => {
    const id = c.req.param('chainId');
    if (id === String(ctx.chainId) || (allowAll && id === 'all')) return;
    throw new HTTPException(404, { message: `unknown chain ${id}` });
  };
  const requirePool = (c: Context): PoolConfig => {
    requireChain(c);
    const header = c.req.header('X-Pool-Scope');
    if (!header || !DECIMAL.test(header)) throw new HTTPException(400, { message: 'missing or invalid X-Pool-Scope header' });
    const pool = ctx.pools.find((p) => p.scope === BigInt(header));
    if (!pool) throw new HTTPException(404, { message: `unknown pool scope ${header}` });
    return pool;
  };
  const dataFor = (pool: PoolConfig): PoolData => ({
    deposits: ctx.store.listDeposits(pool.scope),
    withdrawals: ctx.store.listWithdrawals(pool.scope),
    ragequits: ctx.store.listRagequits(pool.scope),
    statuses: ctx.policy.statuses(),
  });

  app.get('/:chainId/public/mt-leaves', (c) => {
    const pool = requirePool(c);
    const snapshot = ctx.store.latestConfirmedSnapshot();
    return c.json({
      aspLeaves: (snapshot?.labels ?? []).map(String),
      stateTreeLeaves: ctx.store.listLeaves(pool.scope).map(String),
    });
  });

  app.get('/:chainId/public/mt-roots', async (c) => {
    requireChain(c);
    const snapshot = ctx.store.latestConfirmedSnapshot();
    const onchain = await ctx.publisher.onchainRoot();
    return c.json({
      mtRoot: snapshot ? snapshot.root.toString() : '0',
      createdAt: snapshot ? iso(snapshot.confirmedAt ?? snapshot.createdAt) : null,
      onchainMtRoot: onchain === null ? '0' : onchain.toString(),
    });
  });

  app.get('/:chainId/public/pool-info', (c) => {
    const pool = requirePool(c);
    const data = dataFor(pool);
    const stats = poolStats(pool, ctx.chainId, data);
    return c.json({
      overview: { chainId: ctx.chainId, address: pool.address, token: pool.symbol, tokenAddr: tokenAddr(pool) },
      totalDepositsValue: stats.totalDepositsValue,
      totalInPoolValue: stats.totalInPoolValue,
      acceptedDepositsValue: stats.acceptedDepositsValue,
      totalDepositsCount: stats.totalDepositsCount,
      acceptedDepositsCount: stats.acceptedDepositsCount,
      recentEvents: activity(data.deposits, data.withdrawals, data.ragequits, data.statuses)
        .slice(0, 10)
        .map((i) => i.event),
      growth24h: null,
    });
  });

  // Registered before '/:chainId/public/events': Hono runs routes in registration order, and that one would match
  // chainId 'global' and answer 404 "unknown chain global".
  app.get('/global/public/events', (c) => {
    const { page, perPage } = parsePaging(c.req.query('page'), c.req.query('perPage'));
    const statuses = ctx.policy.statuses();
    const all = activity(ctx.store.listDeposits(), ctx.store.listWithdrawals(), ctx.store.listRagequits(), statuses);
    const result = paginate(all, page, perPage);
    const offset = (page - 1) * perPage;
    return c.json({
      events: result.items.map((item, i) => {
        const pool = ctx.pools.find((p) => p.scope === item.scope) as PoolConfig;
        return {
          ...item.event,
          type: item.event.type === 'exit' ? 'ragequit' : item.event.type,
          eventId: all.length - offset - i,
          ...(item.label === null ? {} : { label: item.label.toString() }),
          pool: {
            scope: pool.scope.toString(),
            chainId: ctx.chainId,
            chainName: 'Sepolia',
            tokenSymbol: pool.symbol,
            tokenAddress: tokenAddr(pool),
            poolAddress: pool.address,
            denomination: String(pool.decimals),
          },
        };
      }),
      page,
      perPage,
      total: result.total,
    });
  });

  app.get('/:chainId/public/events', (c) => {
    const pool = requirePool(c);
    const data = dataFor(pool);
    const { page, perPage } = parsePaging(c.req.query('page'), c.req.query('perPage'));
    const result = paginate(activity(data.deposits, data.withdrawals, data.ragequits, data.statuses), page, perPage);
    return c.json({ events: result.items.map((i) => i.event), page, perPage, total: result.total });
  });

  app.get('/:chainId/public/pools-stats', (c) => {
    requireChain(c, true);
    return c.json({ pools: ctx.pools.map((pool) => poolStats(pool, ctx.chainId, dataFor(pool))) });
  });

  app.get('/:chainId/public/deposit-amounts', (c) => {
    const pool = requirePool(c);
    const statuses = ctx.policy.statuses();
    const amounts = ctx.store
      .listDeposits(pool.scope)
      .filter((d) => statuses.get(d.label.toString()) === 'approved')
      .map((d) => d.value)
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    return c.json({ scope: pool.scope.toString(), amounts: amounts.map(String), totalDeposits: amounts.length, cacheTimestamp: iso(ctx.clock()) });
  });

  app.get('/:chainId/public/pool-statistics', (c) => {
    const pool = requirePool(c);
    const data = dataFor(pool);
    const tvl = BigInt(poolStats(pool, ctx.chainId, data).totalInPoolValue);
    return c.json({
      pool: {
        scope: pool.scope.toString(),
        chainId: String(ctx.chainId),
        tokenSymbol: pool.symbol,
        tokenAddress: tokenAddr(pool),
        tokenDecimals: pool.decimals,
        allTime: timeStats(data, tvl, 0),
        last24h: timeStats(data, tvl, last24h(ctx.clock())),
      },
      cacheTimestamp: iso(ctx.clock()),
    });
  });

  app.get('/global/public/statistics', (c) => {
    const data = { deposits: ctx.store.listDeposits(), withdrawals: ctx.store.listWithdrawals() };
    return c.json({
      allTime: timeStats(data, 0n, 0),
      last24h: timeStats(data, 0n, last24h(ctx.clock())),
      cacheTimestamp: iso(ctx.clock()),
    });
  });

  app.get('/:chainId/public/deposits-by-label', (c) => {
    const pool = requirePool(c);
    const labels = (c.req.header('X-Labels') ?? '').split(',').map((l) => l.trim()).filter((l) => DECIMAL.test(l));
    const statuses = ctx.policy.statuses();
    return c.json(
      labels
        .map((l) => ctx.store.getDeposit(BigInt(l)))
        .filter((d) => d !== null && d.scope === pool.scope)
        .map((d) => {
          const row = d as NonNullable<typeof d>;
          return {
            type: 'deposit',
            amount: row.value.toString(),
            address: row.depositor,
            label: row.label.toString(),
            txHash: row.txHash,
            timestamp: row.timestamp * 1000,
            precommitmentHash: row.precommitment.toString(),
            reviewStatus: statuses.get(row.label.toString()) ?? 'pending',
          };
        }),
    );
  });

  return app;
}
