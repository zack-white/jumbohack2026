import { NextRequest, NextResponse } from 'next/server';

const PI_BASE_URL = process.env.PI_BASE_URL || 'http://localhost:8000';

export async function GET() {
  try {
    const response = await fetch(`${PI_BASE_URL}/nmap-scan`);
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching from Pi:', error);
    return NextResponse.json({ error: 'Failed to connect to Pi' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const response = await fetch(`${PI_BASE_URL}/nmap-scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    
    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error posting to Pi:', error);
    return NextResponse.json({ error: 'Failed to connect to Pi' }, { status: 500 });
  }
}