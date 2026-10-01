export const getRelayerUrl = (): string | null => {
  const url = process.env.MIGRATION_RELAYER_URL || process.env.NEXT_PUBLIC_MIGRATION_RELAYER_URL;
  return url?.trim().replace(/\/+$/, '') || null;
};
