"use client";

import { useEffect, useMemo, useState } from "react";
import { useNodesState, useEdgesState } from "@xyflow/react";
import type { Node, Edge } from "@xyflow/react";
import NetworkGraph, { type NetworkNodeData } from "./NetworkGraph";
import DevicePanel from "./DevicePanel";
import MetricsBar, { type PcapMetrics } from "./MetricsBar";
import PacketTimeGraph, { type TimeSeriesPoint, type PcapSummary } from "./PacketTimeGraph";
import { useScan } from "@/hooks/useScan";

const HEX_RADIUS = 100;
const CENTER_X = 200;
const CENTER_Y = 150;

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

function makeNode(ip: string, index: number): Node<NetworkNodeData> {
  const { x, y } = hexWebPosition(index);
  return {
    id: ip,
    type: "device",
    position: { x, y },
    data: {
      label: ip,
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
    const deviceIps = Object.keys(devices);
    const connectionKeys = new Set<string>();
    const degree = new Map<string, number>();

    for (const pkt of packets) {
      const { src_ip, dst_ip } = pkt;
      if (!src_ip || !dst_ip) continue;
      const key = src_ip < dst_ip ? `${src_ip}|${dst_ip}` : `${dst_ip}|${src_ip}`;
      connectionKeys.add(key);
      degree.set(src_ip, (degree.get(src_ip) ?? 0) + 1);
      degree.set(dst_ip, (degree.get(dst_ip) ?? 0) + 1);
    }

    const sortedIps = [...deviceIps].sort((a, b) => {
      const dA = degree.get(a) ?? 0;
      const dB = degree.get(b) ?? 0;
      return dB - dA;
    });

    const newNodes = sortedIps.map((ip, index) => makeNode(ip, index));
    const newEdges: Edge[] = Array.from(connectionKeys).map((key) => {
      const [a, b] = key.split("|");
      return { id: key, source: a, target: b };
    });

    setNodes(newNodes);
    setEdges(newEdges);
    setMetrics({
      deviceCount: deviceIps.length,
      connectionCount: connectionKeys.size,
      packetCount: packets.length,
    });
  }, [packets, devices]);

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
            className="min-h-0 flex-1"
          />
          <PacketTimeGraph
            data={timeSeriesData}
            isStreaming={status === "scanning"}
            summary={summary}
          />
        </div>
        <aside className="flex min-h-0 flex-col overflow-hidden">
          <MetricsBar metrics={metrics} />
          <DevicePanel />
        </aside>
      </div>
    </div>
  );
}
