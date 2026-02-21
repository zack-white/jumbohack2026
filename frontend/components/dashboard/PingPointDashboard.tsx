"use client";

import { useCallback, useRef } from "react";
import { useNodesState, useEdgesState } from "@xyflow/react";
import type { Node, Edge } from "@xyflow/react";
import NetworkGraph, {
  defaultNodes,
  defaultEdges,
  type NetworkNodeData,
} from "./NetworkGraph";
import DevicePanel from "./DevicePanel";
import MetricsBar from "./MetricsBar";
import { parsePcap } from "@/lib/pcapParser";

const NODE_SPACING = 180;
const COLS = 6;

function pcapToNodesAndEdges(
  hosts: { ip: string; hostname?: string; packetCount: number }[],
  connections: { srcIp: string; dstIp: string; packetCount: number }[]
): { nodes: Node<NetworkNodeData>[]; edges: Edge[] } {
  const ipToId = new Map<string, string>();
  hosts.forEach((h, i) => ipToId.set(h.ip, h.ip));

  const nodes: Node<NetworkNodeData>[] = hosts.map((h, i) => {
    const row = Math.floor(i / COLS);
    const col = i % COLS;
    const x = 100 + col * NODE_SPACING;
    const y = 80 + row * NODE_SPACING;
    return {
      id: h.ip,
      type: "device",
      position: { x, y },
      data: {
        label: h.hostname ?? h.ip,
        ip: h.ip,
        risk: "none" as const,
      },
    };
  });

  const seen = new Set<string>();
  const edges: Edge[] = [];
  for (const c of connections) {
    if (!ipToId.has(c.srcIp) || !ipToId.has(c.dstIp)) continue;
    const key = c.srcIp < c.dstIp ? `${c.srcIp}-${c.dstIp}` : `${c.dstIp}-${c.srcIp}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({
      id: `e-${key}`,
      source: c.srcIp,
      target: c.dstIp,
    });
  }

  return { nodes, edges };
}

export function PingPointDashboard() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<NetworkNodeData>>(defaultNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(defaultEdges);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePcapUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const buffer = reader.result as ArrayBuffer;
          const { hosts, connections } = parsePcap(buffer);
          if (hosts.length === 0) {
            return;
          }
          const { nodes: newNodes, edges: newEdges } = pcapToNodesAndEdges(
            hosts,
            connections
          );
          setNodes(newNodes);
          setEdges(newEdges);
        } catch {
          // ignore parse errors
        }
      };
      reader.readAsArrayBuffer(file);
      e.target.value = "";
    },
    [setNodes, setEdges]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-hidden">
      <div className="flex items-center gap-4">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pcap,.cap,application/vnd.tcpdump.pcap"
          onChange={handlePcapUpload}
          className="hidden"
          aria-label="Upload PCAP"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          Upload PCAP
        </button>
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

      <MetricsBar />
    </div>
  );
}
