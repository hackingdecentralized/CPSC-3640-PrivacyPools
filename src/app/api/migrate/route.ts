import { NextRequest, NextResponse } from 'next/server';
import { getRelayerUrl } from './utils';

export const maxDuration = 60;

const RELAYER_TIMEOUT_MS = 60_000;

export async function POST(request: NextRequest) {
  const relayerUrl = getRelayerUrl();
  if (!relayerUrl) {
    return NextResponse.json({ error: 'Migration relayer URL is not configured' }, { status: 500 });
  }

  try {
    const body = await request.text();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), RELAYER_TIMEOUT_MS);

    try {
      const response = await fetch(`${relayerUrl}/migrate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: controller.signal,
      });

      const data = await response.text();
      return new NextResponse(data, {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === 'AbortError';
    console.error('[migration proxy] POST /migrate failed:', error);
    return NextResponse.json(
      { error: isTimeout ? 'Migration relayer proxy request timed out' : 'Migration relayer proxy request failed' },
      { status: isTimeout ? 504 : 502 },
    );
  }
}
