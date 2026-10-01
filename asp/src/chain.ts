import {
  BaseError,
  ContractFunctionRevertedError,
  TransactionReceiptNotFoundError,
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  parseAbi,
  type Account,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type { AspConfig } from './config.ts';
import type { Address, Hash } from './types.ts';

export const poolEventsAbi = parseAbi([
  'event Deposited(address indexed _depositor, uint256 _commitment, uint256 _label, uint256 _value, uint256 _precommitmentHash)',
  'event LeafInserted(uint256 _index, uint256 _leaf, uint256 _root)',
  'event Withdrawn(address indexed _processooor, uint256 _value, uint256 _spentNullifier, uint256 _newCommitment)',
  'event Ragequit(address indexed _ragequitter, uint256 _commitment, uint256 _label, uint256 _value)',
]);

export const entrypointAbi = parseAbi([
  'function updateRoot(uint256 _root, string _ipfsCID) returns (uint256 _index)',
  'function latestRoot() view returns (uint256 _root)',
  'error NoRootsAvailable()',
]);

type LogBase = { block: number; logIndex: number; txHash: Hash };

export type PoolLog =
  | (LogBase & { kind: 'deposit'; depositor: Address; commitment: bigint; label: bigint; value: bigint; precommitment: bigint })
  | (LogBase & { kind: 'leaf'; index: number; leaf: bigint; root: bigint })
  | (LogBase & { kind: 'withdrawal'; processooor: Address; value: bigint; spentNullifier: bigint; newCommitment: bigint })
  | (LogBase & { kind: 'ragequit'; ragequitter: Address; commitment: bigint; label: bigint; value: bigint });

export type LogSource = {
  head(): Promise<number>;
  poolLogs(pool: Address, fromBlock: number, toBlock: number): Promise<PoolLog[]>;
  blockTimestamp(block: number): Promise<number>;
};

export type Receipt = { status: 'success' | 'reverted'; block: number };

export type RootChain = {
  /** Entrypoint.latestRoot(), or null before the first root is published. */
  latestRoot(): Promise<bigint | null>;
  updateRoot(root: bigint, cid: string): Promise<Hash>;
  waitForReceipt(txHash: Hash): Promise<Receipt>;
  /** Receipt of an already-sent transaction, or null if the node does not know it. */
  receiptStatus(txHash: Hash): Promise<Receipt | null>;
};

export function createViemChain(cfg: AspConfig): { logs: LogSource; roots: RootChain } {
  const chain = defineChain({
    id: cfg.chainId,
    name: `chain-${cfg.chainId}`,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [cfg.rpcUrl] } },
  });
  const transport = http(cfg.rpcUrl);
  const publicClient = createPublicClient({ chain, transport });
  const account: Account | Address =
    'privateKey' in cfg.postman ? privateKeyToAccount(cfg.postman.privateKey) : cfg.postman.unlockedAddress;
  const wallet = createWalletClient({ account, chain, transport });
  const timestamps = new Map<number, number>();

  const logs: LogSource = {
    async head() {
      return Number(await publicClient.getBlockNumber());
    },
    async poolLogs(pool, fromBlock, toBlock) {
      const raw = await publicClient.getLogs({
        address: pool,
        events: poolEventsAbi,
        fromBlock: BigInt(fromBlock),
        toBlock: BigInt(toBlock),
        strict: true,
      });
      return raw
        .map((log): PoolLog => {
          const base = { block: Number(log.blockNumber), logIndex: log.logIndex, txHash: log.transactionHash };
          switch (log.eventName) {
            case 'Deposited':
              return {
                ...base,
                kind: 'deposit',
                depositor: log.args._depositor,
                commitment: log.args._commitment,
                label: log.args._label,
                value: log.args._value,
                precommitment: log.args._precommitmentHash,
              };
            case 'LeafInserted':
              return { ...base, kind: 'leaf', index: Number(log.args._index), leaf: log.args._leaf, root: log.args._root };
            case 'Withdrawn':
              return {
                ...base,
                kind: 'withdrawal',
                processooor: log.args._processooor,
                value: log.args._value,
                spentNullifier: log.args._spentNullifier,
                newCommitment: log.args._newCommitment,
              };
            case 'Ragequit':
              return {
                ...base,
                kind: 'ragequit',
                ragequitter: log.args._ragequitter,
                commitment: log.args._commitment,
                label: log.args._label,
                value: log.args._value,
              };
          }
        })
        .sort((a, b) => a.block - b.block || a.logIndex - b.logIndex);
    },
    async blockTimestamp(block) {
      const cached = timestamps.get(block);
      if (cached !== undefined) return cached;
      const { timestamp } = await publicClient.getBlock({ blockNumber: BigInt(block) });
      timestamps.set(block, Number(timestamp));
      return Number(timestamp);
    },
  };

  const toReceipt = (r: { status: 'success' | 'reverted'; blockNumber: bigint }): Receipt => ({
    status: r.status,
    block: Number(r.blockNumber),
  });

  const roots: RootChain = {
    async latestRoot() {
      try {
        return await publicClient.readContract({ address: cfg.entrypoint, abi: entrypointAbi, functionName: 'latestRoot' });
      } catch (err) {
        if (err instanceof BaseError) {
          const revert = err.walk((e) => e instanceof ContractFunctionRevertedError);
          if (revert instanceof ContractFunctionRevertedError && revert.data?.errorName === 'NoRootsAvailable') return null;
        }
        throw err;
      }
    },
    updateRoot(root, cid) {
      return wallet.writeContract({ address: cfg.entrypoint, abi: entrypointAbi, functionName: 'updateRoot', args: [root, cid] });
    },
    async waitForReceipt(txHash) {
      return toReceipt(await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 180_000 }));
    },
    async receiptStatus(txHash) {
      try {
        return toReceipt(await publicClient.getTransactionReceipt({ hash: txHash }));
      } catch (err) {
        if (err instanceof TransactionReceiptNotFoundError) return null;
        throw err;
      }
    },
  };

  return { logs, roots };
}
