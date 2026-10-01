import { getEnv } from '~/config/env';

interface MigrationRuntimeConfig {
  isMigrationActive: boolean;
  showMigrationBanner: boolean;
  migrationRelayerUrl: string;
  useMockRelayer: boolean;
  maxRetries: number;
  initialBackoffMs: number;
  maxBackoffMs: number;
}

export const getMigrationRuntimeConfig = (): MigrationRuntimeConfig => {
  const { IS_MIGRATION_ACTIVE, SHOW_MIGRATION_BANNER, MIGRATION_RELAYER_URL } = getEnv();

  return {
    isMigrationActive: IS_MIGRATION_ACTIVE,
    showMigrationBanner: SHOW_MIGRATION_BANNER,
    migrationRelayerUrl: MIGRATION_RELAYER_URL,
    maxRetries: 3,
    initialBackoffMs: 2000, // 2 seconds
    maxBackoffMs: 30000, // 30 seconds
    useMockRelayer: false,
  };
};
