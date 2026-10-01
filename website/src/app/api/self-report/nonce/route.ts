import { NextRequest, NextResponse } from 'next/server';

// Get ASP endpoint from environment
const ASP_ENDPOINT = process.env.NEXT_PUBLIC_ASP_ENDPOINT_NON_TEST || process.env.NEXT_PUBLIC_ASP_ENDPOINT_TEST;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    const action = searchParams.get('action') || 'report';

    if (!address) {
      return NextResponse.json({ error: 'Missing required parameter: address' }, { status: 400 });
    }

    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json({ error: 'Invalid Ethereum address format' }, { status: 400 });
    }

    // Validate action
    if (!['report', 'unreport'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Must be "report" or "unreport"' }, { status: 400 });
    }

    if (!ASP_ENDPOINT) {
      console.error('ASP_ENDPOINT not configured');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Get nonce from ASP
    const aspResponse = await fetch(
      `${ASP_ENDPOINT}/global/public/report-address/nonce?address=${address}&action=${action}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    const aspData = await aspResponse.json();

    if (!aspResponse.ok) {
      console.error('ASP error:', aspData);
      return NextResponse.json(
        { error: aspData.message || aspData.error || 'Failed to get nonce' },
        { status: aspResponse.status },
      );
    }

    return NextResponse.json(aspData, { status: 200 });
  } catch (error) {
    console.error('Get nonce error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
