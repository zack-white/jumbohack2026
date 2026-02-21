"use client";

import { useCallback, useRef, useState } from "react";
import { useNodesState, useEdgesState } from "@xyflow/react";
import type { Node, Edge } from "@xyflow/react";
import NetworkGraph, {
  defaultNodes,
  defaultEdges,
  type NetworkNodeData,
} from "./NetworkGraph";
import DevicePanel from "./DevicePanel";
import MetricsBar from "./MetricsBar";
import { parsePcapStream } from "@/lib/pcapParser";

const NODE_SPACING = 180;
const COLS = 6;
const EDGE_ANIMATION_DELAY_MS = 40;

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
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<NetworkNodeData>>(
    defaultNodes
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(defaultEdges);
  const [isStreaming, setIsStreaming] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handlePcapUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = "";

      abortRef.current?.abort();
      abortRef.current = new AbortController();
      const signal = abortRef.current.signal;

      setIsStreaming(true);
      setNodes([]);
      setEdges([]);

      const seenIps = new Map<string, number>();
      const seenConnections = new Set<string>();
      let nodeIndex = 0;

      const flushConnection = (srcIp: string, dstIp: string) => {
        const key =
          srcIp < dstIp ? `${srcIp}|${dstIp}` : `${dstIp}|${srcIp}`;
        if (seenConnections.has(key)) return;
        seenConnections.add(key);

        setNodes((prev) => {
          const next = [...prev];
          let changed = false;
          for (const ip of [srcIp, dstIp]) {
            if (!seenIps.has(ip)) {
              seenIps.set(ip, nodeIndex);
              nodeIndex++;
              next.push(makeNode(ip, seenIps.get(ip)!));
              changed = true;
            }
          }
          return changed ? next : prev;
        });

        setEdges((prev) => [
          ...prev,
          {
            id: `e-${key}`,
            source: srcIp,
            target: dstIp,
            animated: true,
          } as Edge,
        ]);
      };

      const connectionQueue: { srcIp: string; dstIp: string }[] = [];
      let flushScheduled = false;

      const scheduleFlush = () => {
        if (flushScheduled || connectionQueue.length === 0) return;
        flushScheduled = true;
        const processNext = () => {
          if (signal.aborted) return;
          const c = connectionQueue.shift();
          if (c) {
            flushConnection(c.srcIp, c.dstIp);
            setTimeout(processNext, EDGE_ANIMATION_DELAY_MS);
          } else {
            flushScheduled = false;
          }
        };
        setTimeout(processNext, EDGE_ANIMATION_DELAY_MS);
      };

      try {
        const stream = file.stream();
        for await (const { srcIp, dstIp } of parsePcapStream(stream)) {
          if (signal.aborted) break;
          connectionQueue.push({ srcIp, dstIp });
          scheduleFlush();
        }
        while (connectionQueue.length > 0 && !signal.aborted) {
          await new Promise((r) => setTimeout(r, EDGE_ANIMATION_DELAY_MS));
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error(err);
        }
      } finally {
        if (!signal.aborted) setIsStreaming(false);
      }
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
          disabled={isStreaming}
          className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
        >
          {isStreaming ? "Streaming..." : "Upload PCAP"}
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
