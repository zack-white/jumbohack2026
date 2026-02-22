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
    console.log('[HEADER] handleScanStateChange called with status:', newStatus, 'startFn:', startFn);
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
        .button-spinner {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(35, 236, 255, 0.3);
          border-top-color: #23ECFF;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse-glow {
          0%, 100% {
            box-shadow: 0 0 0 2px rgba(35, 236, 255, 0.2), 0 0 10px rgba(35, 236, 255, 0.3);
          }
          50% {
            box-shadow: 0 0 0 2px rgba(35, 236, 255, 0.4), 0 0 20px rgba(35, 236, 255, 0.5);
          }
        }
        .rescan-button {
          background-color: black;
          border: 1px solid #23ECFF;
          color: #23ECFF;
          transition: all 0.2s ease;
          cursor: pointer;
        }
        .rescan-button:hover:not(:disabled) {
          background-color: rgba(35, 236, 255, 0.1);
          box-shadow: 0 0 0 2px rgba(35, 236, 255, 0.2);
        }
        .rescan-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .rescan-button.scanning {
          animation: pulse-glow 2s ease-in-out infinite;
          background-color: rgba(35, 236, 255, 0.05);
        }
      `}</style>
      <header className="flex shrink-0 items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center hover:opacity-80 transition-opacity">
            <img src="/text.svg" alt="PingPoint" className="h-8 w-auto" />
          </Link>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Last scanned timestamp */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>⟳</span>
            <span>Last update: {lastScanned ? `${Math.floor((new Date().getTime() - new Date(lastScanned).getTime()) / (1000 * 60))} minutes ago` : "never"}</span>
          </div>
          
          <button
            type="button"
            onClick={() => {
              console.log('[HEADER] Re-scan button clicked, startScanRef.current:', startScanRef.current);
              if (startScanRef.current) {
                startScanRef.current();
              }
            }}
            disabled={status === "scanning"}
            className={`rescan-button rounded-md px-4 py-2 text-sm font-medium ${status === "scanning" ? "scanning" : ""}`}
          >
            <span className="flex items-center gap-2">
              {status === "scanning" && <div className="button-spinner"></div>}
              {status === "scanning" ? "Scanning..." : lastScanned === null ? "Scan" : "Re-scan"}
            </span>
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
