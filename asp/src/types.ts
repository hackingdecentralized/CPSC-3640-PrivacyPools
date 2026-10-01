export type Address = `0x${string}`;
export type Hash = `0x${string}`;

/** Returns the current unix time in seconds. Injected everywhere so tests control time. */
export type Clock = () => number;

export type PoolConfig = {
  symbol: string;
  address: Address;
  asset: Address;
  scope: bigint;
  deploymentBlock: number;
  decimals: number;
};

export type DepositRow = {
  label: bigint;
  scope: bigint;
  pool: Address;
  depositor: Address;
  commitment: bigint;
  value: bigint;
  precommitment: bigint;
  block: number;
  logIndex: number;
  txHash: Hash;
  /** Block timestamp, unix seconds. */
  timestamp: number;
};

export type LeafRow = { scope: bigint; index: number; leaf: bigint; root: bigint; block: number };

export type WithdrawalRow = {
  scope: bigint;
  processooor: Address;
  value: bigint;
  spentNullifier: bigint;
  newCommitment: bigint;
  block: number;
  logIndex: number;
  txHash: Hash;
  timestamp: number;
};

export type RagequitRow = {
  label: bigint;
  scope: bigint;
  ragequitter: Address;
  commitment: bigint;
  value: bigint;
  block: number;
  logIndex: number;
  txHash: Hash;
  timestamp: number;
};

export type DecisionStatus = 'approved' | 'declined';

export type DecisionRow = {
  label: bigint;
  status: DecisionStatus;
  source: 'auto' | 'admin';
  actor: Address | null;
  at: number;
};

export type DepositStatus = 'pending' | 'approved' | 'declined' | 'exited';

export type SnapshotStatus = 'pending' | 'confirmed' | 'failed';

export type SnapshotRow = {
  id: number;
  root: bigint;
  cid: string;
  /** Canonical JSON whose bytes the CID commits to. */
  document: string;
  labels: bigint[];
  createdAt: number;
  status: SnapshotStatus;
  txHash: Hash | null;
  block: number | null;
  confirmedAt: number | null;
  error: string | null;
};

export type Settings = {
  autoApproveDelaySec: number;
  publishIntervalSec: number;
  freezeRoots: boolean;
};
