"use client";

import Link from "next/link";
import { PingPointDashboard } from "@/components/dashboard/PingPointDashboard";
import { useState, useEffect, useCallback, useRef } from "react";

export default function DashboardPage() {
  // We'll get the scan state from a callback from the dashboard
  const [status, setStatus] = useState<string>("idle");
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const startScanRef = useRef<(() => void) | null>(null);

  // Track last scan completion time
  useEffect(() => {
    if (status === "done" || status === "complete") {
      setLastScanned(new Date().toISOString());
    }
  }, [status]);

  const handleScanStateChange = useCallback((newStatus: string, startFn: () => void) => {
    setStatus(newStatus);
    startScanRef.current = startFn;
  }, []);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <style jsx>{`
        .loader {
          --d: 8px;
          width: 2px;
          height: 2px;
          border-radius: 50%;
          color: #23ECFF;
          box-shadow:
            calc(1*var(--d))      calc(0*var(--d))     0 0,
            calc(0.707*var(--d))  calc(0.707*var(--d)) 0 0.5px,
            calc(0*var(--d))      calc(1*var(--d))     0 1px,
            calc(-0.707*var(--d)) calc(0.707*var(--d)) 0 1.5px,
            calc(-1*var(--d))     calc(0*var(--d))     0 2px,
            calc(-0.707*var(--d)) calc(-0.707*var(--d))0 2.5px,
            calc(0*var(--d))      calc(-1*var(--d))    0 3px;
          animation: l27 1s infinite steps(8);
        }
        @keyframes l27 {
          100% {transform: rotate(1turn)}
        }
      `}</style>
      <header className="flex shrink-0 items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center hover:opacity-80 transition-opacity">
            <img src="/text.svg" alt="PingPoint" className="h-8 w-auto" />
          </Link>
          
          {/* Status with animation */}
          <div className="flex items-center gap-3">
            {status === "scanning" && (
              <div className="loader"></div>
            )}
            <span className="text-sm text-muted-foreground">
              {status === "scanning" ? "Scanning..." : "Ready"}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Last scanned timestamp */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>⟳</span>
            <span>Last update {lastScanned ? `${Math.floor((new Date().getTime() - new Date(lastScanned).getTime()) / (1000 * 60))} minutes` : "never"} ago</span>
          </div>
          
          <button
            type="button"
            onClick={() => startScanRef.current && startScanRef.current()}
            disabled={status === "scanning"}
            className="rounded-md px-4 py-2 text-sm font-medium bg-black border transition-colors disabled:opacity-50"
            style={{ borderColor: "#23ECFF", color: "#23ECFF" }}
          >
            {status === "scanning" ? "Scanning..." : "Re-scan"}
          </button>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-6 overflow-hidden p-6">
        <PingPointDashboard 
          onScanStateChange={handleScanStateChange}
        />
      </main>
    </div>
  );
}
