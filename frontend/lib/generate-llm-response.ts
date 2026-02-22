import { type Packet, type Device, type NmapResult } from "@/hooks/useScan";

// Computes pre-aggregated traffic statistics injected into the LLM prompt.
function buildTrafficStats(packets: Packet[]): string {
    // Derive capture window from first/last packet timestamps (Unix seconds).
    // Fall back to 60s if there's only one packet or timestamps are identical.
    const captureSeconds = packets.length > 1
        ? (packets[packets.length - 1].timestamp - packets[0].timestamp) || 60
        : 60;

    const ipCounts: Record<string, number> = {};   // total packets per source IP
    const synCounts: Record<string, number> = {};  // SYN-only packets per source IP
    const dstPorts: Record<string, Set<number>> = {}; // unique dst ports per source IP (TCP only)
    const protoCounts: Record<string, number> = {}; // total packets per protocol

    for (const p of packets) {
        const src = p.src_ip ?? "unknown";
        ipCounts[src] = (ipCounts[src] ?? 0) + 1;
        protoCounts[p.protocol ?? "unknown"] = (protoCounts[p.protocol ?? "unknown"] ?? 0) + 1;

        if (p.protocol === "TCP") {
            // flags === "S" means SYN bit set with no ACK — the initiating half of a
            // handshake. A flood of these without corresponding SYN-ACKs completing
            // is the textbook SYN flood DoS pattern.
            if (p.flags === "S") {
                synCounts[src] = (synCounts[src] ?? 0) + 1;
            }
            // Tracking unique destination ports per source lets us detect port scans:
            // one IP probing many ports in a short window.
            if (p.dst_port != null) {
                if (!dstPorts[src]) dstPorts[src] = new Set();
                dstPorts[src].add(p.dst_port);
            }
        }
    }

    const lines: string[] = [];

    const protoSummary = Object.entries(protoCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([proto, count]) => `${proto}=${count}`)
        .join(", ");
    lines.push(`Protocol breakdown: ${protoSummary}`);
    lines.push(`Capture duration: ~${captureSeconds.toFixed(0)}s  Total packets: ${packets.length}  Rate: ${(packets.length / captureSeconds).toFixed(1)} pkt/s`);

    // Only surface IPs that cross the noise threshold (>50 packets)
    // Below this, normal background traffic (ARP, mDNS, keepalives) creates
    // false positives that distract the LLM.
    const highVolume = Object.entries(ipCounts)
        .filter(([, count]) => count > 50)
        .sort((a, b) => b[1] - a[1]);
    if (highVolume.length > 0) {
        lines.push("High-volume sources (>50 packets):");
        for (const [ip, count] of highVolume) {
            const rate = (count / captureSeconds).toFixed(1);
            const synCount = synCounts[ip] ?? 0;
            const uniquePorts = dstPorts[ip]?.size ?? 0;
            const synPct = count > 0 ? ((synCount / count) * 100).toFixed(0) : "0";
            const alerts: string[] = [];
            if (synCount > 100) alerts.push(`LIKELY SYN FLOOD (${synCount} SYN-only packets)`);
            else if (synCount > 20) alerts.push(`elevated SYN count (${synCount})`);
            if (uniquePorts > 20) alerts.push(`port scan signature (${uniquePorts} unique dst ports)`);
            // *** markers make anomalies visually prominent in the prompt text
            lines.push(`  ${ip}: ${count} pkts @ ${rate} pkt/s | SYN-only=${synCount} (${synPct}%) | unique_dst_ports=${uniquePorts}${alerts.length ? " | *** " + alerts.join(", ") + " ***" : ""}`);
        }
    }

    // Catch sources with many SYN-only packets that stayed under the 50-packet
    // total threshold — e.g. a slow/low-volume SYN scan that spread traffic
    // across many source ports to avoid the volume check.
    const synFloodCandidates = Object.entries(synCounts)
        .filter(([ip, count]) => count > 20 && !highVolume.find(([hvIp]) => hvIp === ip))
        .sort((a, b) => b[1] - a[1]);
    if (synFloodCandidates.length > 0) {
        lines.push("Additional SYN flood candidates:");
        for (const [ip, count] of synFloodCandidates) {
            lines.push(`  ${ip}: ${count} SYN-only packets`);
        }
    }

    return lines.join("\n");
}

function buildPrompt(
  packets: Packet[],
  devices: Record<string, Device>,
  nmapResults?: NmapResult[]
): string {
    const deviceLines = Object.entries(devices).map(([ip, d]) =>
        `  - ${ip} | MAC: ${d.mac} | Vendor: ${d.vendor} | Hostname: ${d.hostname ?? "unknown"}`
    ).join("\n");

    // Format each packet as a compact, readable line (exclude Pi's own traffic)
    const filteredPackets = packets.filter((p) => p.src_ip !== "10.0.1.6");
    // Relative timestamps anchored to first packet so elapsed time is human-readable
    const firstTs = filteredPackets[0]?.timestamp ?? 0;

    // Pre-compute traffic statistics across ALL packets before formatting.
    // This runs on the full dataset so anomaly counts are never understated.
    const trafficStats = buildTrafficStats(filteredPackets);

    const packetLines = filteredPackets.map((p) => {
        const elapsed = (p.timestamp - firstTs).toFixed(2);
        const src = p.src_ip ? `${p.src_ip}${p.src_port ? `:${p.src_port}` : ""}` : "?";
        const dst = p.dst_ip ? `${p.dst_ip}${p.dst_port ? `:${p.dst_port}` : ""}` : "?";
        // filter(Boolean) drops undefined/null/empty-string entries (flags and dns_query are nullable)
        const extras = [
            p.flags && `flags=${p.flags}`,
            p.dns_query && `dns=${p.dns_query}`,
            `${p.size}B`,
        ].filter(Boolean).join(" ");
        return `  [+${elapsed}s] ${p.protocol} ${src} → ${dst}  ${extras}`;
    }).join("\n");

    return `You are a network security analyst. A 60-second packet capture was taken from a private local network.
Analyze the data below and provide a clear, plain-English security report for a non-technical audience.

TCP flag reference: S=SYN(connection start), A=ACK, SA=SYN-ACK(handshake reply), F=FIN(close), R=RST(rejection/abort), P=PSH(data), PA=PSH+ACK(normal data transfer). A burst of S-only packets from one source to many destinations or ports is a SYN flood — a denial-of-service attack.

Focus on:
1. What devices are on the network and whether any look unusual or unauthorized
2. SYN floods: any source with a high volume of SYN-only (flags=S) packets is attacking the network — use the TRAFFIC ANOMALY SUMMARY to identify this
3. Port scans: one source connecting to many different destination ports
4. DNS queries that may indicate malware, trackers, or suspicious behavior
5. Any other unusual traffic patterns or unexpected outbound connections
6. Overall network health and key risks

Be specific — reference IPs, ports, and vendors by name. Flag anything that warrants attention, but do not alarm unnecessarily if everything looks normal.

---

DEVICES ON NETWORK (${Object.keys(devices).length} total):
${deviceLines || "  None identified"}

TRAFFIC ANOMALY SUMMARY (computed across all ${filteredPackets.length} packets):
${trafficStats}

PACKET LOG (${filteredPackets.length} total):
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
    console.log("[LLM] Prompt built, sending to /api/llm...");

    const response = await fetch("/api/llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
    });

    if (!response.ok || !response.body) {
        throw new Error(`LLM API error: ${response.status}`);
    }

    const reader = response.body.getReader();
    // stream: true keeps the decoder's internal state between calls so multi-byte
    // UTF-8 characters split across chunk boundaries are reassembled correctly
    const decoder = new TextDecoder();
    let chunkCount = 0;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunkCount++;
        if (chunkCount === 1) console.log("[LLM] First chunk received");
        onChunk(decoder.decode(value, { stream: true }));
    }

    console.log("[LLM] Stream complete", { totalChunks: chunkCount });
}
