import { NextRequest, NextResponse } from 'next/server';
import { getPiBaseUrl } from '@/lib/piBaseUrl';

const TIMEOUT_MS = 300_000; // 5 min for nmap scans

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ips = searchParams.getAll('ips');
  const timeout = searchParams.get('timeout') ?? '300';
  if (!ips.length) {
    return NextResponse.json({ error: 'ips query param required' }, { status: 400 });
  }
  const base = getPiBaseUrl();
  const qs = new URLSearchParams();
  ips.forEach((ip) => qs.append('ips', ip));
  qs.set('timeout', timeout);
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${base}/nmap?${qs}`, {
      method: 'GET',
      headers: { Accept: 'text/event-stream' },
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(id);
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: 'Pi nmap request failed', status: res.status, body: text },
        { status: res.status }
      );
    }
    return new NextResponse(res.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err) {
    clearTimeout(id);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: 'Pi nmap request failed', details: message },
      { status: 502 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const base = getPiBaseUrl();
    const response = await fetch(`${base}/nmap-scan`, {
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