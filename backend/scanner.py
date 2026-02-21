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