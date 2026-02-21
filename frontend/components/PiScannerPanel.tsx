"use client";

import { useState } from "react";
import { getNetwork, runScan, analyze } from "@/lib/piAgentClient";
import type { ScanResponse, AnalyzeResponse, PiAgentError } from "@/lib/piAgentTypes";

type Status = "idle" | "running" | "error" | "success";

function formatJson(obj: unknown): string {
  return JSON.stringify(obj, null, 2);
}

function isPiAgentError(err: unknown): err is PiAgentError {
  return typeof err === "object" && err !== null && "status" in err && "message" in err;
}

export default function PiScannerPanel() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [cidr, setCidr] = useState("");
  const [pingResult, setPingResult] = useState<unknown>(null);
  const [scanResult, setScanResult] = useState<ScanResponse | null>(null);
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResponse | null>(null);

  function clearError() {
    setError(null);
  }

  function handleError(err: unknown) {
    setStatus("error");
    if (isPiAgentError(err)) {
      const body = err.body != null ? `\n${formatJson(err.body)}` : "";
      setError(`${err.message} (${err.status})${body}`);
    } else {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleGetNetwork() {
    setStatus("running");
    setError(null);
    try {
      const data = await getNetwork();
      setPingResult(data);
      const cidrGuess = typeof data === "object" && data !== null && "cidr_guess" in data && typeof (data as { cidr_guess?: string }).cidr_guess === "string"
        ? (data as { cidr_guess: string }).cidr_guess
        : undefined;
      if (cidrGuess && !cidr) setCidr(cidrGuess);
      setStatus("success");
    } catch (err) {
      handleError(err);
    }
  }

  async function handleRunScan() {
    const c = cidr.trim() || cidrFromPing;
    if (!c) {
      setError("Enter CIDR to scan");
      setStatus("error");
      return;
    }
    setStatus("running");
    setError(null);
    try {
      const data = await runScan({ cidr: c, scan_profile: "fast" });
      setScanResult(data);
      setStatus("success");
    } catch (err) {
      handleError(err);
    }
  }

  async function handleAnalyze() {
    if (!scanResult) {
      setError("Run Scan first");
      setStatus("error");
      return;
    }
    setStatus("running");
    setError(null);
    try {
      const data = await analyze({
        run_id: scanResult.run_id,
        data: scanResult,
      });
      setAnalyzeResult(data);
      setStatus("success");
    } catch (err) {
      handleError(err);
    }
  }

  const cidrFromPing =
    typeof pingResult === "object" &&
    pingResult !== null &&
    "cidr_guess" in pingResult &&
    typeof (pingResult as { cidr_guess?: string }).cidr_guess === "string"
      ? (pingResult as { cidr_guess: string }).cidr_guess
      : undefined;
  const canScan = !!cidr.trim() || !!cidrFromPing;
  const canAnalyze = !!scanResult;
  const isRunning = status === "running";

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold">Pi Network Scanner</h1>

      {/* CIDR input */}
      <div>
        <label htmlFor="cidr" className="block text-sm font-medium mb-1">
          CIDR (optional; autofills from ping)
        </label>
        <input
          id="cidr"
          type="text"
          value={cidr}
          onChange={(e) => { setCidr(e.target.value); clearError(); }}
          placeholder="e.g. 192.168.1.0/24"
          className="w-full px-3 py-2 border rounded text-black"
        />
      </div>

      {/* Buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleGetNetwork}
          disabled={isRunning}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          1) Ping
        </button>
        <button
          onClick={handleRunScan}
          disabled={isRunning || !canScan}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
        >
          2) Run Scan
        </button>
        <button
          onClick={handleAnalyze}
          disabled={isRunning || !canAnalyze}
          className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
        >
          3) Analyze
        </button>
      </div>

      {/* Status */}
      <div className="text-sm">
        Status:{" "}
        <span className={status === "error" ? "text-red-600" : status === "running" ? "text-amber-600" : "text-zinc-600"}>
          {status === "running" ? "Running..." : status === "error" ? "Error" : status === "success" ? "Success" : "Idle"}
        </span>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-100 text-red-800 rounded text-sm font-mono whitespace-pre-wrap">
          {error}
        </div>
      )}

      {/* Results */}
      {pingResult !== null && (
        <div>
          <h2 className="text-lg font-semibold mb-2">Ping Response</h2>
          <pre className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded overflow-auto text-sm">
            {formatJson(pingResult)}
          </pre>
        </div>
      )}

      {scanResult && (
        <div>
          <h2 className="text-lg font-semibold mb-2">Scan Result</h2>
          <pre className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded overflow-auto text-sm max-h-80">
            {formatJson(scanResult)}
          </pre>
        </div>
      )}

      {analyzeResult && (
        <div>
          <h2 className="text-lg font-semibold mb-2">Analysis</h2>
          <pre className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded overflow-auto text-sm">
            {formatJson(analyzeResult)}
          </pre>
        </div>
      )}
    </div>
  );
}
