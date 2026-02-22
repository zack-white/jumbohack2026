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
    .then((res) => {
      clearTimeout(id);
      if (!res.ok) return new Map<string, string>();
      return res.json();
    })
    .then((data: unknown) => {
      const d = data as { type?: string; devices?: { ip: string; hostname: string }[] };
      if (d?.type === "avahi_ip_hostnames" && Array.isArray(d.devices)) {
        const map = new Map<string, string>();
        for (const item of d.devices) {
          if (item?.ip && item?.hostname) map.set(item.ip, item.hostname);
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
