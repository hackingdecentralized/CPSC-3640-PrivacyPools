import { NextRequest, NextResponse } from 'next/server';
import { getRelayerUrl } from '../../utils';

export const maxDuration = 60;

const RELAYER_TIMEOUT_MS = 15_000;
const SUPERTX_HASH_PATTERN = /^0x[0-9a-fA-F]{1,64}$/;

export async function GET(_request: NextRequest, { params }: { params: Promise<{ hash: string }> }) {
  const relayerUrl = getRelayerUrl();
  if (!relayerUrl) {
    return NextResponse.json({ error: 'Migration relayer URL is not configured' }, { status: 500 });
  }

  const { hash } = await params;
  if (!hash || !SUPERTX_HASH_PATTERN.test(hash)) {
    return NextResponse.json({ error: 'Invalid or missing hash parameter' }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), RELAYER_TIMEOUT_MS);

    try {
      const response = await fetch(`${relayerUrl}/migrate/status/${hash}`, {
        method: 'GET',
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
    console.error(`[migration proxy] GET /migrate/status/${hash} failed:`, error);
    return NextResponse.json(
      {
        error: isTimeout
          ? 'Migration relayer status proxy request timed out'
          : 'Migration relayer status proxy request failed',
      },
      { status: isTimeout ? 504 : 502 },
    );
  }
}
