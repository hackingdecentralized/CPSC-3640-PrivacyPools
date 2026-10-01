import { chainData } from '~/config';
import { Scope } from '../types/migration';

export const normalizeScope = (scope: Scope): string => {
  return typeof scope === 'bigint' ? scope.toString() : scope;
};

export const createScopeToChainIndex = (): Map<string, number> => {
  const output = new Map<string, number>();

  for (const chain of Object.values(chainData)) {
    for (const pool of chain.poolInfo) {
      const normalizedScope = normalizeScope(pool.scope);
      if (!output.has(normalizedScope)) {
        output.set(normalizedScope, pool.chainId);
      }
    }
  }

  return output;
};
