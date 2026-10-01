/**
 * CPSC 3640: the Teaching ASP's classroom endpoints (`/teaching/*`, `/admin/*`).
 * The public `/:chainId/public/*` endpoints the upstream app uses stay in `aspClient`.
 */

export type TeachingDepositStatus = 'pending' | 'approved' | 'declined' | 'exited';

export interface TeachingSettings {
  autoApproveDelaySec: number;
  publishIntervalSec: number;
  freezeRoots: boolean;
}

export interface TeachingDeposit {
  label: string;
  scope: string;
  pool: string;
  symbol: string;
  depositor: string;
  value: string;
  commitment: string;
  txHash: string;
  timestamp: number;
  status: TeachingDepositStatus;
  approveAt: number;
}

export interface TeachingDepositsResponse {
  now: number;
  settings: TeachingSettings;
  deposits: TeachingDeposit[];
}

/** An HTTP error from the ASP, keeping the status so a 401 can be told apart. */
export class TeachingAspError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const request = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body && typeof body.error === 'string' ? body.error : response.statusText;
    throw new TeachingAspError(response.status, message || `HTTP ${response.status}`);
  }
  return body as T;
};

const post = <T>(url: string, body: unknown, token?: string) =>
  request<T>(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

export const teachingAsp = {
  deposits: (aspUrl: string) => request<TeachingDepositsResponse>(`${aspUrl}/teaching/deposits`),

  nonce: (aspUrl: string, address: string) =>
    post<{ nonce: string; message: string }>(`${aspUrl}/admin/nonce`, { address }),

  login: (aspUrl: string, address: string, nonce: string, signature: string) =>
    post<{ token: string; expiresAt: number }>(`${aspUrl}/admin/login`, { address, nonce, signature }),

  decide: (aspUrl: string, token: string, label: string, action: 'approve' | 'decline') =>
    post<{ label: string; status: TeachingDepositStatus }>(`${aspUrl}/admin/deposits/${label}/${action}`, {}, token),

  updateSettings: (aspUrl: string, token: string, settings: TeachingSettings) =>
    post<TeachingSettings>(`${aspUrl}/admin/settings`, settings, token),
};
