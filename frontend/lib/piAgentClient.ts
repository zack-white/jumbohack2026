/**
 * Pi Agent API client - calls Next.js proxy routes (/api/pi/*)
 * which forward to the Raspberry Pi HTTP server.
 */

import type {
  ScanRequest,
  ScanResponse,
  AnalyzeRequest,
  AnalyzeResponse,
  PiAgentError,
} from "./piAgentTypes";

const API_BASE = "/api/pi";

function parseErrorResponse(response: Response, bodyText: string): PiAgentError {
  let body: unknown;
  try {
    body = JSON.parse(bodyText);
  } catch {
    body = bodyText;
  }
  return {
    status: response.status,
    message: response.statusText || "Request failed",
    body,
  };
}

async function handleResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!response.ok) {
    const err = parseErrorResponse(response, text);
    throw err;
  }
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw { status: 0, message: "Invalid JSON response", body: text } as PiAgentError;
  }
}

/** GET /api/pi/ping -> raw Pi response (for testing) */
export async function getNetwork(): Promise<unknown> {
  const res = await fetch(`${API_BASE}/ping`, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  return handleResponse<unknown>(res);
}

/** POST /api/pi/scan -> Run Scapy+Nmap scan */
export async function runScan(req: ScanRequest): Promise<ScanResponse> {
  const res = await fetch(`${API_BASE}/scan`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(req),
    cache: "no-store",
  });
  return handleResponse<ScanResponse>(res);
}

/** POST /api/pi/llm -> Run LLM analysis on scan data */
export async function analyze(req: AnalyzeRequest): Promise<AnalyzeResponse> {
  const res = await fetch(`${API_BASE}/llm`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(req),
    cache: "no-store",
  });
  return handleResponse<AnalyzeResponse>(res);
}
