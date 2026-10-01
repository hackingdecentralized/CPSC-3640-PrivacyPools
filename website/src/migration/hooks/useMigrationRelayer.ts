'use client';

import { useCallback } from 'react';
import { migrationRelayerClient } from '../api/migrationRelayerClient';
import { mockMigrationRelayerClient } from '../api/mockMigrationRelayerClient';
import { getMigrationRuntimeConfig } from '../config/runtime';
import { MigrationRelayerRequest, MigrationRelayerResponse } from '../types/relayer';

export interface UseMigrationRelayerReturn {
  submitMigration: (payloads: MigrationRelayerRequest) => Promise<MigrationRelayerResponse>;
}

export const useMigrationRelayer = (): UseMigrationRelayerReturn => {
  const runtime = getMigrationRuntimeConfig();

  const submitMigration = useCallback(
    async (payloads: MigrationRelayerRequest): Promise<MigrationRelayerResponse> => {
      if (runtime.useMockRelayer) {
        return mockMigrationRelayerClient(payloads);
      }

      return migrationRelayerClient({
        payloads,
        endpoint: '/api',
      });
    },
    [runtime.useMockRelayer],
  );

  return {
    submitMigration,
  };
};
