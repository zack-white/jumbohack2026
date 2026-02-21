import { NextResponse } from "next/server";
import { getPiBaseUrl } from "@/lib/piBaseUrl";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const TIMEOUT_MS = 10_000;

async function fetchPing(retry = false): Promise<Response> {
  const base = getPiBaseUrl();
  const url = `${base}/ping`;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    if (retry) throw err;
    // 1 retry on network failure
    return fetchPing(true);
  }
}

export async function GET() {
  try {
    const res = await fetchPing();
    const text = await res.text();
    if (!res.ok) {
      return NextResponse.json(
        {
          error: res.statusText,
          status: res.status,
          body: text ? (() => {
            try { return JSON.parse(text); } catch { return text; }
          })() : undefined,
        },
        { status: res.status }
      );
    }
    let body: unknown;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text; // plain string response
      }
    } else {
      body = {};
    }
    return NextResponse.json(body);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Pi network request failed", details: message },
      { status: 502 }
    );
  }
}
