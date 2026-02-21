"use client";

import { useState } from "react";
import NetworkGraph from "./NetworkGraph";
import DevicePanel from "./DevicePanel";
import MetricsBar from "./MetricsBar";
import type { Node } from "@xyflow/react";
import type { NetworkNodeData } from "./NetworkGraph";

export function PingPointDashboard() {
  // Ready for websocket: update nodes/edges here when PCAP stream arrives
  const [nodes, setNodes] = useState<Node<NetworkNodeData>[] | undefined>();
  const [selectedNode, setSelectedNode] = useState<Node<NetworkNodeData> | null>(null);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <div className="flex min-h-[500px] flex-col">
          <NetworkGraph
            nodes={nodes}
            onNodeSelect={setSelectedNode}
            className="flex-1"
          />
        </div>
        <aside className="flex min-h-0 flex-col lg:max-h-[700px]">
          <DevicePanel />
        </aside>
      </div>

      <MetricsBar />
    </div>
  );
}
