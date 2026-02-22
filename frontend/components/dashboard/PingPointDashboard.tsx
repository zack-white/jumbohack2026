"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useNodesState, useEdgesState } from "@xyflow/react";
import type { Node, Edge } from "@xyflow/react";
import NetworkGraph, { type NetworkNodeData } from "./NetworkGraph";
import DevicePanel, { type SelectedDevice } from "./DevicePanel";
import MetricsBar, { type PcapMetrics } from "./MetricsBar";
import PacketTimeGraph, { type TimeSeriesPoint, type PcapSummary } from "./PacketTimeGraph";
import { useScan } from "@/hooks/useScan";
import { useAvahiHostnames } from "@/hooks/useAvahiHostnames";
import { generateLLMResponse } from "@/lib/generate-llm-response";

const HEX_RADIUS = 140;
const CENTER_X = 280;
const CENTER_Y = 200;
const LABEL_MAX_LEN = 16;

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
  ipToHostname: Map<string, string>
): Node<NetworkNodeData> {
  const { x, y } = hexWebPosition(index);
  const rawLabel = ipToHostname.get(ip) ?? ip;
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
    },
  };
}

export function PingPointDashboard() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<NetworkNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [metrics, setMetrics] = useState<PcapMetrics | null>(null);
  const { packets, devices, status, start } = useScan();
  const [llmResponse, setLLMResponse] = useState<string>("");
  const [llmLoading, setLlmLoading] = useState(false);
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

    for (const pkt of packets) {
      const { src_ip, dst_ip } = pkt;
      if (!src_ip || !dst_ip) continue;
      const key = src_ip < dst_ip ? `${src_ip}|${dst_ip}` : `${dst_ip}|${src_ip}`;
      connectionKeys.add(key);
    }

    setNodes((prev) => {
      const prevMap = new Map(prev.map((n) => [n.id, n]));
      const nodes = deviceIps.map((ip, index) => {
        const existing = prevMap.get(ip);
        const { x, y } = hexWebPosition(index);
        const label = ipToHostname.get(ip) ?? ip;
        if (
          existing &&
          existing.position.x === x &&
          existing.position.y === y &&
          existing.data.label === label
        ) {
          return existing;
        }
        return makeNode(ip, index, ipToHostname);
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

  useEffect(() => {
    if (status === "done") {
      setLlmLoading(true);
      setLLMResponse("");
      let firstChunk = true;
      generateLLMResponse(packets, devices, (chunk) => {
        if (firstChunk) {
          setLlmLoading(false);
          firstChunk = false;
        }
        setLLMResponse((prev) => prev + chunk);
      }).finally(() => setLlmLoading(false));
    }
  }, [status]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-hidden">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => start()}
          disabled={status === "scanning"}
          className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
        >
          {status === "scanning" ? "Scanning..." : "Start Scan"}
        </button>
        <span className="text-sm text-muted-foreground">Status: {status}</span>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <div className="flex min-h-0 flex-col gap-4">
          <NetworkGraph
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange as (changes: unknown[]) => void}
            onEdgesChange={onEdgesChange}
            onNodeSelect={handleNodeSelect}
            className="min-h-0 flex-1"
          />
          <PacketTimeGraph
            data={timeSeriesData}
            isStreaming={status === "scanning"}
            summary={summary}
          />
        </div>
        <aside className="flex min-h-0 flex-col gap-4 overflow-hidden">
          <MetricsBar metrics={metrics} />
          <DevicePanel device={selectedDevice} onClose={() => setSelectedIp(null)} />
          {(llmLoading || llmResponse) && (
            <div className="flex flex-col gap-2 overflow-y-auto rounded-lg border border-border p-4">
              <h3 className="text-sm font-semibold">Security Analysis</h3>
              {llmLoading ? (
                <p className="text-sm text-muted-foreground">Analyzing network traffic...</p>
              ) : (
                <p className="whitespace-pre-wrap text-sm">{llmResponse}</p>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
