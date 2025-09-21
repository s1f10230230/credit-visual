import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, plan } = body;

    // Basic validation
    if (!email || !plan) {
      return NextResponse.json(
        { error: 'Email and plan are required' },
        { status: 400 }
      );
    }

    // Simulate mock login success
    const response = {
      access_token: `mock_token_${Date.now()}`,
      token_type: 'Bearer',
      plan: plan,
      user: {
        email: email,
        id: `user_${Date.now()}`
      }
    };

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}