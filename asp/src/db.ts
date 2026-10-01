import { DatabaseSync } from 'node:sqlite';
import type {
  Address,
  DecisionRow,
  DecisionStatus,
  DepositRow,
  Hash,
  LeafRow,
  RagequitRow,
  Settings,
  SnapshotRow,
  SnapshotStatus,
  WithdrawalRow,
} from './types.ts';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS cursors (pool TEXT PRIMARY KEY, block INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS deposits (
  label TEXT PRIMARY KEY, scope TEXT NOT NULL, pool TEXT NOT NULL, depositor TEXT NOT NULL,
  commitment TEXT NOT NULL, value TEXT NOT NULL, precommitment TEXT NOT NULL,
  block INTEGER NOT NULL, log_index INTEGER NOT NULL, tx_hash TEXT NOT NULL, timestamp INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS leaves (
  scope TEXT NOT NULL, idx INTEGER NOT NULL, leaf TEXT NOT NULL, root TEXT NOT NULL, block INTEGER NOT NULL,
  PRIMARY KEY (scope, idx)
);
CREATE TABLE IF NOT EXISTS withdrawals (
  tx_hash TEXT NOT NULL, log_index INTEGER NOT NULL, scope TEXT NOT NULL, processooor TEXT NOT NULL,
  value TEXT NOT NULL, spent_nullifier TEXT NOT NULL, new_commitment TEXT NOT NULL,
  block INTEGER NOT NULL, timestamp INTEGER NOT NULL,
  PRIMARY KEY (tx_hash, log_index)
);
CREATE TABLE IF NOT EXISTS ragequits (
  label TEXT PRIMARY KEY, scope TEXT NOT NULL, ragequitter TEXT NOT NULL, commitment TEXT NOT NULL,
  value TEXT NOT NULL, block INTEGER NOT NULL, log_index INTEGER NOT NULL, tx_hash TEXT NOT NULL, timestamp INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT, label TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('approved', 'declined')),
  source TEXT NOT NULL CHECK (source IN ('auto', 'admin')),
  actor TEXT, at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS decisions_by_label ON decisions (label, id);
CREATE TABLE IF NOT EXISTS snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT, root TEXT NOT NULL, cid TEXT NOT NULL, document TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'failed')),
  tx_hash TEXT, block INTEGER, confirmed_at INTEGER, error TEXT
);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS nonces (nonce TEXT PRIMARY KEY, issued_at INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0);
`;

type Value = string | number | null;
type Row = Record<string, Value>;

const str = (v: Value): string => v as string;
const num = (v: Value): number => v as number;

const toDeposit = (r: Row): DepositRow => ({
  label: BigInt(str(r.label)),
  scope: BigInt(str(r.scope)),
  pool: str(r.pool) as Address,
  depositor: str(r.depositor) as Address,
  commitment: BigInt(str(r.commitment)),
  value: BigInt(str(r.value)),
  precommitment: BigInt(str(r.precommitment)),
  block: num(r.block),
  logIndex: num(r.log_index),
  txHash: str(r.tx_hash) as Hash,
  timestamp: num(r.timestamp),
});

const toWithdrawal = (r: Row): WithdrawalRow => ({
  scope: BigInt(str(r.scope)),
  processooor: str(r.processooor) as Address,
  value: BigInt(str(r.value)),
  spentNullifier: BigInt(str(r.spent_nullifier)),
  newCommitment: BigInt(str(r.new_commitment)),
  block: num(r.block),
  logIndex: num(r.log_index),
  txHash: str(r.tx_hash) as Hash,
  timestamp: num(r.timestamp),
});

const toRagequit = (r: Row): RagequitRow => ({
  label: BigInt(str(r.label)),
  scope: BigInt(str(r.scope)),
  ragequitter: str(r.ragequitter) as Address,
  commitment: BigInt(str(r.commitment)),
  value: BigInt(str(r.value)),
  block: num(r.block),
  logIndex: num(r.log_index),
  txHash: str(r.tx_hash) as Hash,
  timestamp: num(r.timestamp),
});

const toDecision = (r: Row): DecisionRow => ({
  label: BigInt(str(r.label)),
  status: str(r.status) as DecisionStatus,
  source: str(r.source) as DecisionRow['source'],
  actor: r.actor === null ? null : (str(r.actor) as Address),
  at: num(r.at),
});

const toSnapshot = (r: Row): SnapshotRow => {
  const document = str(r.document);
  return {
    id: num(r.id),
    root: BigInt(str(r.root)),
    cid: str(r.cid),
    document,
    labels: (JSON.parse(document).labels as string[]).map((l) => BigInt(l)),
    createdAt: num(r.created_at),
    status: str(r.status) as SnapshotStatus,
    txHash: r.tx_hash === null ? null : (str(r.tx_hash) as Hash),
    block: r.block === null ? null : num(r.block),
    confirmedAt: r.confirmed_at === null ? null : num(r.confirmed_at),
    error: r.error === null ? null : str(r.error),
  };
};

export type Store = ReturnType<typeof openStore>;

export function openStore(path: string, defaults: Settings) {
  const db = new DatabaseSync(path);
  db.exec(SCHEMA);

  const all = (sql: string, ...params: Value[]): Row[] => db.prepare(sql).all(...params) as Row[];
  const one = (sql: string, ...params: Value[]): Row | null => (db.prepare(sql).get(...params) as Row | undefined) ?? null;
  const run = (sql: string, ...params: Value[]): number => Number(db.prepare(sql).run(...params).lastInsertRowid);
  const byScope = (table: string, order: string, scope?: bigint): Row[] =>
    scope === undefined
      ? all(`SELECT * FROM ${table} ORDER BY ${order}`)
      : all(`SELECT * FROM ${table} WHERE scope = ? ORDER BY ${order}`, scope.toString());

  const storedOverrides = (): Partial<Settings> => JSON.parse(str(one('SELECT value FROM settings WHERE key = ?', 'overrides')?.value ?? '{}'));

  return {
    transaction<T>(fn: () => T): T {
      db.exec('BEGIN');
      try {
        const result = fn();
        db.exec('COMMIT');
        return result;
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    },

    getCursor(pool: Address): number | null {
      const row = one('SELECT block FROM cursors WHERE pool = ?', pool);
      return row ? num(row.block) : null;
    },
    setCursor(pool: Address, block: number): void {
      run('INSERT INTO cursors (pool, block) VALUES (?, ?) ON CONFLICT (pool) DO UPDATE SET block = excluded.block', pool, block);
    },

    insertDeposit(d: DepositRow): void {
      run(
        `INSERT OR IGNORE INTO deposits (label, scope, pool, depositor, commitment, value, precommitment, block, log_index, tx_hash, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        d.label.toString(), d.scope.toString(), d.pool, d.depositor, d.commitment.toString(), d.value.toString(),
        d.precommitment.toString(), d.block, d.logIndex, d.txHash, d.timestamp,
      );
    },
    insertLeaf(l: LeafRow): void {
      run('INSERT OR IGNORE INTO leaves (scope, idx, leaf, root, block) VALUES (?, ?, ?, ?, ?)', l.scope.toString(), l.index, l.leaf.toString(), l.root.toString(), l.block);
    },
    insertWithdrawal(w: WithdrawalRow): void {
      run(
        `INSERT OR IGNORE INTO withdrawals (tx_hash, log_index, scope, processooor, value, spent_nullifier, new_commitment, block, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        w.txHash, w.logIndex, w.scope.toString(), w.processooor, w.value.toString(), w.spentNullifier.toString(),
        w.newCommitment.toString(), w.block, w.timestamp,
      );
    },
    insertRagequit(r: RagequitRow): void {
      run(
        `INSERT OR IGNORE INTO ragequits (label, scope, ragequitter, commitment, value, block, log_index, tx_hash, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        r.label.toString(), r.scope.toString(), r.ragequitter, r.commitment.toString(), r.value.toString(),
        r.block, r.logIndex, r.txHash, r.timestamp,
      );
    },

    listDeposits(scope?: bigint): DepositRow[] {
      return byScope('deposits', 'block, log_index', scope).map(toDeposit);
    },
    getDeposit(label: bigint): DepositRow | null {
      const row = one('SELECT * FROM deposits WHERE label = ?', label.toString());
      return row ? toDeposit(row) : null;
    },
    listLeaves(scope: bigint): bigint[] {
      return all('SELECT leaf FROM leaves WHERE scope = ? ORDER BY idx', scope.toString()).map((r) => BigInt(str(r.leaf)));
    },
    listWithdrawals(scope?: bigint): WithdrawalRow[] {
      return byScope('withdrawals', 'block, log_index', scope).map(toWithdrawal);
    },
    listRagequits(scope?: bigint): RagequitRow[] {
      return byScope('ragequits', 'block, log_index', scope).map(toRagequit);
    },
    exitedLabels(): Set<string> {
      return new Set(all('SELECT label FROM ragequits').map((r) => str(r.label)));
    },

    addDecision(d: DecisionRow): void {
      run('INSERT INTO decisions (label, status, source, actor, at) VALUES (?, ?, ?, ?, ?)', d.label.toString(), d.status, d.source, d.actor, d.at);
    },
    latestDecisions(): Map<string, DecisionRow> {
      const rows = all('SELECT d.* FROM decisions d JOIN (SELECT label, MAX(id) AS id FROM decisions GROUP BY label) m ON d.id = m.id');
      return new Map(rows.map((r) => [str(r.label), toDecision(r)]));
    },
    decisionHistory(label: bigint): DecisionRow[] {
      return all('SELECT * FROM decisions WHERE label = ? ORDER BY id', label.toString()).map(toDecision);
    },

    insertSnapshot(s: { root: bigint; cid: string; document: string; createdAt: number }): number {
      return run("INSERT INTO snapshots (root, cid, document, created_at, status) VALUES (?, ?, ?, ?, 'pending')", s.root.toString(), s.cid, s.document, s.createdAt);
    },
    markSnapshotSent(id: number, txHash: Hash): void {
      run('UPDATE snapshots SET tx_hash = ? WHERE id = ?', txHash, id);
    },
    markSnapshotConfirmed(id: number, block: number, at: number): void {
      run("UPDATE snapshots SET status = 'confirmed', block = ?, confirmed_at = ?, error = NULL WHERE id = ?", block, at, id);
    },
    markSnapshotFailed(id: number, error: string): void {
      run("UPDATE snapshots SET status = 'failed', error = ? WHERE id = ?", error, id);
    },
    latestSnapshot(): SnapshotRow | null {
      const row = one('SELECT * FROM snapshots ORDER BY id DESC LIMIT 1');
      return row ? toSnapshot(row) : null;
    },
    latestConfirmedSnapshot(): SnapshotRow | null {
      const row = one("SELECT * FROM snapshots WHERE status = 'confirmed' ORDER BY id DESC LIMIT 1");
      return row ? toSnapshot(row) : null;
    },
    pendingSnapshots(): SnapshotRow[] {
      return all("SELECT * FROM snapshots WHERE status = 'pending' ORDER BY id").map(toSnapshot);
    },
    listSnapshots(limit: number): SnapshotRow[] {
      return all('SELECT * FROM snapshots ORDER BY id DESC LIMIT ?', limit).map(toSnapshot);
    },
    snapshotByCid(cid: string): SnapshotRow | null {
      const row = one('SELECT * FROM snapshots WHERE cid = ? ORDER BY id DESC LIMIT 1', cid);
      return row ? toSnapshot(row) : null;
    },

    getSettings(): Settings {
      return { ...defaults, ...storedOverrides() };
    },
    updateSettings(patch: Partial<Settings>): Settings {
      const overrides = { ...storedOverrides(), ...patch };
      run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value', 'overrides', JSON.stringify(overrides));
      return { ...defaults, ...overrides };
    },

    createNonce(nonce: string, issuedAt: number): void {
      run('INSERT INTO nonces (nonce, issued_at) VALUES (?, ?)', nonce, issuedAt);
    },
    consumeNonce(nonce: string, now: number, ttlSec: number): boolean {
      const row = one('SELECT issued_at, used FROM nonces WHERE nonce = ?', nonce);
      if (!row || num(row.used) === 1 || now - num(row.issued_at) > ttlSec) return false;
      run('UPDATE nonces SET used = 1 WHERE nonce = ?', nonce);
      return true;
    },

    close(): void {
      db.close();
    },
  };
}
