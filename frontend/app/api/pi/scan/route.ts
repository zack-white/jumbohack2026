import { NextRequest, NextResponse } from "next/server";
import { getPiBaseUrl } from "@/lib/piBaseUrl";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const TIMEOUT_MS = 180_000; // 3 min for scan

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const duration = searchParams.get("duration") ?? "60";
  const base = getPiBaseUrl();
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${base}/scan?duration=${duration}`, {
      method: "GET",
      headers: { Accept: "text/event-stream" },
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(id);

    if (!res.ok) {
      return NextResponse.json(
        { error: "Pi scan request failed", status: res.status },
        { status: res.status }
      );
    }

    return new NextResponse(res.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    clearTimeout(id);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Pi scan request failed", details: message },
      { status: 502 }
    );
  }
}
