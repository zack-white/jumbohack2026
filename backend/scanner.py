from scapy.arch import get_if_list, get_if_addr
from scapy.all import conf, IP, TCP, UDP, ICMP, DNS, ARP, AsyncSniffer
from datetime import datetime
import asyncio
import queue
import socket
import time
import subprocess
import re


class DeviceTracker:
    """
    Maintains a live map of every device seen on the network.
    ARP gives us IP <-> MAC. mDNS/Avahi can give us human-readable names.
    """

    def __init__(self):
        # Keys are IP addresses, values are dicts with mac/vendor/hostname/mdns_names
        self._devices = {}

    def ensure(self, ip: str):
        if ip not in self._devices:
            self._devices[ip] = {
                "mac": None,
                "vendor": "Unknown",
                "hostname": None,      # reverse DNS if available
                "mdns_names": [],      # names discovered via Avahi/mDNS
                "last_seen": datetime.now().isoformat(),
            }
        else:
            self._devices[ip]["last_seen"] = datetime.now().isoformat()

    def update_arp(self, ip: str, mac: str):
        self.ensure(ip)
        # Prefer real ARP data when we have it
        if mac and not self._devices[ip].get("mac"):
            self._devices[ip]["mac"] = mac
            self._devices[ip]["vendor"] = self._get_vendor(mac)

        # Fill hostname if we don’t have one yet
        if self._devices[ip].get("hostname") is None:
            self._devices[ip]["hostname"] = self._get_hostname(ip)

    def add_mdns_name(self, ip: str, name: str):
        if not ip or not name:
            return
        self.ensure(ip)

        # Normalize to something readable
        name = name.strip()
        if not name:
            return

        # Avoid duplicates
        names = self._devices[ip].setdefault("mdns_names", [])
        if name not in names:
            names.append(name)

        # If hostname isn't set, mdns is often the best "name"
        if not self._devices[ip].get("hostname"):
            self._devices[ip]["hostname"] = name

    def _get_vendor(self, mac: str) -> str:
        try:
            return conf.manufdb._get_manuf(mac) or "Unknown"
        except Exception:
            return "Unknown"

    def _get_hostname(self, ip: str) -> str:
        try:
            return socket.gethostbyaddr(ip)[0]
        except Exception:
            return None

    def get_devices(self) -> dict:
        return dict(self._devices)


def parse_packet(packet):
    # Only emit packets that have something actionable (IP or ARP)
    has_ip = packet.haslayer(IP)
    has_arp = packet.haslayer(ARP)
    if not has_ip and not has_arp:
        return None

    data = {
        "t": time.time(),   # unix seconds; frontend can format
        "p": None,          # protocol
        "src": None,
        "dst": None,
        "sport": None,
        "dport": None,
        "len": len(packet),
        "dns": None,
        "f": None,          # tcp flags
    }

    if has_ip:
        data["src"] = packet[IP].src
        data["dst"] = packet[IP].dst

    if packet.haslayer(TCP):
        data["p"] = "TCP"
        data["sport"] = int(packet[TCP].sport)
        data["dport"] = int(packet[TCP].dport)
        data["f"] = str(packet[TCP].flags)

    elif packet.haslayer(UDP):
        data["p"] = "UDP"
        data["sport"] = int(packet[UDP].sport)
        data["dport"] = int(packet[UDP].dport)

        # DNS query (high signal)
        if packet.haslayer(DNS) and packet[DNS].qr == 0 and packet[DNS].qd:
            try:
                data["dns"] = packet[DNS].qd.qname.decode(errors="ignore").rstrip(".")
            except Exception:
                pass

    elif packet.haslayer(ICMP):
        data["p"] = "ICMP"

    if has_arp:
        data["p"] = "ARP"
        data["src"] = packet[ARP].psrc
        data["dst"] = packet[ARP].pdst
        data["sport"] = None
        data["dport"] = None
        data["dns"] = None
        data["f"] = None

    # If still no src/dst, drop it
    if not data["src"] and not data["dst"]:
        return None

    return data


# --- NEW: Avahi/mDNS helpers ---

_AVAHI_ADDR_RE = re.compile(r"address\s*=\s*\[(?P<ip>[0-9a-fA-F\.\:]+)\]")
_AVAHI_HOST_RE = re.compile(r"hostname\s*=\s*\[(?P<name>.+?)\]")
_AVAHI_NAME_RE = re.compile(r"name\s*=\s*\[(?P<name>.+?)\]")

def avahi_browse_resolved(timeout_sec: float = 2.0) -> list[dict]:
    """
    Runs `avahi-browse -a -r -t` and returns a list of resolved records.
    Each record may include:
      - name (service/device label)
      - hostname (often *.local)
      - address (ip)
    """
    try:
        proc = subprocess.run(
            ["avahi-browse", "-a", "-r", "-t"],
            capture_output=True,
            text=True,
            timeout=timeout_sec,
            check=False,
        )
    except FileNotFoundError:
        # avahi-browse not installed
        return []
    except subprocess.TimeoutExpired:
        return []

    out = proc.stdout.splitlines()
    records = []
    current = {}

    # The output is blocky; we collect key=value lines until a blank line
    for line in out:
        line = line.strip()
        if not line:
            if current:
                records.append(current)
                current = {}
            continue

        m = _AVAHI_NAME_RE.search(line)
        if m:
            current.setdefault("name", m.group("name"))

        m = _AVAHI_HOST_RE.search(line)
        if m:
            current.setdefault("hostname", m.group("name"))

        m = _AVAHI_ADDR_RE.search(line)
        if m:
            current.setdefault("address", m.group("ip"))

    if current:
        records.append(current)

    return records


async def run_scan(duration: int = 60, batch_interval: float = 2.0):
    tracker = DeviceTracker()
    iface = get_interface()
    packet_queue = queue.Queue()

    def handle_packet(pkt):
        if pkt.haslayer(ARP):
            tracker.update_arp(pkt[ARP].psrc, pkt[ARP].hwsrc)

        # If it’s an IP packet, keep "last_seen" warm even if we never saw ARP
        if pkt.haslayer(IP):
            tracker.ensure(pkt[IP].src)
            tracker.ensure(pkt[IP].dst)

        packet_queue.put(parse_packet(pkt))

    sniffer = AsyncSniffer(iface=iface, prn=handle_packet, store=False)
    sniffer.start()

    start = time.time()
    while time.time() - start < duration:
        await asyncio.sleep(batch_interval)

        # NEW: run avahi periodically and merge results
        for rec in avahi_browse_resolved(timeout_sec=2.0):
            ip = rec.get("address")
            name = rec.get("hostname") or rec.get("name")
            # Only attach if it resolved to an address
            if ip and name:
                tracker.add_mdns_name(ip, name)

        batch = []
        while not packet_queue.empty():
            batch.append(packet_queue.get_nowait())

        if batch:
            yield {
                "type": "batch",
                "packets": batch,
                "devices": tracker.get_devices(),
            }

    sniffer.stop()

    # One last Avahi pass before finishing
    for rec in avahi_browse_resolved(timeout_sec=2.0):
        ip = rec.get("address")
        name = rec.get("hostname") or rec.get("name")
        if ip and name:
            tracker.add_mdns_name(ip, name)

    yield {
        "type": "done",
        "devices": tracker.get_devices(),
    }


INTERFACE_PRIORITY = ["eth0", "eth1", "wlan0", "wlan1"]

def get_interface():
    available = get_if_list()
    for iface in INTERFACE_PRIORITY:
        if iface in available and get_if_addr(iface) != "0.0.0.0":
            return iface
    for iface in available:
        if iface == "lo":
            continue
        if get_if_addr(iface) != "0.0.0.0":
            return iface
    raise RuntimeError("No usable network interface found")