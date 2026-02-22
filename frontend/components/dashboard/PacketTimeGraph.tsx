"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface TimeSeriesPoint {
  time: number; // seconds from start (x-axis)
  count: number; // requests in that time bucket
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
const CHART_H = 300;
const PAD = { top: 8, right: 16, bottom: 28, left: 48 };
const INNER_W = CHART_W - PAD.left - PAD.right;
const INNER_H = CHART_H - PAD.top - PAD.bottom;

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const frac = v / exp;
  const nice = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
  return Math.max(1, nice * exp);
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
  summary: _summary,
}: PacketTimeGraphProps) {
  const hasData = data.length >= 1 && data.some((d) => d.count > 0);

  if (!hasData) {
    return (
      <Card className={cn(className)}>
        <CardContent className="h-full">
          <div className="flex flex-col gap-2 h-full">
            <p>Network Traffic</p>
            <div className="text-muted-foreground text-sm flex h-full items-center justify-center bg-background p-2 rounded">
              {isStreaming
                ? "Collecting requests…"
                : "Start a scan to see incoming requests"}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalRequests = data.reduce((s, d) => s + d.count, 0);
  const duration = data[data.length - 1].time;
  const peakCount = Math.max(...data.map((d) => d.count));
  const peakAt = data.find((d) => d.count === peakCount)?.time ?? 0;
  const numBuckets = data.length;
  const avgPerBucket = numBuckets > 0 ? totalRequests / numBuckets : 0;

  const stats: { label: string; value: string }[] = [
    { label: "Total Requests", value: fmtCount(totalRequests) },
    { label: "Duration", value: fmtTime(duration) },
    { label: "Peak", value: `${fmtCount(peakCount)} req / 5s @ ${fmtTime(peakAt)}` },
    { label: "Avg", value: `${avgPerBucket.toFixed(1)} req / 5s` },
  ];

  const maxTime = data[data.length - 1].time;
  const yMax = niceMax(peakCount);

  const xS = (t: number) => (maxTime === 0 ? 0 : (t / maxTime) * INNER_W);
  const yS = (c: number) => INNER_H - (c / yMax) * INNER_H;

  const linePath = data
    .map((d, i) => `${i === 0 ? "M" : "L"}${xS(d.time).toFixed(1)},${yS(d.count).toFixed(1)}`)
    .join(" ");

  const areaPath = `${linePath} L${xS(maxTime).toFixed(1)},${INNER_H} L${xS(0)},${INNER_H} Z`;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(yMax * f));

  let xTicks = Array.from(
    { length: Math.floor(maxTime / 5) + 1 },
    (_, i) => i * 5
  ).filter((t) => t <= maxTime);
  if (xTicks.length === 0) xTicks = [0];

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardContent className="flex min-h-0 flex-1 flex-col pt-0">
        <div className="flex flex-col gap-3 h-full">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-md font-medium">Network Traffic</p>
            <div className="flex flex-wrap items-center gap-3">
              {stats.map((s) => (
                <div
                  key={s.label}
                  className="rounded-sm border border-border/60 bg-muted/40 px-3 py-1"
                >
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {s.label}
                  </span>
                  <span className="ml-2 text-sm font-semibold tabular-nums text-foreground">
                    {s.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex min-h-0 flex-1 bg-background/60 p-2 rounded-lg border border-border/60">
            <div className="min-h-0 min-w-0 flex-1">
              <svg
                viewBox={`0 0 ${CHART_W} ${CHART_H}`}
                className="w-full h-full"
                aria-label="Incoming requests over time"
              >
                <g transform={`translate(${PAD.left},${PAD.top})`}>
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

                  <path d={areaPath} fill="rgb(56,189,248)" fillOpacity={0.12} />

                  <path
                    d={linePath}
                    fill="none"
                    stroke="rgb(56,189,248)"
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />

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

                  <line
                    x1={0}
                    x2={0}
                    y1={0}
                    y2={INNER_H}
                    stroke="currentColor"
                    strokeOpacity={0.2}
                    strokeWidth={1}
                  />

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

                  <line
                    x1={0}
                    x2={INNER_W}
                    y1={INNER_H}
                    y2={INNER_H}
                    stroke="currentColor"
                    strokeOpacity={0.2}
                    strokeWidth={1}
                  />

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
                </g>
              </svg>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
