"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Info } from "lucide-react";

export default function MetricsBar() {
  return (
    <Card>
      <CardContent className="flex flex-row flex-wrap items-center justify-between gap-6 py-4">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">Active connections</span>
          <span className="font-semibold">1,419 devices</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">Packets sent (24hr)</span>
          <span className="font-semibold">12,513 packets</span>
          <Info className="text-muted-foreground h-3.5 w-3.5" aria-hidden />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">Wifi signal</span>
          <span className="font-semibold">59% today</span>
          <Info className="text-muted-foreground h-3.5 w-3.5" aria-hidden />
        </div>
      </CardContent>
    </Card>
  );
}
