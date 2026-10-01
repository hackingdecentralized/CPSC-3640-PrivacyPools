import { AccountService } from '~/types';
import { MigrationChainReadiness, MigrationReadinessSnapshot } from '../types/migration';
import { createScopeToChainIndex, normalizeScope } from '../utils/misc';

const createEmptyMigrationReadinessSnapshot = (): MigrationReadinessSnapshot => {
  return {
    chains: {},
    requiresMigration: false,
    isFullyMigrated: true,
    requiredChainIds: [],
    migratedChainIds: [],
    missingChainIds: [],
    diagnostics: {
      warnings: [],
      legacyErrors: [],
      upgradedErrors: [],
    },
  };
};

export const buildMigrationReadinessSnapshot = (input: {
  accountService: AccountService;
  legacyAccountService: AccountService;
  declinedLabels?: Set<string>;
}): MigrationReadinessSnapshot => {
  const scopeToChainIndex = createScopeToChainIndex();
  const declinedLabels = input.declinedLabels ?? new Set<string>();

  const legacyPoolAccounts = input.legacyAccountService?.account?.poolAccounts;
  if (!(legacyPoolAccounts instanceof Map) || legacyPoolAccounts.size === 0) {
    return createEmptyMigrationReadinessSnapshot();
  }

  const chainReadiness = new Map<number, { total: number; migrated: number; scopes: Set<string> }>();

  for (const [rawScope, poolAccounts] of legacyPoolAccounts.entries()) {
    const normalizedScope = normalizeScope(rawScope);
    const chainId = scopeToChainIndex.get(normalizedScope);
    if (!chainId || !Array.isArray(poolAccounts)) continue;

    for (const pa of poolAccounts) {
      if (pa.ragequit) continue;

      // Skip pool accounts with no spendable balance — nothing to migrate
      const children = pa.children ?? [];
      const commitment = children.length > 0 ? children[children.length - 1] : pa.deposit;
      if (!commitment || commitment.value === null || commitment.value <= 0n) continue;

      // Skip rejected deposits — they cannot be migrated
      const label = pa.deposit?.label ?? pa.label;
      if (label && declinedLabels.has(label.toString())) continue;

      const entry = chainReadiness.get(chainId) ?? { total: 0, migrated: 0, scopes: new Set<string>() };
      entry.scopes.add(normalizedScope);
      entry.total += 1;
      if (pa.isMigrated) entry.migrated += 1;
      chainReadiness.set(chainId, entry);
    }
  }

  if (chainReadiness.size === 0) {
    return createEmptyMigrationReadinessSnapshot();
  }

  const chains: Record<number, MigrationChainReadiness> = {};
  for (const [chainId, entry] of chainReadiness.entries()) {
    chains[chainId] = {
      expectedLegacyCommitments: entry.total,
      migratedCommitments: entry.migrated,
      legacyMasterSeedNullifiedCount: entry.migrated,
      hasPostMigrationCommitments: entry.migrated > 0,
      isMigrated: entry.total > 0 && entry.migrated >= entry.total,
      legacySpendableCommitments: entry.total - entry.migrated,
      upgradedSpendableCommitments: entry.migrated,
      scopes: [...entry.scopes],
    };
  }

  const requiredChainIds = [...chainReadiness.keys()].filter((id) => chainReadiness.get(id)!.total > 0).sort();
  const isFullyMigrated = requiredChainIds.every((id) => chains[id].isMigrated);
  const requiresMigration = requiredChainIds.length > 0 && !isFullyMigrated;
  const migratedChainIds = requiredChainIds.filter((id) => chains[id].isMigrated);
  const missingChainIds = requiredChainIds.filter((id) => !chains[id].isMigrated);

  return {
    chains,
    requiresMigration,
    isFullyMigrated,
    requiredChainIds,
    migratedChainIds,
    missingChainIds,
    diagnostics: {
      warnings: [],
      legacyErrors: [],
      upgradedErrors: [],
    },
  };
};
