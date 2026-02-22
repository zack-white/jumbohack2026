# ping.py

import shutil
import subprocess
from datetime import datetime


def _run_avahi(timeout: float = 20.0) -> str:
    if shutil.which("avahi-browse") is None:
        raise RuntimeError(
            "avahi-browse not found. Install with: sudo apt-get install avahi-utils"
        )

    proc = subprocess.run(
        ["avahi-browse", "-a", "-r", "-t", "-p"],
        capture_output=True,
        text=True,
        timeout=timeout,
        check=False,
    )

    return proc.stdout


def _parse_avahi(output: str):
    ip_to_hostnames = {}

    for line in output.splitlines():
        line = line.strip()

        if not line.startswith("="):
            continue

        parts = line.split(";")
        if len(parts) < 8:
            continue

        hostname = parts[6].strip()
        ip = parts[7].strip()

        if not ip or not hostname:
            continue

        ip_to_hostnames.setdefault(ip, set()).add(hostname)

    return {
        ip: sorted(list(hosts))
        for ip, hosts in ip_to_hostnames.items()
    }


def get_avahi_devices(timeout: float = 20.0):
    raw = _run_avahi(timeout)
    mapping = _parse_avahi(raw)

    return {
        "type": "avahi_ip_hostnames",
        "generated_at": datetime.now().isoformat(),
        "count": len(mapping),
        "devices": [
            {
                "ip": ip,
                "hostname": hosts[0] if hosts else None,
                "hostnames": hosts,
            }
            for ip, hosts in sorted(mapping.items())
        ],
    }


# Optional CLI support (so you can still run python ping.py)
if __name__ == "__main__":
    import json
    print(json.dumps(get_avahi_devices(), indent=2))