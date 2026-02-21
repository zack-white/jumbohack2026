// Pi Agent API types

/** Pi ping response: {"data": "ping"} for health check, or {"data": "IP_HERE"} when IP is returned */
export interface PingResponse {
  data: string; // "ping" | IP address
}

export interface NetworkInfo {
  pi_ip: string;
  hostname: string;
  iface: string;
  cidr_guess?: string;
  [key: string]: unknown;
}

export interface ScanRequest {
  cidr?: string;
  scan_profile?: string;
  [key: string]: unknown;
}

export interface DiscoveredHost {
  ip: string;
  mac?: string;
  [key: string]: unknown;
}

export interface PortInfo {
  port: number;
  proto: string;
  state: string;
  service?: string;
  [key: string]: unknown;
}

export interface NmapHost {
  ip: string;
  ports?: PortInfo[];
  [key: string]: unknown;
}

export interface ScanResponse {
  run_id: string;
  started_at: string;
  finished_at: string;
  discovered_hosts: DiscoveredHost[];
  nmap_hosts: NmapHost[];
  raw?: Record<string, unknown>;
}

export interface AnalyzeRequest {
  run_id: string;
  data: ScanResponse | Record<string, unknown>;
  question?: string;
}

export interface AnalyzeResponse {
  run_id: string;
  analysis: {
    summary: string;
    findings?: string[];
    risks?: string[];
    next_steps?: string[];
    [key: string]: unknown;
  };
  model?: string;
}

export interface PiAgentError {
  status: number;
  message: string;
  body?: string | unknown;
}
