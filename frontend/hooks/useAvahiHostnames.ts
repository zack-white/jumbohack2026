import { useEffect, useState } from "react";

const PING_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 5_000;

function fetchHostnames(): Promise<Map<string, string>> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);

  return fetch("/api/pi/ping", {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: controller.signal,
  })
    .then((res) => res.json())
    .then((data: { type?: string; devices?: { ip: string; hostname: string }[] }) => {
      clearTimeout(id);
      if (data?.type === "avahi_ip_hostnames" && Array.isArray(data.devices)) {
        const map = new Map<string, string>();
        for (const d of data.devices) {
          if (d?.ip && d?.hostname) map.set(d.ip, d.hostname);
        }
        return map;
      }
      return new Map<string, string>();
    })
    .catch(() => {
      clearTimeout(id);
      return new Map<string, string>();
    });
}

export function useAvahiHostnames(isScanning: boolean): Map<string, string> {
  const [ipToHostname, setIpToHostname] = useState<Map<string, string>>(
    () => new Map()
  );
  useEffect(() => {
    fetchHostnames().then(setIpToHostname);
  }, []);

  useEffect(() => {
    if (!isScanning) return;
    const interval = setInterval(() => {
      fetchHostnames().then(setIpToHostname);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isScanning]);

  return ipToHostname;
}
