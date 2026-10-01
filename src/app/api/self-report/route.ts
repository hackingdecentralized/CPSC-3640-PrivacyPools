import { NextRequest, NextResponse } from 'next/server';

// Get ASP endpoint from environment
const ASP_ENDPOINT = process.env.NEXT_PUBLIC_ASP_ENDPOINT_NON_TEST || process.env.NEXT_PUBLIC_ASP_ENDPOINT_TEST;

interface ReportAddressRequest {
  address: string;
  nonce: string;
  message: string;
  signature: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ReportAddressRequest = await request.json();
    const { address, nonce, message, signature } = body;

    // Validate required fields
    if (!address || !nonce || !message || !signature) {
      return NextResponse.json(
        { error: 'Missing required fields: address, nonce, message, signature' },
        { status: 400 },
      );
    }

    // Forward to ASP backend for verification and storage
    if (!ASP_ENDPOINT) {
      console.error('ASP_ENDPOINT not configured');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const aspResponse = await fetch(`${ASP_ENDPOINT}/global/public/report-address`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        address,
        nonce,
        message,
        signature,
        reason: 'self_reported_compromised',
      }),
    });

    const aspData = await aspResponse.json();

    if (!aspResponse.ok) {
      console.error('ASP error:', aspData);
      return NextResponse.json(
        { error: aspData.message || aspData.error || 'Failed to report address' },
        { status: aspResponse.status },
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Address successfully reported as compromised',
        data: aspData,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('Self-report error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// Handle preflight requests for CORS
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
