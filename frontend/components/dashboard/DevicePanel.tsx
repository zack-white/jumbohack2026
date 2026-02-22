"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { X, Monitor } from "lucide-react";

export interface SelectedDevice {
  ip: string;
  hostname: string | null;
  mac: string | null;
  vendor: string;
  packetCount: number;
}

interface DevicePanelProps {
  device?: SelectedDevice | null;
  onClose?: () => void;
}

export default function DevicePanel({ device, onClose }: DevicePanelProps) {
  if (!device) {
    return (
      <Card className="flex h-full flex-col overflow-hidden">
        <CardContent className="flex flex-1 items-center justify-center py-12">
          <p className="text-center text-sm text-muted-foreground">
            Click a device on the graph<br />to see its details
          </p>
        </CardContent>
      </Card>
    );
  }

  const displayName = device.hostname ?? device.ip;

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-4">
        <div className="flex min-w-0 items-center gap-2">
          <Monitor className="h-5 w-5 shrink-0 text-muted-foreground" />
          <h2 className="truncate text-lg font-semibold" title={displayName}>
            {displayName}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4 overflow-auto">
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-xs font-medium uppercase text-muted-foreground">IP Address</dt>
            <dd className="mt-0.5 font-mono">{device.ip}</dd>
          </div>
          {device.mac && (
            <div>
              <dt className="text-xs font-medium uppercase text-muted-foreground">MAC Address</dt>
              <dd className="mt-0.5 font-mono">{device.mac}</dd>
            </div>
          )}
          <div>
            <dt className="text-xs font-medium uppercase text-muted-foreground">Vendor</dt>
            <dd className="mt-0.5">{device.vendor || "Unknown"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-muted-foreground">Packets (session)</dt>
            <dd className="mt-0.5">{device.packetCount.toLocaleString()}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
