import { type Packet, type Device } from "@/hooks/useScan";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY });

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

Provide your analysis in 3-5 short paragraphs. End with a bullet list of any specific actions the user should take, or "No action required" if everything looks clean.`;
}

export async function generateLLMResponse(
    packets: Packet[],
    devices: Record<string, Device>
): Promise<string> {
    const prompt = buildPrompt(packets, devices);

    const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
    });

    return response.text ?? "No analysis returned.";
}
