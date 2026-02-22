"use client";

import { useEffect, useRef, useState } from "react";
import {
  ReactFlow,
  Controls,
  Handle,
  Position,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { cn } from "@/lib/utils";
import { Monitor } from "lucide-react";
import { AnimatedBeamEdge } from "./AnimatedBeamEdge";

function LatticeBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const NODE_COUNT = 200;
    const CONNECT_DIST = 100;
    const SPEED = 0.05;

    let width = 0;
    let height = 0;
    let rafId = 0;

    type LatticeNode = { x: number; y: number; vx: number; vy: number };
    let nodes: LatticeNode[] = [];

    function resize() {
      if (!canvas) return;
      width = canvas.offsetWidth;
      height = canvas.offsetHeight;
      canvas.width = width;
      canvas.height = height;
    }

    function init() {
      resize();
      nodes = Array.from({ length: NODE_COUNT }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * SPEED,
        vy: (Math.random() - 0.5) * SPEED,
      }));
    }

    function tick() {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);

      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0) { n.x = 0; n.vx *= -1; }
        if (n.x > width) { n.x = width; n.vx *= -1; }
        if (n.y < 0) { n.y = 0; n.vy *= -1; }
        if (n.y > height) { n.y = height; n.vy *= -1; }
      }

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONNECT_DIST) {
            const alpha = (1 - dist / CONNECT_DIST) * 0.15;
            ctx.strokeStyle = `rgba(55, 75, 85, ${alpha})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }

      for (const n of nodes) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, 1.8, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(10, 10, 11, 0.4)";
        ctx.fill();
      }

      rafId = requestAnimationFrame(tick);
    }

    init();
    tick();

    const ro = new ResizeObserver(() => resize());
    ro.observe(canvas);
    return () => { cancelAnimationFrame(rafId); ro.disconnect(); };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}

export type RiskLevel = "none" | "slight" | "medium" | "high";

export interface NetworkNodeData {
  label: string;
  labelFull?: string;
  risk?: RiskLevel;
  ip?: string;
  mac?: string | null;
  vendor?: string;
  hostname?: string | null;
  packetCount?: number;
  [key: string]: unknown;
}

export interface NetworkGraphProps {
  nodes?: Node<NetworkNodeData>[];
  edges?: Edge[];
  onNodesChange?: OnNodesChange;
  onEdgesChange?: OnEdgesChange;
  onConnect?: OnConnect;
  onNodeSelect?: (node: Node<NetworkNodeData> | null) => void;
  className?: string;
}

const riskColors: Record<RiskLevel, string> = {
  none: "stroke-blue-400",
  slight: "stroke-amber-400",
  medium: "stroke-orange-500",
  high: "stroke-red-500",
};

function DeviceNode({ data, selected }: { data: NetworkNodeData; selected?: boolean }) {
  const risk = data.risk ?? "none";

  return (
    <div
      className={cn(
        "flex min-w-[180px] flex-col items-center gap-2 rounded-lg border-2 bg-card px-4 py-3 transition-all",
        riskColors[risk],
        selected && "ring-2 ring-blue-400 ring-offset-2 ring-offset-background"
      )}
    >
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
      <Monitor className="h-8 w-8" />
      <span
        className="max-w-[200px] truncate text-sm text-muted-foreground"
        title={data.labelFull ?? data.label}
      >
        {data.label}
      </span>
    </div>
  );
}

const nodeTypes = { device: DeviceNode };
const edgeTypes = { animatedBeam: AnimatedBeamEdge };

export default function NetworkGraph({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeSelect,
  className,
}: NetworkGraphProps) {
  const [selectedData, setSelectedData] = useState<NetworkNodeData | null>(null);

  return (
    <div className={cn("relative h-full min-h-[400px] overflow-hidden rounded-lg border border-border bg-black", className)}>
      <LatticeBackground />
      <ReactFlow
        colorMode="dark"
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange ?? (() => {})}
        onEdgesChange={onEdgesChange ?? (() => {})}
        nodesDraggable
        nodesConnectable={false}
        onConnect={onConnect}
        onNodeClick={(_, node) => {
          onNodeSelect?.(node);
          setSelectedData(node.data);
        }}
        onPaneClick={() => {
          onNodeSelect?.(null);
          setSelectedData(null);
        }}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultViewport={{ x: 0, y: 0, zoom: 0.9 }}
        fitView
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ type: "animatedBeam", style: { stroke: "#94a3b8" } }}
      >
        <Controls className="!bg-card !border-border" showFitView={false} />
      </ReactFlow>

      {selectedData && (
        <div className="pointer-events-none absolute right-3 top-3 z-10 w-56 rounded-lg border border-border bg-card shadow-xl">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Monitor className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span
              className="truncate text-sm font-semibold"
              title={String(selectedData.hostname ?? selectedData.ip ?? "Unknown")}
            >
              {String(selectedData.hostname ?? selectedData.ip ?? "Unknown")}
            </span>
          </div>
          <dl className="space-y-1.5 px-3 py-2.5 text-xs">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">IP</dt>
              <dd className="font-mono">{selectedData.ip}</dd>
            </div>
            {selectedData.mac && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">MAC</dt>
                <dd className="font-mono">{String(selectedData.mac)}</dd>
              </div>
            )}
            {selectedData.vendor && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Vendor</dt>
                <dd className="text-right">{String(selectedData.vendor)}</dd>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Packets</dt>
              <dd>{Number(selectedData.packetCount ?? 0).toLocaleString()}</dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}
