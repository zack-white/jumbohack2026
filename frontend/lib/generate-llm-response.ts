import { type Packet, type Device, type NmapResult } from "@/hooks/useScan";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
    apiKey: process.env.NEXT_PUBLIC_CLAUDE_API_KEY,
    dangerouslyAllowBrowser: true,
});

function buildPrompt(
  packets: Packet[],
  devices: Record<string, Device>,
  nmapResults?: NmapResult[]
): string {
    const deviceLines = Object.entries(devices).map(([ip, d]) =>
        `  - ${ip} | MAC: ${d.mac} | Vendor: ${d.vendor} | Hostname: ${d.hostname ?? "unknown"}`
    ).join("\n");

    // Format each packet as a compact, readable line
    const firstTs = packets[0]?.timestamp ?? 0;
    const packetLines = packets.map((p) => {
        const elapsed = (p.timestamp - firstTs).toFixed(2);
        const src = p.src_ip ? `${p.src_ip}${p.src_port ? `:${p.src_port}` : ""}` : "?";
        const dst = p.dst_ip ? `${p.dst_ip}${p.dst_port ? `:${p.dst_port}` : ""}` : "?";
        const extras = [
            p.flags && `flags=${p.flags}`,
            p.dns_query && `dns=${p.dns_query}`,
            `${p.size}B`,
        ].filter(Boolean).join(" ");
        return `  [+${elapsed}s] ${p.protocol} ${src} → ${dst}  ${extras}`;
    }).join("\n");

    return `You are a network security analyst. A 60-second packet capture was taken from a private local network.
Analyze the data below and provide a clear, plain-English security report for a non-technical audience.

Focus on:
1. What devices are on the network and whether any look unusual or unauthorized
2. Any suspicious traffic patterns (port scans, unusual protocols, unexpected outbound connections)
3. DNS queries that may indicate malware, trackers, or suspicious behavior
4. Any signs of excessive or abnormal traffic from a single device
5. Overall network health and key risks

Be specific — reference IPs, ports, and vendors by name. Flag anything that warrants attention, but do not alarm unnecessarily if everything looks normal.

---

DEVICES ON NETWORK (${Object.keys(devices).length} total):
${deviceLines || "  None identified"}

PACKET LOG (${packets.length} total):
${packetLines || "  No packets captured"}
${nmapResults && nmapResults.length > 0 ? `
NMAP PORT SCAN RESULTS (${nmapResults.length} hosts):
${nmapResults.map((r) => `  ${r.ip}: returncode=${r.returncode} | open ports/services in stdout below\n    stdout: ${(r.stdout || "").slice(0, 800)}${(r.stdout?.length ?? 0) > 800 ? "..." : ""}`).join("\n")}` : ""}

---

Provide your analysis in 3-5 short paragraphs. End with a list of any specific actions the user should take, or "No action required" if everything looks clean.

Do not use markdown formatting. No headers, no bold, no asterisks, no hyphens as bullets. Use plain sentences and numbered lists only.`;
}

export async function generateLLMResponse(
    packets: Packet[],
    devices: Record<string, Device>,
    onChunk: (chunk: string) => void,
    nmapResults?: NmapResult[]
): Promise<void> {
    console.log("[LLM] generateLLMResponse called", { packets: packets.length, devices: Object.keys(devices).length, nmapResults: nmapResults?.length ?? 0 });
    const prompt = buildPrompt(packets, devices, nmapResults);
    console.log("[LLM] Prompt built, sending to Claude...");

    const stream = await client.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 5000,
        messages: [{ role: "user", content: prompt }],
        stream: true,
    });

    let chunkCount = 0;
    for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            chunkCount++;
            if (chunkCount === 1) console.log("[LLM] First chunk received");
            onChunk(event.delta.text);
        }
    }
    console.log("[LLM] Stream complete", { totalChunks: chunkCount });
}
