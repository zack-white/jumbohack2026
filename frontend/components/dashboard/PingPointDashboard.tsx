"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { useNodesState, useEdgesState } from "@xyflow/react";
import type { Node, Edge } from "@xyflow/react";
import NetworkGraph, { type NetworkNodeData } from "./NetworkGraph";
import { type SelectedDevice } from "./DevicePanel";
import MetricsBar, { type PcapMetrics } from "./MetricsBar";
import PacketTimeGraph, { type TimeSeriesPoint, type PcapSummary } from "./PacketTimeGraph";
import { useScan } from "@/hooks/useScan";
import { useAvahiHostnames } from "@/hooks/useAvahiHostnames";
import { generateLLMResponse } from "@/lib/generate-llm-response";
import { Card, CardContent } from "../ui/card";

const HEX_RADIUS = 220;
const CENTER_X = 520;
const CENTER_Y = 320;
const LABEL_MAX_LEN = 24;

function truncateLabel(label: string): string {
  if (label.length <= LABEL_MAX_LEN) return label;
  return label.slice(0, LABEL_MAX_LEN - 2) + "…";
}

function hexWebPosition(index: number): { x: number; y: number } {
  if (index === 0) return { x: CENTER_X, y: CENTER_Y };
  let ring = 1;
  let cumulative = 1;
  while (cumulative + 6 * ring <= index) {
    cumulative += 6 * ring;
    ring++;
  }
  const posInRing = index - cumulative;
  const angle = (posInRing / (6 * ring)) * 2 * Math.PI - Math.PI / 2;
  const r = ring * HEX_RADIUS;
  return {
    x: CENTER_X + r * Math.cos(angle),
    y: CENTER_Y + r * Math.sin(angle),
  };
}

function makeNode(
  ip: string,
  index: number,
  ipToHostname: Map<string, string>,
  device?: { mac: string | null; vendor: string; hostname: string | null },
  packetCount?: number
): Node<NetworkNodeData> {
  const { x, y } = hexWebPosition(index);
  const hostname = device?.hostname ?? ipToHostname.get(ip) ?? null;
  const rawLabel = hostname ?? ip;
  const label = truncateLabel(rawLabel);
  return {
    id: ip,
    type: "device",
    position: { x, y },
    data: {
      label,
      labelFull: rawLabel,
      ip,
      risk: "none" as const,
      mac: device?.mac ?? null,
      vendor: device?.vendor ?? "",
      hostname,
      packetCount: packetCount ?? 0,
    },
  };
}

interface PingPointDashboardProps {
  onScanStateChange?: (status: string, startFn: () => void) => void;
}

export function PingPointDashboard({ onScanStateChange }: PingPointDashboardProps = {}) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<NetworkNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [metrics, setMetrics] = useState<PcapMetrics | null>(null);
  const { packets, devices, status, nmapScanResults, start } = useScan();
  const [llmResponse, setLLMResponse] = useState<string>("");
  const [llmLoading, setLlmLoading] = useState(false);
  const llmTriggeredRef = useRef(false);
  const [selectedIp, setSelectedIp] = useState<string | null>(null);
  const ipToHostname = useAvahiHostnames(status === "scanning");

  const selectedDevice = useMemo<SelectedDevice | null>(() => {
    if (!selectedIp) return null;
    const d = devices[selectedIp];
    if (!d) return null;
    const packetCount = packets.filter(
      (p) => p.src_ip === selectedIp || p.dst_ip === selectedIp
    ).length;
    return {
      ip: selectedIp,
      hostname: d.hostname,
      mac: d.mac,
      vendor: d.vendor,
      packetCount,
    };
  }, [selectedIp, devices, packets]);

  const handleNodeSelect = useCallback(
    (node: { data: { ip?: string } } | null) => setSelectedIp(node?.data.ip ?? null),
    []
  );

  const timeSeriesData = useMemo<TimeSeriesPoint[]>(() => {
    if (packets.length === 0) return [];
    const toMs = (t: string | number) =>
      typeof t === "number" ? t : new Date(String(t)).getTime();
    const firstTs = toMs(packets[0]?.timestamp ?? 0);
    const buckets = new Map<number, number>();
    const BUCKET_SEC = 5;
    for (const p of packets) {
      const ms = toMs(p.timestamp);
      const bucket = Math.max(0, Math.floor((ms - firstTs) / 1000 / BUCKET_SEC));
      buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
    }
    const maxBucket = Math.max(0, ...buckets.keys());
    return Array.from({ length: maxBucket + 1 }, (_, i) => ({
      time: i * BUCKET_SEC,
      count: buckets.get(i) ?? 0,
    }));
  }, [packets]);

  const summary: PcapSummary | null = useMemo(
    () =>
      metrics
        ? { deviceCount: metrics.deviceCount, connectionCount: metrics.connectionCount }
        : null,
    [metrics]
  );

  useEffect(() => {
    const deviceIps = [...Object.keys(devices)].sort();
    const connectionKeys = new Set<string>();
    const packetCounts = new Map<string, number>();

    for (const pkt of packets) {
      const { src_ip, dst_ip } = pkt;
      if (!src_ip || !dst_ip) continue;
      const key = src_ip < dst_ip ? `${src_ip}|${dst_ip}` : `${dst_ip}|${src_ip}`;
      connectionKeys.add(key);
      packetCounts.set(src_ip, (packetCounts.get(src_ip) ?? 0) + 1);
      packetCounts.set(dst_ip, (packetCounts.get(dst_ip) ?? 0) + 1);
    }

    setNodes((prev) => {
      const prevMap = new Map(prev.map((n) => [n.id, n]));
      const nodes = deviceIps.map((ip, index) => {
        const existing = prevMap.get(ip);
        const { x, y } = hexWebPosition(index);
        const hostname = devices[ip]?.hostname ?? ipToHostname.get(ip) ?? null;
        const rawLabel = hostname ?? ip;
        const label = truncateLabel(rawLabel);
        const count = packetCounts.get(ip) ?? 0;
        if (
          existing &&
          existing.position.x === x &&
          existing.position.y === y &&
          existing.data.label === label &&
          existing.data.packetCount === count
        ) {
          return existing;
        }
        return makeNode(ip, index, ipToHostname, devices[ip], count);
      });
      return nodes;
    });

    setEdges((prev) => {
      const prevMap = new Map(prev.map((e) => [e.id, e]));
      const edgeIds = Array.from(connectionKeys);
      const same =
        prev.length === edgeIds.length &&
        prev.every((e) => connectionKeys.has(e.id));
      if (same) return prev;
      return edgeIds.map((key) => {
        const existing = prevMap.get(key);
        if (existing) return existing;
        const [a, b] = key.split("|");
        return { id: key, source: a, target: b };
      });
    });
    setMetrics({
      deviceCount: deviceIps.length,
      connectionCount: connectionKeys.size,
      packetCount: packets.length,
    });
  }, [packets, devices, ipToHostname]);

  // Trigger LLM when scan completes. Status goes "done" -> "nmap-scanning" in same batch
  // when there are devices, so we rarely see "done". Trigger on "nmap-scanning" (packet scan
  // done, nmap starting), "complete" (includes nmap), or "done" (0 devices).
  useEffect(() => {
    console.log("[LLM] Effect run", { status, llmTriggered: llmTriggeredRef.current, deviceCount: Object.keys(devices).length, packetCount: packets.length });
    const shouldTrigger = status === "done" || status === "nmap-scanning" || status === "complete";
    if (!shouldTrigger || llmTriggeredRef.current) {
      console.log("[LLM] Skipping (wrong status or already triggered)");
      return;
    }
    console.log("[LLM] Triggering Claude request", { packets: packets.length, devices: Object.keys(devices).length, nmapScanResults: nmapScanResults.length });
    llmTriggeredRef.current = true;
    setLlmLoading(true);
    setLLMResponse("");
    let firstChunk = true;
    const flatNmapResults = nmapScanResults.flatMap((r) => r.results);
    generateLLMResponse(packets, devices, (chunk) => {
      if (firstChunk) {
        setLlmLoading(false);
        firstChunk = false;
      }
      setLLMResponse((prev) => prev + chunk);
    }, flatNmapResults)
      .then(() => console.log("[LLM] Claude stream finished"))
      .catch((err) => {
        console.error("[LLM] Claude request failed", err);
        toast.error("Security analysis failed", {
          description: err instanceof Error ? err.message : "Unable to generate AI analysis. Check your API key and connection.",
        });
      })
      .finally(() => setLlmLoading(false));
  }, [status, packets, devices, nmapScanResults]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-hidden">
      <div className="flex min-h-0 flex-1 overflow-hidden gap-6">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
          <NetworkGraph
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange as (changes: unknown[]) => void}
            onEdgesChange={onEdgesChange}
            onNodeSelect={handleNodeSelect}
            className="min-h-0 flex-1"
          />
          <MetricsBar metrics={metrics} />
          <PacketTimeGraph
            data={timeSeriesData}
            isStreaming={status === "scanning"}
            summary={summary}
          />
        </div>
        <AnimatePresence>
          {(llmLoading || llmResponse) && (
            <motion.aside
              key="ai-summary"
              initial={{ x: -400, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -400, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="flex shrink-0 basis-[380px] flex-col overflow-hidden gap-4"
            >
              <Card className="flex flex-col overflow-hidden">
                <CardContent className="flex flex-1 flex-col gap-2 overflow-y-auto py-4">
                  <h3 className="text-sm font-semibold">Security Analysis</h3>
                  {llmLoading ? (
                    <p className="text-sm text-muted-foreground">Analyzing network traffic...</p>
                  ) : (
                    <p className="whitespace-pre-wrap text-sm">{llmResponse}</p>
                  )}
                </CardContent>
              </Card>
              
              {nmapScanResults.length > 0 && (
                <Card className="flex flex-col overflow-hidden">
                  <CardContent className="py-4">
                    <h3 className="text-sm font-semibold mb-3">Nmap Scan Results</h3>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {nmapScanResults.slice(-3).map((scanResult, index) => (
                        <div key={index} className="text-xs p-3 bg-muted rounded">
                          <div className="font-medium mb-2">{scanResult.message}</div>
                          <div className="text-muted-foreground text-xs mb-2">
                            {new Date(scanResult.timestamp).toLocaleTimeString()}
                          </div>
                          <div className="space-y-2">
                            {scanResult.results.map((result, resultIndex) => (
                              <div key={resultIndex} className="border-l-2 border-primary/20 pl-2">
                                <div className="font-medium">{result.ip}</div>
                                <div className="text-xs text-muted-foreground">
                                  Return code: {result.returncode ?? "timeout"}
                                </div>
                                {result.stdout && (
                                  <div className="mt-1 text-xs bg-background p-2 rounded font-mono overflow-x-auto">
                                    {result.stdout.slice(0, 200)}{result.stdout.length > 200 ? "..." : ""}
                                  </div>
                                )}
                                {result.stderr && (
                                  <div className="mt-1 text-xs text-destructive">
                                    Error: {result.stderr.slice(0, 100)}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
