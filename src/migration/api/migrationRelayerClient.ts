import {
  MigrationRelayerCallInput,
  MigrationRelayerResponse,
  MigrationRelayerStatus,
  MigrationRelayerStatusResponse,
  MigrationRelayerSubmitResponse,
} from '../types/relayer';
import { sleep } from '../utils/helpers';

const TERMINAL_STATUSES = new Set<MigrationRelayerStatus>(['MINED_SUCCESS', 'FAILED']);

const parseJsonSafely = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === 'object';
};

const isStringArray = (value: unknown): value is string[] => {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
};

const isMigrationRelayerSubmitResponse = (value: unknown): value is MigrationRelayerSubmitResponse => {
  if (!isRecord(value)) return false;

  const candidate = value as Partial<MigrationRelayerSubmitResponse>;
  if (!isStringArray(candidate.failed) || !isStringArray(candidate.success)) return false;
  if (!isRecord(candidate.tracking)) return false;

  return Object.values(candidate.tracking).every((entry) => isRecord(entry) && typeof entry.supertxHash === 'string');
};

const isMigrationRelayerStatus = (value: unknown): value is MigrationRelayerStatus => {
  return value === 'PENDING' || value === 'MINING' || value === 'MINED_SUCCESS' || value === 'FAILED';
};

const isMigrationRelayerStatusResponse = (value: unknown): value is MigrationRelayerStatusResponse => {
  if (!isRecord(value)) return false;

  const candidate = value as Partial<MigrationRelayerStatusResponse>;
  return (
    isMigrationRelayerStatus(candidate.status) && (candidate.error === null || typeof candidate.error === 'string')
  );
};

const requestMigrationRelayer = async ({
  fetchImpl,
  timeoutMs,
  url,
  init,
}: {
  fetchImpl: typeof fetch;
  timeoutMs: number;
  url: string;
  init: RequestInit;
}): Promise<{ response: Response; parsed: unknown }> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      ...init,
      signal: controller.signal,
    });

    const parsed = await parseJsonSafely(response);
    return { response, parsed };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Migration relayer request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const submitMigrationPayloads = async ({
  endpoint,
  payloads,
  fetchImpl,
  timeoutMs,
}: {
  endpoint: string;
  payloads: MigrationRelayerCallInput['payloads'];
  fetchImpl: typeof fetch;
  timeoutMs: number;
}): Promise<MigrationRelayerSubmitResponse> => {
  const migrateUrl = `${endpoint}/migrate`;
  const { response, parsed } = await requestMigrationRelayer({
    fetchImpl,
    timeoutMs,
    url: migrateUrl,
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payloads),
    },
  });

  if (!response.ok) {
    throw new Error(`Migration relayer request failed with status ${response.status}`);
  }

  if (!isMigrationRelayerSubmitResponse(parsed)) {
    throw new Error('Migration relayer response shape is invalid');
  }

  return parsed;
};

const fetchMigrationStatus = async ({
  endpoint,
  supertxHash,
  fetchImpl,
  timeoutMs,
}: {
  endpoint: string;
  supertxHash: string;
  fetchImpl: typeof fetch;
  timeoutMs: number;
}): Promise<MigrationRelayerStatusResponse> => {
  const statusUrl = `${endpoint}/migrate/status/${supertxHash}`;
  const { response, parsed } = await requestMigrationRelayer({
    fetchImpl,
    timeoutMs,
    url: statusUrl,
    init: {
      method: 'GET',
    },
  });

  if (!response.ok) {
    throw new Error(`Migration relayer status request failed with status ${response.status}`);
  }

  if (!isMigrationRelayerStatusResponse(parsed)) {
    throw new Error('Migration relayer status response shape is invalid');
  }

  return parsed;
};

const pollMigrationStatus = async ({
  endpoint,
  txId,
  supertxHash,
  fetchImpl,
  timeoutMs,
  maxAttempts,
  pollIntervalMs,
}: {
  endpoint: string;
  txId: string;
  supertxHash: string;
  fetchImpl: typeof fetch;
  timeoutMs: number;
  maxAttempts: number;
  pollIntervalMs: number;
}): Promise<MigrationRelayerStatusResponse> => {
  let lastErrorMessage: string | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const statusResponse = await fetchMigrationStatus({
        endpoint,
        supertxHash,
        fetchImpl,
        timeoutMs,
      });

      if (TERMINAL_STATUSES.has(statusResponse.status)) {
        return statusResponse;
      }
    } catch (error) {
      lastErrorMessage = error instanceof Error ? error.message : `Unknown status polling error for txId ${txId}`;
    }

    if (attempt < maxAttempts) {
      await sleep(pollIntervalMs);
    }
  }

  return {
    status: 'FAILED',
    error: lastErrorMessage ?? `Migration relayer status polling timed out for txId ${txId}`,
  };
};

const normalizeMigrationResult = async ({
  submitResponse,
  payloads,
  endpoint,
  fetchImpl,
  timeoutMs,
  maxStatusPollAttempts,
  statusPollIntervalMs,
}: {
  submitResponse: MigrationRelayerSubmitResponse;
  payloads: MigrationRelayerCallInput['payloads'];
  endpoint: string;
  fetchImpl: typeof fetch;
  timeoutMs: number;
  maxStatusPollAttempts: number;
  statusPollIntervalMs: number;
}): Promise<MigrationRelayerResponse> => {
  const failedTxIds = new Set<string>(submitResponse.failed);
  const successfulTxIds = new Set<string>();

  const txIdsToPoll = submitResponse.success.filter((txId) => !failedTxIds.has(txId));

  const polledStatuses = await Promise.all(
    txIdsToPoll.map(async (txId) => {
      const trackingEntry = submitResponse.tracking[txId];
      const supertxHash = trackingEntry?.supertxHash?.trim();

      if (!supertxHash) {
        return {
          txId,
          statusResponse: { status: 'FAILED', error: `Missing tracking hash for txId ${txId}` } as const,
        };
      }

      const statusResponse = await pollMigrationStatus({
        endpoint,
        txId,
        supertxHash,
        fetchImpl,
        timeoutMs,
        maxAttempts: maxStatusPollAttempts,
        pollIntervalMs: statusPollIntervalMs,
      });

      return { txId, statusResponse };
    }),
  );

  for (const { txId, statusResponse } of polledStatuses) {
    if (statusResponse.status === 'MINED_SUCCESS') {
      successfulTxIds.add(txId);
      continue;
    }
    failedTxIds.add(txId);
  }

  const orderedTxIds = payloads.map((p) => String(p.txId));

  for (const txId of orderedTxIds) {
    if (!successfulTxIds.has(txId) && !failedTxIds.has(txId)) {
      failedTxIds.add(txId);
    }
  }

  return {
    failed: orderedTxIds.filter((txId) => failedTxIds.has(txId)),
    success: orderedTxIds.filter((txId) => successfulTxIds.has(txId)),
  };
};

export const migrationRelayerClient = async (input: MigrationRelayerCallInput): Promise<MigrationRelayerResponse> => {
  const endpoint = input.endpoint.trim().replace(/\/+$/, '');
  const fetchImpl = input.fetchImpl ?? fetch;
  const timeoutMs = 60_000;
  const maxStatusPollAttempts = 40;
  const statusPollIntervalMs = 3_000;

  if (!endpoint) {
    throw new Error('migrationRelayerClient: endpoint is required');
  }

  const submitResponse = await submitMigrationPayloads({
    endpoint,
    payloads: input.payloads,
    fetchImpl,
    timeoutMs,
  });

  return normalizeMigrationResult({
    submitResponse,
    payloads: input.payloads,
    endpoint,
    fetchImpl,
    timeoutMs,
    maxStatusPollAttempts,
    statusPollIntervalMs,
  });
};
