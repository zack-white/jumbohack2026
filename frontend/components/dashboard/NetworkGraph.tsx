"use client";

import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { cn } from "@/lib/utils";
import { Monitor } from "lucide-react";

export type RiskLevel = "none" | "slight" | "medium" | "high";

export interface NetworkNodeData {
  label: string;
  risk?: RiskLevel;
  ip?: string;
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
        "flex flex-col items-center gap-1 rounded-lg border-2 bg-card p-2 transition-all",
        riskColors[risk],
        selected && "ring-2 ring-amber-400 ring-offset-2 ring-offset-background"
      )}
    >
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
      <Monitor className="h-6 w-6" />
      <span className="text-xs text-muted-foreground">{data.label}</span>
    </div>
  );
}

const nodeTypes = { device: DeviceNode };

const defaultNodes: Node<NetworkNodeData>[] = [
  { id: "1", type: "device", position: { x: 100, y: 80 }, data: { label: "Hannah's Laptop", risk: "slight" } },
  { id: "2", type: "device", position: { x: 300, y: 40 }, data: { label: "device", risk: "none" } },
  { id: "3", type: "device", position: { x: 300, y: 140 }, data: { label: "device", risk: "none" } },
  { id: "4", type: "device", position: { x: 500, y: 80 }, data: { label: "device", risk: "none" } },
  { id: "5", type: "device", position: { x: 100, y: 220 }, data: { label: "device", risk: "medium" } },
  { id: "6", type: "device", position: { x: 300, y: 260 }, data: { label: "device", risk: "high" } },
  { id: "7", type: "device", position: { x: 500, y: 200 }, data: { label: "device", risk: "none" } },
];

const defaultEdges: Edge[] = [
  { id: "e1-2", source: "1", target: "2" },
  { id: "e1-3", source: "1", target: "3" },
  { id: "e2-4", source: "2", target: "4" },
  { id: "e1-5", source: "1", target: "5" },
  { id: "e5-6", source: "5", target: "6" },
];

export { defaultNodes, defaultEdges };

export default function NetworkGraph({
  nodes = defaultNodes,
  edges = defaultEdges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeSelect,
  className,
}: NetworkGraphProps) {
  return (
    <div className={cn("h-full min-h-[400px] rounded-lg border border-border bg-black", className)}>
      <ReactFlow
        colorMode="dark"
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange ?? (() => {})}
        onEdgesChange={onEdgesChange ?? (() => {})}
        nodesDraggable
        nodesConnectable={false}
        onConnect={onConnect}
        onNodeClick={(_, node) => onNodeSelect?.(node)}
        onPaneClick={() => onNodeSelect?.(null)}
        nodeTypes={nodeTypes}
        defaultViewport={{ x: 0, y: 0, zoom: 0.9 }}
        fitView
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ style: { stroke: "#94a3b8" } }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#525252" className="opacity-50" />
        <Controls className="!bg-card !border-border" />
        <MiniMap
          nodeColor={(n) => {
            const risk = (n.data as NetworkNodeData).risk ?? "none";
            if (risk === "high") return "rgb(239 68 68)";
            if (risk === "medium") return "rgb(249 115 22)";
            if (risk === "slight") return "rgb(251 191 36)";
            return "rgb(96 165 250)";
          }}
          maskColor="rgba(0,0,0,0.4)"
          className="!bg-card !border-border"
        />
      </ReactFlow>
    </div>
  );
}
