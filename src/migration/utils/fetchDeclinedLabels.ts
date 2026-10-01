import { chainData } from '~/config/chainData';
import { AccountService, ReviewStatus } from '~/types';
import { aspClient } from '~/utils';
import { createScopeToChainIndex, normalizeScope } from './misc';

const hasBrevisAsp = (chainId: number, scope: string): boolean => {
  const chain = chainData[chainId];
  if (!chain) return false;
  const pool = chain.poolInfo.find((p) => p.scope.toString() === scope);
  return pool?.externalAsp?.provider === 'brevis';
};

/**
 * Fetches review statuses for legacy deposit labels from both the primary ASP
 * and the external ASP (Brevis) when applicable, and returns a set of labels
 * that have been declined by either provider.
 * These deposits cannot be migrated and should be excluded from readiness checks.
 */
export const fetchDeclinedLabels = async (legacyAccountService: AccountService): Promise<Set<string>> => {
  const declined = new Set<string>();

  const legacyPoolAccounts = legacyAccountService.account?.poolAccounts;
  if (!(legacyPoolAccounts instanceof Map) || legacyPoolAccounts.size === 0) {
    return declined;
  }

  const scopeToChainIndex = createScopeToChainIndex();
  const brevisLabels: string[] = [];

  for (const [rawScope, accounts] of legacyPoolAccounts.entries()) {
    if (!Array.isArray(accounts) || accounts.length === 0) continue;

    const scope = normalizeScope(rawScope);
    const chainId = scopeToChainIndex.get(scope);
    if (!chainId) continue;

    const chain = chainData[chainId];
    if (!chain) continue;

    const labels = accounts
      .filter((pa: { ragequit?: unknown }) => !pa.ragequit)
      .map((pa: { deposit?: { label?: bigint }; label?: bigint }) => {
        const label = pa.deposit?.label ?? pa.label;
        return label?.toString();
      })
      .filter((l: string | undefined): l is string => !!l);

    if (labels.length === 0) continue;

    if (hasBrevisAsp(chainId, scope)) {
      brevisLabels.push(...labels);
    }

    try {
      const deposits = await aspClient.fetchDepositsByLabel(chain.aspUrl, chainId, scope, labels);
      for (const deposit of deposits) {
        if (deposit.reviewStatus === ReviewStatus.DECLINED) {
          declined.add(BigInt(deposit.label).toString());
        }
      }
    } catch (err) {
      console.warn(`[migration] failed to fetch deposit statuses for scope ${scope}:`, err);
    }
  }

  if (brevisLabels.length > 0) {
    try {
      const response = await aspClient.fetchBrevisDepositReviewStatus(brevisLabels);
      if (response.err === null && response.depositStatus) {
        for (const deposit of response.depositStatus) {
          if (deposit.reviewStatus != null && deposit.label != null) {
            const status = deposit.reviewStatus.toUpperCase() as keyof typeof ReviewStatus;
            if (status in ReviewStatus && ReviewStatus[status] === ReviewStatus.DECLINED) {
              declined.add(BigInt(deposit.label).toString());
            }
          }
        }
      }
    } catch (err) {
      console.warn('[migration] failed to fetch Brevis review statuses:', err);
    }
  }

  return declined;
};
