import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { serve } from '@hono/node-server';
import { createAsp } from './asp.ts';
import { parseConfig } from './config.ts';

const cfg = parseConfig(process.env);
const clock = () => Math.floor(Date.now() / 1000);
if (cfg.dbPath !== ':memory:') mkdirSync(dirname(cfg.dbPath), { recursive: true });

const asp = createAsp(cfg, clock);
await asp.publisher.reconcile();

const server = serve({ fetch: asp.app.fetch, port: cfg.port }, (info) => {
  console.log(`Teaching ASP for chain ${cfg.chainId} listening on :${info.port}`);
});

let stopping = false;
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    stopping = true;
    server.close();
    asp.store.close();
    process.exit(0);
  });
}

while (!stopping) {
  try {
    await asp.tickOnce();
  } catch (err) {
    console.error('ASP tick failed:', err);
  }
  await sleep(cfg.pollIntervalMs);
}
