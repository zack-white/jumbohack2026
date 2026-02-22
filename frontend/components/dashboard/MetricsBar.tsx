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
    <div className="w-50 flex flex-col gap-6 self-start">
      <Card className={cn(className)}>
        <CardContent>
          <div className="flex flex-col gap-2">
            <p>Active Connections</p>
            <div className="flex h-16 flex-col items-start justify-center bg-background p-2 rounded">
              <p className={`text-2xl ${hasData && "font-bold"}`}>{hasData ? metrics!.connectionCount.toLocaleString() : "—"}</p>
              {hasData && <p className="text-xs text-muted-foreground">connections</p>}
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className={cn(className)}>
        <CardContent>
          <div className="flex flex-col gap-2">
            <p>Devices</p>
            <div className="flex h-16 flex-col items-start justify-center bg-background p-2 rounded">
              <p className={`text-2xl ${hasData && "font-bold"}`}>{hasData ? metrics!.deviceCount.toLocaleString() : "—"}</p>
              {hasData && <p className="text-xs text-muted-foreground">devices</p>}
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className={cn(className)}>
        <CardContent>
          <div className="flex flex-col gap-2">
            <p>Packets Sent</p>
            <div className="flex h-16 flex-col items-start justify-center bg-background p-2 rounded">
              <p className={`text-2xl ${hasData && "font-bold"}`}>{hasData ? metrics!.packetCount.toLocaleString() : "—"}</p>
              {hasData && <p className="text-xs text-muted-foreground">packets</p>}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
