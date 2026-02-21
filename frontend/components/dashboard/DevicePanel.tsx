"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { X, Laptop, Tv, Gamepad2 } from "lucide-react";

export default function DevicePanel() {
  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-4">
        <h2 className="text-lg font-semibold">Hannah&apos;s Laptop</h2>
        <button
          type="button"
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4 overflow-auto">
        <dl className="space-y-1 text-sm">
          <div>
            <dt className="text-muted-foreground">Risk status</dt>
            <dd>Slight risk</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">IP address</dt>
            <dd>125.152.1.251</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Packets (24hr)</dt>
            <dd>42,124</dd>
          </div>
        </dl>
        <div>
          <h3 className="text-muted-foreground text-xs font-medium uppercase">AI summary</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et
            dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex
            ea commodo consequat.
          </p>
        </div>

        <div className="border-t pt-4">
          <h3 className="mb-3 font-semibold">Summary</h3>
          <p className="text-muted-foreground mb-4 text-sm">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Duis aute irure dolor in reprehenderit in
            voluptate velit esse cillum dolore eu fugiat nulla pariatur. <span className="text-green-600">Safe</span>.
          </p>
          <div className="space-y-3">
            <div>
              <h4 className="text-muted-foreground mb-1 text-xs font-medium">What&apos;s normal</h4>
              <ul className="text-muted-foreground list-inside list-disc text-sm">
                <li>Lorem ipsum dolor sit amet.</li>
                <li>Consectetur adipiscing elit.</li>
              </ul>
            </div>
            <div>
              <h4 className="text-muted-foreground mb-2 text-xs font-medium">What you should pay attention to</h4>
              <ul className="space-y-2">
                <li className="flex gap-2 rounded border p-2">
                  <Laptop className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  <div>
                    <span className="font-medium">Hannah&apos;s Laptop (192.168.1.5)</span>
                    <p className="text-muted-foreground text-xs">Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
                  </div>
                </li>
                <li className="flex gap-2 rounded border p-2">
                  <Tv className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  <div>
                    <span className="font-medium">Smart TV (192.168.1.7)</span>
                    <p className="text-muted-foreground text-xs">Lorem ipsum dolor sit amet, sed do eiusmod tempor.</p>
                  </div>
                </li>
                <li className="flex gap-2 rounded border p-2">
                  <Gamepad2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  <div>
                    <span className="font-medium">Gaming Console (192.168.1.20)</span>
                    <p className="text-muted-foreground text-xs">Lorem ipsum dolor sit amet, incididunt ut labore.</p>
                  </div>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-muted-foreground mb-1 text-xs font-medium">Everything else is fine</h4>
              <p className="text-muted-foreground text-sm">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut enim ad minim veniam.</p>
            </div>
          </div>
          <p className="text-muted-foreground mt-4 text-xs">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Duis aute irure dolor in reprehenderit.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
