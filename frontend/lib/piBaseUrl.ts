/** Normalize Pi base URL (strip trailing slashes), default to mDNS host */
export function getPiBaseUrl(): string {
  const url =
    process.env.PI_BASE_URL ||
    process.env.NEXT_PUBLIC_PI_BASE_URL ||
    "http://raspberrypi.local:8000";
  return url.replace(/\/+$/, "");
}
