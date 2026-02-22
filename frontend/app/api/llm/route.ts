import { NextRequest } from "next/server";
import { generateLLMResponse } from "@/lib/generate-llm-response";
import { type Packet, type Device, type NmapResult } from "@/hooks/useScan";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
    try {
        const { packets, devices, nmapResults } = await request.json() as {
            packets: Packet[];
            devices: Record<string, Device>;
            nmapResults?: NmapResult[];
        };

        const encoder = new TextEncoder();
        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();

        generateLLMResponse(packets, devices, (chunk) => {
            writer.write(encoder.encode(chunk));
        }, nmapResults)
            .then(() => writer.close())
            .catch((err) => {
                console.error("[LLM Route] Generation error:", err);
                writer.abort(err);
            });

        return new Response(readable, {
            headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return new Response(JSON.stringify({ error: "LLM request failed", details: message }), {
            status: 502,
            headers: { "Content-Type": "application/json" },
        });
    }
}
