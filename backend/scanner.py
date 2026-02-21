from scapy.arch import get_if_list, get_if_addr
from scapy.all import conf, IP, TCP, UDP, ICMP, DNS, ARP, AsyncSniffer
from datetime import datetime
import asyncio
import queue
import socket
import time


class DeviceTracker:
    """
    Maintains a live map of every device seen on the network.
    Populated by ARP packets: each one tells us a MAC <-> IP pairing.
    """

    def __init__(self):
        # Keys are IP addresses, values are dicts with mac/vendor/hostname
        self._devices = {}

    def update(self, ip: str, mac: str):
        # Only store the first time we see a device — avoids duplicate lookups
        if ip not in self._devices:
            self._devices[ip] = {
                "mac": mac,
                "vendor": self._get_vendor(mac),
                "hostname": self._get_hostname(ip),
            }

    def _get_vendor(self, mac: str) -> str:
        # Scapy ships with an offline MAC-to-manufacturer database
        # e.g. "b8:27:eb:..." → "Raspberry Pi Foundation"
        try:
            return conf.manufdb._get_manuf(mac) or "Unknown"
        except Exception:
            return "Unknown"

    def _get_hostname(self, ip: str) -> str:
        # Reverse DNS: turns "192.168.1.5" into "my-macbook.local" if possible
        try:
            return socket.gethostbyaddr(ip)[0]
        except Exception:
            return None

    def get_devices(self) -> dict:
        # Returns a copy so callers can't accidentally mutate internal state
        return dict(self._devices)


def parse_packet(packet) -> dict:
    """
    Converts a raw Scapy packet into a clean dict the frontend can render.
    """
    data = {
        "timestamp": datetime.now().isoformat(),
        "protocol": None,   # TCP / UDP / ICMP / ARP
        "src_ip": None,     # who sent it
        "dst_ip": None,     # who it's going to
        "src_port": None,   # which app sent it (e.g. port 52341)
        "dst_port": None,   # which service it's hitting (e.g. 443 = HTTPS)
        "size": len(packet),# bytes — useful for bandwidth visualization
        "dns_query": None,  # domain being looked up, if this is a DNS packet
        "flags": None,      # TCP only: SYN, ACK, FIN, etc.
    }

    # All TCP/UDP packets have an IP layer with source/destination addresses
    if packet.haslayer(IP):
        data["src_ip"] = packet[IP].src
        data["dst_ip"] = packet[IP].dst

    if packet.haslayer(TCP):
        data["protocol"] = "TCP"
        data["src_port"] = packet[TCP].sport
        data["dst_port"] = packet[TCP].dport
        # Flags tell us what kind of TCP event this is:
        # "S" = new connection attempt, "F" = connection closing, etc.
        data["flags"] = str(packet[TCP].flags)

    elif packet.haslayer(UDP):
        data["protocol"] = "UDP"
        data["src_port"] = packet[UDP].sport
        data["dst_port"] = packet[UDP].dport

    elif packet.haslayer(ICMP):
        # ICMP = ping traffic, no ports
        data["protocol"] = "ICMP"

    # DNS runs over UDP — qr==0 means this is a query (not a response)
    if packet.haslayer(DNS) and packet[DNS].qr == 0:
        data["dns_query"] = packet[DNS].qd.qname.decode()

    # ARP is how devices announce themselves on the local network
    # It doesn't use IP layer fields, so we overwrite src/dst here
    if packet.haslayer(ARP):
        data["protocol"] = "ARP"
        data["src_ip"] = packet[ARP].psrc
        data["dst_ip"] = packet[ARP].pdst

    return data


async def run_scan(duration: int = 60, batch_interval: float = 2.0):
    """
    Async generator that sniffs packets for "duration" seconds, yielding
    micro-batches every "batch_interval" seconds.

    Yields dicts with type "batch" during the scan and "done" at the end.
    The WebSocket handler in main.py iterates over this generator.
    """
    tracker = DeviceTracker()
    iface = get_interface()

    # Sniffer thread puts packets in queue, we read them out
    packet_queue = queue.Queue()

    def handle_packet(pkt):
        # Called by the sniffer thread for every packet captured
        if pkt.haslayer(ARP):
            # Learn this device: MAC hwsrc owns IP psrc
            tracker.update(pkt[ARP].psrc, pkt[ARP].hwsrc)
        # Parse and drop into queue, main loop will pick it up
        packet_queue.put(parse_packet(pkt))

    # AsyncSniffer runs in a background thread so it doesn't block FastAPI
    sniffer = AsyncSniffer(iface=iface, prn=handle_packet, store=False)
    sniffer.start()

    start = time.time()
    while time.time() - start < duration:
        # Yield control back to FastAPI for batch_interval seconds
        await asyncio.sleep(batch_interval)

        # Drain everything that accumulated in the queue since last batch
        batch = []
        while not packet_queue.empty():
            batch.append(packet_queue.get_nowait())

        # Only send if we actually captured something
        if batch:
            yield {
                "type": "batch",
                "packets": batch,
                "devices": tracker.get_devices(),  # current snapshot of all known devices
            }

    sniffer.stop()

    # Signals main.py to trigger LLM analysis
    yield {
        "type": "done",
        "devices": tracker.get_devices(),
    }


INTERFACE_PRIORITY = ["eth0", "eth1", "wlan0", "wlan1"]

def get_interface():
    """
    Determines how Pi is connected to the Internet to know how to listen
    """
    available = get_if_list()
    for iface in INTERFACE_PRIORITY:
        if iface in available and get_if_addr(iface) != "0.0.0.0":
            return iface
    # fallback: first non-loopback interface with an IP
    for iface in available:
        if iface == "lo":
            continue
        if get_if_addr(iface) != "0.0.0.0":
            return iface
    raise RuntimeError("No usable network interface found")
