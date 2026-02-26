#!/usr/bin/env python3
import argparse
import ipaddress
import json
import shutil
import subprocess
import sys
from datetime import datetime

DEFAULT_NMAP_ARGS = [
    "-sV",      # service/version detection
    "-T3",      # reasonable timing
    "--top-ports", "200",  # don’t nuke the network; adjust if you want
]

def is_reasonable_target(ip: str) -> bool:
    try:
        addr = ipaddress.ip_address(ip)
        return (
            not addr.is_multicast and
            not addr.is_loopback and
            not addr.is_unspecified
        )
    except ValueError:
        return False

def to_text(x):
    if x is None:
        return ""
    if isinstance(x, bytes):
        return x.decode(errors="replace")
    return str(x)

def load_ips(path: str) -> list[str]:
    with open(path, "r") as f:
        data = json.load(f)

    ips: list[str] = []

    # Format A: {"type":"ip_set","ips":[...]}
    if isinstance(data, dict) and "ips" in data and isinstance(data["ips"], list):
        ips = [str(ip).strip() for ip in data["ips"]]

    # Format B: {"type":"done","devices":{ "10.0.1.4": {...}, ... }}
    elif isinstance(data, dict) and "devices" in data and isinstance(data["devices"], dict):
        ips = list(data["devices"].keys())

    # Format C: devices dict keyed by ip: { "10.0.1.4": {...}, ... }
    elif isinstance(data, dict):
        ips = list(data.keys())

    else:
        raise ValueError("Input JSON must be an object containing an 'ips' list, a 'devices' dict, or be a devices dict keyed by IP.")

    # Validate + de-dupe + sort
    clean = sorted({ip for ip in ips if is_reasonable_target(ip)},
                   key=lambda s: tuple(int(x) for x in s.split(".")) if "." in s else (s,))
    return clean

def run_nmap(ip: str, nmap_args: list[str], timeout: int) -> dict:
    cmd = ["nmap", *nmap_args, ip]
    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
        return {
            "ip": ip,
            "returncode": proc.returncode,
            "stdout": to_text(proc.stdout),
            "stderr": to_text(proc.stderr),
        }
    except subprocess.TimeoutExpired as e:
        return {
            "ip": ip,
            "returncode": None,
            "stdout": to_text(getattr(e, "stdout", None)),
            "stderr": to_text(getattr(e, "stderr", None)) + "\nTimed out.",
            "error": "timeout",
        }

def main():
    parser = argparse.ArgumentParser(description="Run nmap on IPs discovered by scanner.py JSON output.")
    parser.add_argument("input", help="Path to scan_results.json (or a devices dict JSON).")
    parser.add_argument("-o", "--output", default="nmap_results.json", help="Output JSON file.")
    parser.add_argument("--timeout", type=int, default=60, help="Timeout per-host (seconds).")
    parser.add_argument("--args", default=None,
                        help="Override nmap args as a single quoted string, e.g. '--args \"-sV -T3 --top-ports 200\"'")
    parser.add_argument("--dry-run", action="store_true", help="Print targets/commands but don’t run nmap.")
    args = parser.parse_args()

    if shutil.which("nmap") is None:
        print("ERROR: nmap not found. Install it with: sudo apt-get update && sudo apt-get install -y nmap", file=sys.stderr)
        sys.exit(1)

    ips = load_ips(args.input)
    if not ips:
        print("No IPs found in input.", file=sys.stderr)
        sys.exit(2)

    if args.args:
        nmap_args = args.args.split()
    else:
        nmap_args = DEFAULT_NMAP_ARGS

    results = {
        "generated_at": datetime.now().isoformat(),
        "input": args.input,
        "nmap_args": nmap_args,
        "targets": ips,
        "hosts": [],
    }

    for ip in ips:
        cmd_preview = ["nmap", *nmap_args, ip]
        if args.dry_run:
            print("DRY:", " ".join(cmd_preview))
            continue

        print("Running:", " ".join(cmd_preview))
        host_res = run_nmap(ip, nmap_args=nmap_args, timeout=args.timeout)
        results["hosts"].append(host_res)

    with open(args.output, "w") as f:
        json.dump(results, f, indent=2)

    print(f"\nWrote {args.output}")
    if args.dry_run:
        print("(dry-run: no scans executed)")

if __name__ == "__main__":
    main()