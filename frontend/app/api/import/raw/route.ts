import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { texts } = body;

    if (!texts || !Array.isArray(texts)) {
      return NextResponse.json(
        { error: 'Texts array is required' },
        { status: 400 }
      );
    }

    // Mock parsing logic
    const items = texts.map((text: string, index: number) => {
      // Extract merchant and amount from email text
      const merchantMatch = text.match(/ご利用先[：:]\s*([^\n]+)/);
      const amountMatch = text.match(/ご利用金額[：:]\s*([0-9,]+)/);
      const dateMatch = text.match(/ご利用日[：:]\s*(\d{4}\/\d{2}\/\d{2})/);
      
      const merchant = merchantMatch ? merchantMatch[1].trim() : `サービス ${index + 1}`;
      const amountStr = amountMatch ? amountMatch[1].replace(/,/g, '') : '1000';
      const amount = parseInt(amountStr) * 100; // Convert to cents
      const dateStr = dateMatch ? dateMatch[1] : '2024/03/01';
      const date = new Date(dateStr.replace(/\//g, '-')).toISOString();
      
      return {
        merchant,
        amount_cents: amount,
        purchased_at: date
      };
    });

    const response = {
      items,
      meta: {
        locked_count: 0,
        truncated: false
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