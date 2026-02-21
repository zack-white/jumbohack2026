"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PcapMetrics {
  deviceCount: number;
  connectionCount: number;
  packetCount: number;
}

interface MetricsBarProps {
  className?: string;
  metrics?: PcapMetrics | null;
}

export default function MetricsBar({ className, metrics }: MetricsBarProps) {
  const hasData = metrics && (metrics.deviceCount > 0 || metrics.packetCount > 0);

  return (
    <Card className={cn(className)}>
      <CardContent className="flex flex-row flex-wrap items-center justify-between gap-6 py-4">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">Devices</span>
          <span className="font-semibold">
            {hasData ? metrics!.deviceCount.toLocaleString() : "—"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">Connections</span>
          <span className="font-semibold">
            {hasData ? metrics!.connectionCount.toLocaleString() : "—"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">Packets</span>
          <span className="font-semibold">
            {hasData ? metrics!.packetCount.toLocaleString() : "—"}
          </span>
          <Info className="text-muted-foreground h-3.5 w-3.5" aria-hidden />
        </div>
      </CardContent>
    </Card>
  );
}
