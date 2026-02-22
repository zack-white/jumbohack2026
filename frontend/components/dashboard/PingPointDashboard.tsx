"use client";

import { useEffect, useRef, useState } from "react";
import { useNodesState, useEdgesState } from "@xyflow/react";
import type { Node, Edge } from "@xyflow/react";
import NetworkGraph, {
  type NetworkNodeData,
} from "./NetworkGraph";
import DevicePanel from "./DevicePanel";
import MetricsBar, { type PcapMetrics } from "./MetricsBar";
import { useScan } from "@/hooks/useScan";

const NODE_SPACING = 180;
const COLS = 6;

function makeNode(ip: string, index: number): Node<NetworkNodeData> {
  const row = Math.floor(index / COLS);
  const col = index % COLS;
  const x = 100 + col * NODE_SPACING;
  const y = 80 + row * NODE_SPACING;
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

  const seenIps = useRef<Map<string, number>>(new Map());
  const seenConnections = useRef<Set<string>>(new Set());


  // Populate graph nodes and edges when new packets and devices are detected
  useEffect(() => {
    // Add nodes for each device we know about
    for (const ip of Object.keys(devices)) {
      if (!seenIps.current.has(ip)) {
        const index = seenIps.current.size;
        seenIps.current.set(ip, index);
        setNodes(prev => [...prev, makeNode(ip, index)]);
      }
    }

    // Add edges for each packet connection
    for (const pkt of packets) {
      const { src_ip, dst_ip } = pkt;
      if (!src_ip || !dst_ip) continue;
      const key = src_ip < dst_ip ? `${src_ip}|${dst_ip}` : `${dst_ip}|${src_ip}`;
      if (!seenConnections.current.has(key)) {
        seenConnections.current.add(key);
        setEdges(prev => [...prev, { id: key, source: src_ip, target: dst_ip }]);
      }
    }

    // Update metrics
    setMetrics({
      deviceCount: seenIps.current.size,
      connectionCount: seenConnections.current.size,
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
        <div className="flex min-h-0 flex-col">
          <NetworkGraph
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange as (changes: unknown[]) => void}
            onEdgesChange={onEdgesChange}
            className="min-h-0 flex-1"
          />
        </div>
        <aside className="flex min-h-0 flex-col overflow-hidden">
          <DevicePanel />
        </aside>
      </div>

      <MetricsBar metrics={metrics} />
    </div>
  );
}
