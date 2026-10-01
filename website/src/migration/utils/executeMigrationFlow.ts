import { AccountService } from '~/types';
import { buildMigrationProofs } from '../proof/buildMigrationProofs';
import { buildMulticallPayloads } from '../proof/buildMulticallPayloads';
import { MigrationRelayerRequest, MigrationRelayerResponse } from '../types/relayer';
import { MIGRATION_MESSAGES } from './constants';
import { getBackoffMs, sleep } from './helpers';

interface MigrationRetryConfig {
  maxRetries: number;
  initialBackoffMs: number;
  maxBackoffMs: number;
}

interface ExecuteMigrationFlowInput {
  accountService: AccountService;
  legacyAccountService: AccountService;
  declinedLabels?: Set<string>;
  retryConfig: MigrationRetryConfig;
  submitMigration: (payloads: MigrationRelayerRequest) => Promise<MigrationRelayerResponse>;
  onRetry?: (retryCount: number) => void;
}

export const executeMigrationFlow = async ({
  accountService,
  legacyAccountService,
  declinedLabels,
  retryConfig,
  submitMigration,
  onRetry,
}: ExecuteMigrationFlowInput): Promise<void> => {
  const proofBundles = await buildMigrationProofs({
    accountService,
    legacyAccountService,
    declinedLabels,
  });

  const initialPayloads = buildMulticallPayloads(proofBundles);

  if (proofBundles.length > 0 && initialPayloads.length === 0) {
    throw new Error(MIGRATION_MESSAGES.failedToBuildPayloads);
  }

  if (initialPayloads.length === 0) {
    throw new Error(MIGRATION_MESSAGES.noEligibleCommitments);
  }

  let pendingPayloads = initialPayloads;
  const maxAttempts = retryConfig.maxRetries + 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await submitMigration(pendingPayloads);

    const failedTxIds = new Set(response.failed);
    const failedPayloads = pendingPayloads.filter((payload) => failedTxIds.has(String(payload.txId)));

    if (failedPayloads.length === 0) {
      return;
    }

    pendingPayloads = failedPayloads;

    if (attempt >= maxAttempts) {
      break;
    }

    onRetry?.(attempt);
    await sleep(getBackoffMs(attempt, retryConfig.initialBackoffMs, retryConfig.maxBackoffMs));
  }

  throw new Error(MIGRATION_MESSAGES.failedAfterMaxRetries);
};
