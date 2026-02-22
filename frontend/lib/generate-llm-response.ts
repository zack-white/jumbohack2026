import { type Packet, type Device } from "@/hooks/useScan";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
    apiKey: process.env.NEXT_PUBLIC_CLAUDE_API_KEY,
    dangerouslyAllowBrowser: true,
});

function buildPrompt(packets: Packet[], devices: Record<string, Device>): string {
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

---

Provide your analysis in 3-5 short paragraphs. End with a list of any specific actions the user should take, or "No action required" if everything looks clean.

Do not use markdown formatting. No headers, no bold, no asterisks, no hyphens as bullets. Use plain sentences and numbered lists only.`;
}

export async function generateLLMResponse(
    packets: Packet[],
    devices: Record<string, Device>,
    onChunk: (chunk: string) => void
): Promise<void> {
    const prompt = buildPrompt(packets, devices);

    const stream = await client.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 5000,
        messages: [{ role: "user", content: prompt }],
        stream: true,
    });

    for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            onChunk(event.delta.text);
        }
    }
}
