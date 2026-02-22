import { type Device, type NmapResult } from "@/hooks/useScan";
import { streamLLM } from "./generate-llm-response";

function buildIPPrompt(
    ip: string,
    device: Device,
    networkAnalysis: string,
    nmapResults: NmapResult[]
): string {
    const deviceLine = `IP: ${ip} | MAC: ${device.mac} | Vendor: ${device.vendor} | Hostname: ${device.hostname ?? "unknown"}`;

    const nmapSection =
        nmapResults.length > 0
            ? `\nNMAP RESULTS FOR THIS DEVICE:\n${nmapResults
                  .map((r) => `  ${(r.stdout || "").slice(0, 400)}${(r.stdout?.length ?? 0) > 400 ? "..." : ""}`)
                  .join("\n")}`
            : "";

    return `You are a network security analyst. A full network analysis has already been performed. Using that analysis as context, give a brief focused summary of one specific device.

FULL NETWORK ANALYSIS:
${networkAnalysis}

DEVICE TO SUMMARIZE:
  ${deviceLine}${nmapSection}

In 2-3 plain sentences: what is this device, what is it doing, and is it suspicious? If the network analysis flagged this IP specifically, mention it. Otherwise say it looks normal.

Do not use markdown formatting. No headers, no bold, no asterisks. Plain sentences only.`;
}

export async function generateIPLLMResponse(
    ip: string,
    device: Device,
    networkAnalysis: string,
    onChunk: (chunk: string) => void,
    nmapResults: NmapResult[] = []
): Promise<void> {
    const prompt = buildIPPrompt(ip, device, networkAnalysis, nmapResults);
    console.log("[LLM] generateIPLLMResponse called", { ip, networkAnalysisLength: networkAnalysis.length, nmapResults: nmapResults.length });
    await streamLLM(prompt, onChunk);
}
