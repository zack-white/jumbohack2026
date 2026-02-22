#!/usr/bin/env python3
import argparse
import ipaddress
import json
import shutil
import subprocess
import sys
from datetime import datetime
from typing import Set, List, Dict, AsyncGenerator
import asyncio

DEFAULT_NMAP_ARGS = [
    "-sV",      # service/version detection
    "-T3",      # reasonable timing
    "--top-ports", "200",  # don't nuke the network; adjust if you want
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

def clean_nmap_output(stdout: str) -> dict:
    """
    Parse nmap output and extract structured information, removing verbose fingerprint data.
    """
    lines = stdout.splitlines()
    
    # Remove fingerprint sections and other verbose output
    cleaned_lines = []
    skip_section = False
    
    for line in lines:
        # Skip fingerprint sections
        if "services unrecognized despite returning data" in line:
            skip_section = True
            continue
        if skip_section and line.startswith("==============NEXT SERVICE FINGERPRINT"):
            continue
        if skip_section and line.strip() == "":
            skip_section = False
            continue
        if skip_section:
            continue
        
        # Skip other verbose sections
        if "Please report any incorrect results at https://nmap.org/submit/" in line:
            continue
        if line.startswith("SF-Port") or line.startswith("SF:"):
            continue
            
        cleaned_lines.append(line)
    
    cleaned_output = "\n".join(cleaned_lines).strip()
    
    # Parse structured data from the cleaned output
    result = {
        "raw_output": cleaned_output,
        "host_status": "unknown",
        "open_ports": [],
        "os_info": None,
        "scan_stats": {}
    }
    
    # Extract host status
    for line in cleaned_lines:
        if "Host is up" in line:
            result["host_status"] = "up"
            # Extract latency if available
            if "latency" in line.lower():
                import re
                latency_match = re.search(r'(\d+\.?\d*)(m?s)', line)
                if latency_match:
                    result["scan_stats"]["latency"] = latency_match.group(1) + latency_match.group(2)
        elif "Host seems down" in line or "Note: Host seems down" in line:
            result["host_status"] = "down"
    
    # Extract open ports and services
    port_section = False
    for line in cleaned_lines:
        line = line.strip()
        if line.startswith("PORT") and "STATE" in line and "SERVICE" in line:
            port_section = True
            continue
        
        if port_section and line:
            # Stop at empty line or next section
            if not line or line.startswith("Service detection") or line.startswith("OS detection"):
                port_section = False
                continue
                
            # Parse port line: "22/tcp   open  ssh     OpenSSH 8.9p1"
            parts = line.split()
            if len(parts) >= 3 and "/" in parts[0]:
                port_info = {
                    "port": parts[0],
                    "state": parts[1],
                    "service": parts[2] if len(parts) > 2 else "unknown"
                }
                
                # Add version info if available
                if len(parts) > 3:
                    port_info["version"] = " ".join(parts[3:])
                
                result["open_ports"].append(port_info)
    
    # Extract OS information
    os_lines = []
    os_section = False
    for line in cleaned_lines:
        if "OS details:" in line or "Running:" in line:
            os_section = True
            os_lines.append(line)
        elif os_section and line.strip() and not line.startswith("Network Distance"):
            os_lines.append(line)
        elif os_section and not line.strip():
            break
    
    if os_lines:
        result["os_info"] = "\n".join(os_lines)
    
    # Extract scan statistics
    for line in cleaned_lines:
        if "Nmap done" in line:
            # Extract timing info
            import re
            time_match = re.search(r'in (\d+\.?\d*) seconds', line)
            if time_match:
                result["scan_stats"]["duration"] = time_match.group(1) + "s"
    
    return result

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
        
        # Clean and parse the output
        cleaned_data = clean_nmap_output(to_text(proc.stdout))
        
        return {
            "ip": ip,
            "returncode": proc.returncode,
            "host_status": cleaned_data["host_status"],
            "open_ports": cleaned_data["open_ports"],
            "os_info": cleaned_data["os_info"],
            "scan_stats": cleaned_data["scan_stats"],
            "stderr": to_text(proc.stderr),
        }
    except subprocess.TimeoutExpired as e:
        return {
            "ip": ip,
            "returncode": None,
            "host_status": "timeout",
            "open_ports": [],
            "os_info": None,
            "scan_stats": {},
            "stderr": to_text(getattr(e, "stderr", None)) + "\nTimed out.",
            "error": "timeout",
        }

async def stream_nmap_scan(ips: List[str], timeout: int = 60, nmap_args: List[str] = None) -> AsyncGenerator[Dict, None]:
    """
    Stream nmap scan results for a list of IPs.
    Yields JSON messages with type: started, progress, result, completed, error
    """
    if nmap_args is None:
        nmap_args = DEFAULT_NMAP_ARGS.copy()
    
    # Check if nmap is available
    if shutil.which("nmap") is None:
        yield {
            "type": "error",
            "message": "nmap not found. Install it with: sudo apt-get update && sudo apt-get install -y nmap"
        }
        return
    
    # Filter and validate IPs
    valid_ips = [ip for ip in ips if is_reasonable_target(ip)]
    scanned_ips: Set[str] = set()
    
    # Remove duplicates while preserving order
    unique_ips = []
    for ip in valid_ips:
        if ip not in scanned_ips:
            unique_ips.append(ip)
            scanned_ips.add(ip)
    
    if not unique_ips:
        yield {
            "type": "error", 
            "message": "No valid IPs to scan"
        }
        return
    
    # Send start message
    yield {
        "type": "started",
        "total_ips": len(unique_ips),
        "nmap_args": nmap_args,
        "timestamp": datetime.now().isoformat()
    }
    
    # Scan each IP
    for i, ip in enumerate(unique_ips):
        try:
            # Run nmap scan in executor to avoid blocking
            result = await asyncio.get_event_loop().run_in_executor(
                None, run_nmap, ip, nmap_args, timeout
            )
            
            yield {
                "type": "result",
                "ip": ip,
                "progress": i + 1,
                "total": len(unique_ips),
                "result": result,
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            yield {
                "type": "result",
                "ip": ip,
                "progress": i + 1,
                "total": len(unique_ips),
                "result": {
                    "ip": ip,
                    "returncode": None,
                    "host_status": "error",
                    "open_ports": [],
                    "os_info": None,
                    "scan_stats": {},
                    "stderr": f"Error: {str(e)}",
                    "error": "exception"
                },
                "timestamp": datetime.now().isoformat()
            }
        
        # Small delay to prevent overwhelming the system
        await asyncio.sleep(0.1)
    
    # Send completion message
    yield {
        "type": "completed",
        "total_scanned": len(unique_ips),
        "timestamp": datetime.now().isoformat()
    }

def main():
    parser = argparse.ArgumentParser(description="Run nmap on IPs discovered by scanner.py JSON output.")
    parser.add_argument("input", help="Path to scan_results.json (or a devices dict JSON).")
    parser.add_argument("-o", "--output", default="nmap_results.json", help="Output JSON file.")
    parser.add_argument("--timeout", type=int, default=60, help="Timeout per-host (seconds).")
    parser.add_argument("--args", default=None,
                        help="Override nmap args as a single quoted string, e.g. '--args \"-sV -T3 --top-ports 200\"'")
    parser.add_argument("--dry-run", action="store_true", help="Print targets/commands but don't run nmap.")
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