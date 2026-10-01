import type { AccountCommitment, Hash, Withdrawal, WithdrawalProof } from '~/types';
import type { PoolInfo as SDKPoolInfo } from '@0xbow/privacy-pools-core-sdk';

export type Scope = SDKPoolInfo['scope'] | bigint | string;
export type CommitmentLabel = AccountCommitment['label'] | bigint | string;
export type CommitmentHash = AccountCommitment['hash'] | bigint | string;

export type MigrationFlowState = 'intro' | 'migrating' | 'success' | 'failed';

export interface MigrationChainReadiness {
  expectedLegacyCommitments: number;
  migratedCommitments: number;
  legacyMasterSeedNullifiedCount: number;
  hasPostMigrationCommitments: boolean;
  isMigrated: boolean;
  legacySpendableCommitments: number;
  upgradedSpendableCommitments: number;
  scopes: Scope[];
}

export interface MigrationReadinessSnapshot {
  chains: Record<number, MigrationChainReadiness>;
  requiresMigration: boolean;
  isFullyMigrated: boolean;
  requiredChainIds: number[];
  migratedChainIds: number[];
  missingChainIds: number[];
  diagnostics: {
    warnings: string[];
    legacyErrors: unknown[];
    upgradedErrors: unknown[];
  };
}

export interface MigrationProofBundle {
  chainId: SDKPoolInfo['chainId'];
  scope: Hash;
  poolAddress: `0x${string}`;
  commitmentLabel: CommitmentLabel;
  commitmentHash: CommitmentHash;
  withdrawal: Withdrawal;
  proof: WithdrawalProof;
}

export interface MigrationContextState {
  isActive: boolean;
  showBanner: boolean;
  isBlocking: boolean;
  flowState: MigrationFlowState;
  errorMessage: string | null;
  migrationReadiness: MigrationReadinessSnapshot | null;
  retryCount: number;
  maxRetries: number;
}
