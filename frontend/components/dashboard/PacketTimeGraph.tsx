"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface TimeSeriesPoint {
  time: number;  // seconds from start of capture
  count: number; // packets in that second
}

export interface PcapSummary {
  deviceCount: number;
  connectionCount: number;
}

interface PacketTimeGraphProps {
  className?: string;
  data: TimeSeriesPoint[];
  isStreaming?: boolean;
  summary?: PcapSummary | null;
}

const CHART_W = 900;
const CHART_H = 110;
const PAD = { top: 8, right: 16, bottom: 28, left: 48 };
const INNER_W = CHART_W - PAD.left - PAD.right;
const INNER_H = CHART_H - PAD.top - PAD.bottom;

function niceMax(v: number): number {
  if (v <= 0) return 10;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const frac = v / exp;
  const nice = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
  return nice * exp;
}

function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

function fmtTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

export default function PacketTimeGraph({
  className,
  data,
  isStreaming,
  summary,
}: PacketTimeGraphProps) {
  const hasData = data.length > 1;

  if (!hasData) {
    return (
      <Card className={cn(className)}>
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-sm font-medium">Packets over Time</CardTitle>
        </CardHeader>
        <CardContent className="flex h-16 items-center justify-center">
          <span className="text-muted-foreground text-sm">
            {isStreaming
              ? "Collecting packet data…"
              : "Upload a PCAP file to see the packet timeline"}
          </span>
        </CardContent>
      </Card>
    );
  }

  const totalPackets = data.reduce((s, d) => s + d.count, 0);
  const duration = data[data.length - 1].time;
  const peakPps = Math.max(...data.map((d) => d.count));
  const peakAt = data.find((d) => d.count === peakPps)?.time ?? 0;
  const avgPps = duration > 0 ? totalPackets / duration : totalPackets;

  const stats: { label: string; value: string }[] = [
    { label: "Total Packets", value: fmtCount(totalPackets) },
    { label: "Duration", value: fmtTime(duration) },
    { label: "Peak", value: `${fmtCount(peakPps)} pps @ ${fmtTime(peakAt)}` },
    { label: "Avg Rate", value: `${avgPps.toFixed(1)} pps` },
    ...(summary
      ? [
          { label: "Devices", value: summary.deviceCount.toLocaleString() },
          { label: "Connections", value: summary.connectionCount.toLocaleString() },
        ]
      : []),
  ];

  const maxTime = data[data.length - 1].time;
  const yMax = niceMax(peakPps);

  const xS = (t: number) => (maxTime === 0 ? 0 : (t / maxTime) * INNER_W);
  const yS = (c: number) => INNER_H - (c / yMax) * INNER_H;

  const linePath = data
    .map((d, i) => `${i === 0 ? "M" : "L"}${xS(d.time).toFixed(1)},${yS(d.count).toFixed(1)}`)
    .join(" ");

  const areaPath = `${linePath} L${xS(maxTime).toFixed(1)},${INNER_H} L${xS(0)},${INNER_H} Z`;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(yMax * f));

  const xTickCount = Math.min(7, maxTime + 1);
  const xStep = maxTime / (xTickCount - 1);
  const xTicks = Array.from({ length: xTickCount }, (_, i) =>
    Math.round(i * xStep)
  );

  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-1 pt-3">
        <CardTitle className="text-sm font-medium">Packets over Time</CardTitle>
      </CardHeader>
      <CardContent className="pb-3 pt-0">
        <div className="flex gap-6">
          {/* Line chart */}
          <div className="min-w-0 flex-1">
            <svg
              viewBox={`0 0 ${CHART_W} ${CHART_H}`}
              className="w-full"
              style={{ height: `${CHART_H}px` }}
              aria-label="Packets over time line chart"
            >
              <g transform={`translate(${PAD.left},${PAD.top})`}>
                {/* Horizontal grid lines */}
                {yTicks.map((tick) => (
                  <line
                    key={tick}
                    x1={0}
                    x2={INNER_W}
                    y1={yS(tick)}
                    y2={yS(tick)}
                    stroke="currentColor"
                    strokeOpacity={0.1}
                    strokeWidth={1}
                  />
                ))}

                {/* Area fill */}
                <path d={areaPath} fill="rgb(56,189,248)" fillOpacity={0.12} />

                {/* Line */}
                <path
                  d={linePath}
                  fill="none"
                  stroke="rgb(56,189,248)"
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />

                {/* Peak marker */}
                <line
                  x1={xS(peakAt)}
                  x2={xS(peakAt)}
                  y1={0}
                  y2={INNER_H}
                  stroke="rgb(56,189,248)"
                  strokeOpacity={0.3}
                  strokeWidth={1}
                  strokeDasharray="4 3"
                />

                {/* Y axis line */}
                <line
                  x1={0}
                  x2={0}
                  y1={0}
                  y2={INNER_H}
                  stroke="currentColor"
                  strokeOpacity={0.2}
                  strokeWidth={1}
                />

                {/* Y axis labels */}
                {yTicks.map((tick) => (
                  <text
                    key={tick}
                    x={-8}
                    y={yS(tick) + 4}
                    textAnchor="end"
                    fontSize={11}
                    fill="currentColor"
                    fillOpacity={0.5}
                  >
                    {fmtCount(tick)}
                  </text>
                ))}

                {/* X axis line */}
                <line
                  x1={0}
                  x2={INNER_W}
                  y1={INNER_H}
                  y2={INNER_H}
                  stroke="currentColor"
                  strokeOpacity={0.2}
                  strokeWidth={1}
                />

                {/* X axis labels */}
                {xTicks.map((tick) => (
                  <text
                    key={tick}
                    x={xS(tick)}
                    y={INNER_H + 18}
                    textAnchor="middle"
                    fontSize={11}
                    fill="currentColor"
                    fillOpacity={0.5}
                  >
                    {fmtTime(tick)}
                  </text>
                ))}

                {/* Y axis unit label */}
                <text
                  x={-PAD.left + 4}
                  y={INNER_H / 2}
                  textAnchor="middle"
                  fontSize={10}
                  fill="currentColor"
                  fillOpacity={0.4}
                  transform={`rotate(-90, ${-PAD.left + 4}, ${INNER_H / 2})`}
                >
                  pkts/s
                </text>
              </g>
            </svg>
          </div>

          {/* Stats grid */}
          <div className="grid min-w-[220px] grid-cols-2 content-around gap-x-6 gap-y-3 border-l pl-5">
            {stats.map((s) => (
              <div key={s.label}>
                <div className="text-muted-foreground text-[10px] leading-tight">{s.label}</div>
                <div className="text-xs font-semibold tabular-nums">{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
