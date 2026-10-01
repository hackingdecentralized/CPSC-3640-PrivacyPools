export type MigrationMulticallCall = {
  target: `0x${string}`;
  allowFailure: boolean;
  callData: `0x${string}`;
};

export type MigrationRelayerRequest = {
  txId: number;
  chainId: number;
  to: `0x${string}`;
  callData: `0x${string}`;
}[];

export interface MigrationRelayerResponse {
  failed: string[];
  success: string[];
}

export interface MigrationRelayerTrackingEntry {
  supertxHash: string;
}

export interface MigrationRelayerSubmitResponse {
  failed: string[];
  success: string[];
  tracking: Record<string, MigrationRelayerTrackingEntry>;
}

export type MigrationRelayerStatus = 'PENDING' | 'MINING' | 'MINED_SUCCESS' | 'FAILED';

export interface MigrationRelayerStatusResponse {
  status: MigrationRelayerStatus;
  error: string | null;
}

export interface MigrationRelayerCallInput {
  payloads: MigrationRelayerRequest;
  endpoint: string;
  fetchImpl?: typeof fetch;
}
