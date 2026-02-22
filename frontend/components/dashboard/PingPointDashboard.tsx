"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { useNodesState, useEdgesState } from "@xyflow/react";
import type { Node, Edge } from "@xyflow/react";
import NetworkGraph, { type NetworkNodeData, type RiskLevel } from "./NetworkGraph";
import { type SelectedDevice } from "./DevicePanel";
import MetricsBar, { type PcapMetrics } from "./MetricsBar";
import PacketTimeGraph, { type TimeSeriesPoint, type PcapSummary } from "./PacketTimeGraph";
import { useScan } from "@/hooks/useScan";
import { useAvahiHostnames } from "@/hooks/useAvahiHostnames";
import { generateLLMResponse } from "@/lib/network-llm-response";
import { generateIPLLMResponse } from "@/lib/ip-based-llm-response";
import { Card, CardContent } from "../ui/card";

const HEX_RADIUS = 220;
const CENTER_X = 520;
const CENTER_Y = 320;
const LABEL_MAX_LEN = 24;

function truncateLabel(label: string): string {
  if (label.length <= LABEL_MAX_LEN) return label;
  return label.slice(0, LABEL_MAX_LEN - 2) + "…";
}

function hexWebPosition(index: number): { x: number; y: number } {
  if (index === 0) return { x: CENTER_X, y: CENTER_Y };
  let ring = 1;
  let cumulative = 1;
  while (cumulative + 6 * ring <= index) {
    cumulative += 6 * ring;
    ring++;
  }
  const posInRing = index - cumulative;
  const angle = (posInRing / (6 * ring)) * 2 * Math.PI - Math.PI / 2;
  const r = ring * HEX_RADIUS;
  return {
    x: CENTER_X + r * Math.cos(angle),
    y: CENTER_Y + r * Math.sin(angle),
  };
}

function makeNode(
  ip: string,
  index: number,
  ipToHostname: Map<string, string>,
  device?: { mac: string | null; vendor: string; hostname: string | null },
  packetCount?: number,
  risk: RiskLevel = "none"
): Node<NetworkNodeData> {
  const { x, y } = hexWebPosition(index);
  const hostname = device?.hostname ?? ipToHostname.get(ip) ?? null;
  const rawLabel = hostname ?? ip;
  const label = truncateLabel(rawLabel);
  return {
    id: ip,
    type: "device",
    position: { x, y },
    data: {
      label,
      labelFull: rawLabel,
      ip,
      risk,
      mac: device?.mac ?? null,
      vendor: device?.vendor ?? "",
      hostname,
      packetCount: packetCount ?? 0,
    },
  };
}

interface PingPointDashboardProps {
  onScanStateChange?: (status: string, startFn: () => void) => void;
}

// Device popup component moved outside of render function
const DevicePopup = ({
  selectedDevice,
  selectedNmapResults,
  status,
  ipLLMResponse,
  ipLLMLoading,
  onClose
}: {
  selectedDevice: SelectedDevice;
  selectedNmapResults: Array<{
    ip: string;
    returncode?: number | null;
    host_status?: string;
    open_ports?: Array<{
      port: string;
      state: string;
      service: string;
      version?: string;
    }>;
    os_info?: string | null;
    scan_stats?: {
      latency?: string;
      duration?: string;
    };
    stdout?: string;
    stderr?: string;
    error?: string;
  }>;
  status: string;
  ipLLMResponse: string;
  ipLLMLoading: boolean;
  onClose: () => void;
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="bg-background border border-border rounded-lg shadow-2xl max-w-3xl w-full max-h-[85vh] mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="text-lg font-semibold">Device Details</h3>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
          >
            ✕
          </button>
        </div>
        
        <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(85vh-120px)]">
          {/* Device Information */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">IP Address:</span>
              <div className="text-muted-foreground">{selectedDevice.ip}</div>
            </div>
            {selectedDevice.hostname && (
              <div>
                <span className="font-medium">Hostname:</span>
                <div className="text-muted-foreground">{selectedDevice.hostname}</div>
              </div>
            )}
            {selectedDevice.mac && (
              <div>
                <span className="font-medium">MAC Address:</span>
                <div className="text-muted-foreground font-mono text-xs">{selectedDevice.mac}</div>
              </div>
            )}
            {selectedDevice.vendor && (
              <div>
                <span className="font-medium">Vendor:</span>
                <div className="text-muted-foreground">{selectedDevice.vendor}</div>
              </div>
            )}
            <div>
              <span className="font-medium">Packet Count:</span>
              <div className="text-muted-foreground">{selectedDevice.packetCount}</div>
            </div>
          </div>

          {/* AI Device Summary */}
          <div className="border-t border-border pt-4">
            <h4 className="text-sm font-semibold mb-3">AI Device Summary</h4>
            {ipLLMLoading ? (
              <p className="text-sm text-muted-foreground">Analyzing device...</p>
            ) : ipLLMResponse === "__no_scan__" ? (
              <p className="text-sm text-muted-foreground">Scan the network to get a summary of this device.</p>
            ) : ipLLMResponse === "__scanning__" ? (
              <p className="text-sm text-muted-foreground">Scan in progress — check back once it completes.</p>
            ) : ipLLMResponse ? (
              <p className="whitespace-pre-wrap text-sm">{ipLLMResponse}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Waiting for network analysis to complete...</p>
            )}
          </div>

          {/* Nmap Results */}
          <div className="border-t border-border pt-4">
            <h4 className="text-sm font-semibold mb-3">Nmap Scan Results</h4>

            {selectedNmapResults.length > 0 ? (
              <div className="space-y-4">
                {selectedNmapResults.map((result, index) => (
                  <div key={index} className="border border-border rounded-lg p-4 bg-muted/50">
                    <div className="flex justify-between items-start mb-3">
                      <div className="space-y-1">
                        <span className="font-medium text-sm">{result.ip}</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-1 rounded ${
                            result.host_status === 'up' ? 'bg-green-100 text-green-800' :
                            result.host_status === 'down' ? 'bg-red-100 text-red-800' :
                            result.host_status === 'timeout' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {result.host_status || 'unknown'}
                          </span>
                          {result.scan_stats?.latency && (
                            <span className="text-xs text-muted-foreground">
                              Latency: {result.scan_stats.latency}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <div>Code: {result.returncode ?? "timeout"}</div>
                        {result.scan_stats?.duration && (
                          <div>Duration: {result.scan_stats.duration}</div>
                        )}
                      </div>
                    </div>

                    {/* Open Ports */}
                    {result.open_ports && result.open_ports.length > 0 && (
                      <div className="mb-3">
                        <div className="text-xs font-medium mb-2">Open Ports:</div>
                        <div className="space-y-2">
                          {result.open_ports.map((port, portIndex) => (
                            <div key={portIndex} className="bg-background p-2 rounded border">
                              <div className="flex justify-between items-start">
                                <div>
                                  <span className="font-mono text-sm font-medium">{port.port}</span>
                                  <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${
                                    port.state === 'open' ? 'bg-green-100 text-green-700' :
                                    port.state === 'closed' ? 'bg-red-100 text-red-700' :
                                    'bg-yellow-100 text-yellow-700'
                                  }`}>
                                    {port.state}
                                  </span>
                                </div>
                                <div className="text-right text-xs">
                                  <div className="font-medium">{port.service}</div>
                                  {port.version && (
                                    <div className="text-muted-foreground">{port.version}</div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* OS Information */}
                    {result.os_info && (
                      <div className="mb-3">
                        <div className="text-xs font-medium mb-2">OS Information:</div>
                        <div className="text-xs bg-background p-2 rounded border">
                          {result.os_info}
                        </div>
                      </div>
                    )}

                    {/* Raw output fallback */}
                    {result.stdout && (
                      <div className="mb-3">
                        <div className="text-xs font-medium mb-2">Raw Output:</div>
                        <div className="text-xs bg-background p-3 rounded border font-mono overflow-x-auto whitespace-pre-wrap max-h-32 overflow-y-auto">
                          {result.stdout}
                        </div>
                      </div>
                    )}
                    
                    {/* Error information */}
                    {(result.stderr || result.error) && (
                      <div className="mt-3">
                        <div className="text-xs font-medium mb-2 text-destructive">
                          {result.error === 'timeout' ? 'Scan Timeout' : 'Error'}:
                        </div>
                        <div className="text-xs bg-destructive/5 border border-destructive/20 p-2 rounded">
                          {result.error === 'timeout' ? 
                            'The scan timed out. The host may be unreachable or heavily firewalled.' : 
                            result.stderr
                          }
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground p-4 bg-muted/50 rounded border text-center">
                No nmap scan results available for this device.
                {status === "scanning" ? " Scan in progress..." : " Run a scan to see results."}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export function PingPointDashboard({ onScanStateChange }: PingPointDashboardProps = {}) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<NetworkNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [metrics, setMetrics] = useState<PcapMetrics | null>(null);
  const { packets, devices, status, nmapScanResults, start } = useScan();
  const [llmResponse, setLLMResponse] = useState<string>("");
  const [llmLoading, setLlmLoading] = useState(false);
  const llmTriggeredRef = useRef(false);
  const [selectedIp, setSelectedIp] = useState<string | null>(null);
  const [ipLLMResponse, setIPLLMResponse] = useState<string>("");
  const [ipLLMLoading, setIPLLMLoading] = useState(false);
  const ipToHostname = useAvahiHostnames(status === "scanning");

  console.log('[DASHBOARD] Current status:', status, 'start function:', typeof start);
  console.log('[DASHBOARD] Nmap results:', nmapScanResults?.length || 0, 'results available');
  console.log('[DASHBOARD] Devices:', Object.keys(devices).length, 'devices found');

  // Track nmap results changes  
  useEffect(() => {
    console.log('[NMAP] Nmap results updated:', nmapScanResults?.length || 0, 'scan results');
    if (nmapScanResults && nmapScanResults.length > 0) {
      console.log('[NMAP] First result structure:', nmapScanResults[0]);
      
      // Handle the actual backend format: { hosts: [...] }
      try {
        const allIps = nmapScanResults.flatMap(r => {
          if (r.hosts && Array.isArray(r.hosts)) {
            return r.hosts.map(host => host.ip);
          }
          // Fallback for other possible formats
          if (r.results && Array.isArray(r.results)) {
            return r.results.map(result => result.ip);
          }
          return [];
        });
        console.log('[NMAP] All scanned IPs:', allIps);
      } catch (error) {
        console.error('[NMAP] Error parsing nmap results:', error);
        console.log('[NMAP] Raw results structure:', JSON.stringify(nmapScanResults, null, 2));
      }
    }
  }, [nmapScanResults]);

  // Initial mount - notify parent immediately
  useEffect(() => {
    console.log('[DASHBOARD] Component mounted, notifying parent');
    if (onScanStateChange) {
      console.log('[DASHBOARD] Calling onScanStateChange with initial status:', status, 'start:', typeof start);
      onScanStateChange(status, start);
    }
  }, []); // Only on mount

  // Status change - notify parent when status changes
  useEffect(() => {
    console.log('[DASHBOARD] Status changed, notifying parent');
    if (onScanStateChange) {
      console.log('[DASHBOARD] Calling onScanStateChange with status:', status, 'start:', typeof start);
      onScanStateChange(status, start);
    }
  }, [status]); // Only when status changes

  const selectedDevice = useMemo<SelectedDevice | null>(() => {
    if (!selectedIp) return null;
    const d = devices[selectedIp];
    if (!d) return null;
    const packetCount = packets.filter(
      (p) => p.src_ip === selectedIp || p.dst_ip === selectedIp
    ).length;
    return {
      ip: selectedIp,
      hostname: d.hostname,
      mac: d.mac,
      vendor: d.vendor,
      packetCount,
    };
  }, [selectedIp, devices, packets]);

  const handleNodeSelect = useCallback(
    (node: { data: { ip?: string } } | null) => {
      setSelectedIp(node?.data.ip ?? null);
      console.log('[DASHBOARD] Node selected:', node?.data.ip);
    },
    []
  );

  // Get nmap results for the selected IP
  const selectedNmapResults = useMemo(() => {
    if (!selectedIp) return [];
    
    try {
      return nmapScanResults.flatMap(scanResult => {
        // Handle ACTUAL format with hosts array (from your backend: { hosts: [...] })
        if (scanResult.hosts && Array.isArray(scanResult.hosts)) {
          return scanResult.hosts.filter(host => host.ip === selectedIp);
        }
        // Fallback for other possible formats
        if (scanResult.results && Array.isArray(scanResult.results)) {
          return scanResult.results.filter(result => result.ip === selectedIp);
        }
        return [];
      });
    } catch (error) {
      console.error('[NMAP] Error filtering nmap results for IP:', selectedIp, error);
      return [];
    }
  }, [selectedIp, nmapScanResults]);

  // Trigger IP-specific LLM analysis when a device node is selected
  useEffect(() => {
    if (!selectedIp) {
      setIPLLMResponse("");
      return;
    }

    // No scan run yet
    if (packets.length === 0) {
      setIPLLMResponse("__no_scan__");
      return;
    }

    // Scan still in progress
    if (status === "scanning") {
      setIPLLMResponse("__scanning__");
      return;
    }

    const device = devices[selectedIp];
    if (!device) return;

    // Network analysis not ready yet — wait for it
    if (!llmResponse) return;

    setIPLLMResponse("");
    setIPLLMLoading(true);
    let firstChunk = true;
    generateIPLLMResponse(
      selectedIp,
      device,
      llmResponse,
      (chunk) => {
        if (firstChunk) { setIPLLMLoading(false); firstChunk = false; }
        setIPLLMResponse((prev) => prev + chunk);
      },
      selectedNmapResults
    )
      .catch((err) => {
        console.error("[LLM] IP analysis failed", err);
        setIPLLMResponse("Unable to generate device analysis.");
      })
      .finally(() => setIPLLMLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIp, llmResponse, status]);

  const timeSeriesData = useMemo<TimeSeriesPoint[]>(() => {
    if (packets.length === 0) return [];
    const toMs = (t: string | number) =>
      typeof t === "number" ? t : new Date(String(t)).getTime();
    const firstTs = toMs(packets[0]?.timestamp ?? 0);
    const buckets = new Map<number, number>();
    const BUCKET_SEC = 5;
    for (const p of packets) {
      const ms = toMs(p.timestamp);
      const bucket = Math.max(0, Math.floor((ms - firstTs) / 1000 / BUCKET_SEC));
      buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
    }
    const maxBucket = Math.max(0, ...buckets.keys());
    return Array.from({ length: maxBucket + 1 }, (_, i) => ({
      time: i * BUCKET_SEC,
      count: buckets.get(i) ?? 0,
    }));
  }, [packets]);

  const summary: PcapSummary | null = useMemo(
    () =>
      metrics
        ? { deviceCount: metrics.deviceCount, connectionCount: metrics.connectionCount }
        : null,
    [metrics]
  );

  useEffect(() => {
    const deviceIps = [...Object.keys(devices)].sort();
    const connectionKeys = new Set<string>();
    const packetCounts = new Map<string, number>();

    // SYN flood detection: count pure SYN packets per src_ip in a rolling 30s window.
    // samplesus.py sends TCP flags="S" with a fixed real src_ip, so we detect by src_ip.
    // Timestamps arrive as ISO strings from the backend, so convert with toMs().
    const SYN_WINDOW_MS = 30_000;
    const toMs = (t: string | number) =>
      typeof t === "number" ? t : new Date(String(t)).getTime();
    let latestTs = 0;
    for (const pkt of packets) {
      const ts = toMs(pkt.timestamp);
      if (ts > latestTs) latestTs = ts;
    }
    const synCounts = new Map<string, number>();

    for (const pkt of packets) {
      const { src_ip, dst_ip } = pkt;
      if (!src_ip || !dst_ip) continue;
      const key = src_ip < dst_ip ? `${src_ip}|${dst_ip}` : `${dst_ip}|${src_ip}`;
      connectionKeys.add(key);
      packetCounts.set(src_ip, (packetCounts.get(src_ip) ?? 0) + 1);
      packetCounts.set(dst_ip, (packetCounts.get(dst_ip) ?? 0) + 1);

      if (
        pkt.flags &&
        pkt.flags.includes("S") &&
        !pkt.flags.includes("A") &&
        latestTs - toMs(pkt.timestamp) <= SYN_WINDOW_MS
      ) {
        synCounts.set(src_ip, (synCounts.get(src_ip) ?? 0) + 1);
      }
    }

    setNodes((prev) => {
      const prevMap = new Map(prev.map((n) => [n.id, n]));
      const nodes = deviceIps.map((ip, index) => {
        const existing = prevMap.get(ip);
        const { x, y } = hexWebPosition(index);
        const hostname = devices[ip]?.hostname ?? ipToHostname.get(ip) ?? null;
        const rawLabel = hostname ?? ip;
        const label = truncateLabel(rawLabel);
        const count = packetCounts.get(ip) ?? 0;
        const synCount = synCounts.get(ip) ?? 0;
        const PI_IP = "10.0.1.6";
        const risk: RiskLevel =
          ip === PI_IP    ? "none" :
          synCount >= 20  ? "high" :
          synCount >= 10  ? "medium" :
          synCount >= 3   ? "slight" : "none";
        if (
          existing &&
          existing.position.x === x &&
          existing.position.y === y &&
          existing.data.label === label &&
          existing.data.packetCount === count &&
          existing.data.risk === risk
        ) {
          return existing;
        }
        return makeNode(ip, index, ipToHostname, devices[ip], count, risk);
      });
      return nodes;
    });

    setEdges((prev) => {
      const prevMap = new Map(prev.map((e) => [e.id, e]));
      const edgeIds = Array.from(connectionKeys);
      const same =
        prev.length === edgeIds.length &&
        prev.every((e) => connectionKeys.has(e.id));
      if (same) return prev;
      return edgeIds.map((key) => {
        const existing = prevMap.get(key);
        if (existing) return existing;
        const [a, b] = key.split("|");
        return { id: key, source: a, target: b };
      });
    });
    setMetrics({
      deviceCount: deviceIps.length,
      connectionCount: connectionKeys.size,
      packetCount: packets.length,
    });
  }, [packets, devices, ipToHostname]);

  useEffect(() => {
    const shouldTrigger = status === "done" || status === "nmap-scanning" || status === "complete";
    if (!shouldTrigger || llmTriggeredRef.current) return;
    llmTriggeredRef.current = true;
    setLlmLoading(true);
    setLLMResponse("");
    let firstChunk = true;
    // Flatten nmap results from the actual structure: { hosts: [...] } or { results: [...] }
    const flatNmapResults = nmapScanResults.flatMap((r) => r.hosts || r.results || []);
    generateLLMResponse(packets, devices, (chunk) => {
      if (firstChunk) { setLlmLoading(false); firstChunk = false; }
      setLLMResponse((prev) => prev + chunk);
    }, flatNmapResults)
      .catch((err) => {
        toast.error("Security analysis failed", {
          description: err instanceof Error ? err.message : "Unable to generate AI analysis.",
        });
      })
      .finally(() => setLlmLoading(false));
  }, [status, packets, devices, nmapScanResults]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-hidden">
      <div className="flex min-h-0 flex-1 overflow-hidden gap-6">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
          <div className="relative flex-1 min-h-0">
            <NetworkGraph
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange as (changes: unknown[]) => void}
              onEdgesChange={onEdgesChange}
              onNodeSelect={handleNodeSelect}
              className="min-h-0 flex-1"
            />
            
            {/* Device popup overlay */}
            <AnimatePresence>
              {selectedIp && selectedDevice && (
                <DevicePopup 
                  selectedDevice={selectedDevice}
                  selectedNmapResults={selectedNmapResults}
                  status={status}
                  ipLLMResponse={ipLLMResponse}
                  ipLLMLoading={ipLLMLoading}
                  onClose={() => setSelectedIp(null)}
                />
              )}
            </AnimatePresence>
          </div>
          <div className="flex flex-row gap-6">
            <MetricsBar metrics={metrics} />
            <PacketTimeGraph
              data={timeSeriesData}
              isStreaming={status === "scanning"}
              summary={summary}
              className="flex-1"
            />
          </div>
        </div>
        
        <AnimatePresence>
          {(llmLoading || llmResponse) && (
            <motion.aside
              key="ai-summary"
              initial={{ x: -400, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -400, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="flex shrink-0 basis-[380px] flex-col overflow-hidden gap-4"
            >
              <Card className="flex flex-col overflow-hidden">
                <CardContent className="flex flex-1 flex-col gap-2 overflow-y-auto py-4">
                  <h3 className="text-sm font-semibold">Security Analysis</h3>
                  {llmLoading ? (
                    <p className="text-sm text-muted-foreground">Analyzing network traffic...</p>
                  ) : (
                    <p className="whitespace-pre-wrap text-sm">{llmResponse}</p>
                  )}
                </CardContent>
              </Card>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
