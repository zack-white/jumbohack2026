import { NextRequest, NextResponse } from "next/server";
import { getPiBaseUrl } from "@/lib/piBaseUrl";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const TIMEOUT_MS = 180_000; // 3 min for scan

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const base = getPiBaseUrl();
    const url = `${base}/scan`;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(id);
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
    const json = text ? JSON.parse(text) : {};
    return NextResponse.json(json);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Pi scan request failed", details: message },
      { status: 502 }
    );
  }
}
