/**
 * Minimal PCAP parser for browser: extracts IPv4 hosts, packet stats,
 * hostnames from DHCP, and connections (src<->dst pairs).
 * Supports standard PCAP (link-type Ethernet) only.
 */

const PCAP_GLOBAL_HEADER_SIZE = 24;
const PCAP_PACKET_HEADER_SIZE = 16;
const ETHERNET_HEADER_SIZE = 14;
const ETHERTYPE_IPV4 = 0x0800;
const IP_HEADER_MIN_SIZE = 20;
const IP_SRC_OFFSET = 12;
const IP_DST_OFFSET = 16;
const IP_PROTOCOL_OFFSET = 9;
const PROTO_UDP = 17;
const UDP_HEADER_SIZE = 8;
const DHCP_BOOTPS_PORT = 67;
const DHCP_OPTIONS_START = 236;
const DHCP_OPTION_HOSTNAME = 12;
const DHCP_OPTION_END = 255;

function readU32(view: DataView, offset: number, littleEndian: boolean): number {
  return view.getUint32(offset, littleEndian);
}

function readU16(view: DataView, offset: number, littleEndian: boolean): number {
  return view.getUint16(offset, littleEndian);
}

function ipToString(view: DataView, offset: number): string {
  return `${view.getUint8(offset)}.${view.getUint8(offset + 1)}.${view.getUint8(offset + 2)}.${view.getUint8(offset + 3)}`;
}

function macToString(view: DataView, offset: number): string {
  const parts: string[] = [];
  for (let i = 0; i < 6; i++) {
    parts.push(view.getUint8(offset + i).toString(16).padStart(2, "0"));
  }
  return parts.join(":");
}

function decodeHostname(view: DataView, offset: number, len: number): string | null {
  let s = "";
  for (let i = 0; i < len; i++) {
    const b = view.getUint8(offset + i);
    if (b >= 0x20 && b < 0x7f) s += String.fromCharCode(b);
    else if (b !== 0) return null;
  }
  return s.trim() || null;
}

export interface HostInfo {
  ip: string;
  packetCount: number;
  mac?: string;
  hostname?: string;
  firstSeenMs?: number;
  lastSeenMs?: number;
}

export interface Connection {
  srcIp: string;
  dstIp: string;
  packetCount: number;
}

export interface PcapParseResult {
  hosts: HostInfo[];
  connections: Connection[];
}

export function parsePcap(buffer: ArrayBuffer): PcapParseResult {
  const view = new DataView(buffer);
  if (buffer.byteLength < PCAP_GLOBAL_HEADER_SIZE) {
    throw new Error("File too small to be a valid PCAP");
  }

  const magic = readU32(view, 0, false);
  const littleEndian = magic === 0xd4c3b2a1 || magic === 0xd5c3b2a1;
  const isNano = magic === 0xa1b2c3d5 || magic === 0xd5c3b2a1;
  const validMagic =
    magic === 0xa1b2c3d4 ||
    magic === 0xa1b2c3d5 ||
    magic === 0xd4c3b2a1 ||
    magic === 0xd5c3b2a1;
  if (!validMagic) {
    throw new Error("Invalid PCAP magic number. Standard PCAP (.pcap) is supported.");
  }

  const linkType = readU32(view, 20, littleEndian);
  if (linkType !== 1) {
    throw new Error("Only Ethernet link type is supported");
  }

  const hostMap = new Map<string, HostInfo>();
  const connectionMap = new Map<string, number>(); // "srcIp|dstIp" -> count
  const ipToHostname = new Map<string, string>();
  const macToHostname = new Map<string, string>();
  let offset = PCAP_GLOBAL_HEADER_SIZE;

  while (offset + PCAP_PACKET_HEADER_SIZE <= buffer.byteLength) {
    const inclLen = readU32(view, offset + 8, littleEndian);
    const packetDataStart = offset + PCAP_PACKET_HEADER_SIZE;
    const packetDataEnd = packetDataStart + inclLen;

    if (packetDataEnd > buffer.byteLength) break;

    const payloadStart = packetDataStart + ETHERNET_HEADER_SIZE;
    if (payloadStart + 4 > buffer.byteLength) {
      offset = packetDataEnd;
      continue;
    }

    const etherType = readU16(view, packetDataStart + 12, false);
    if (etherType !== ETHERTYPE_IPV4) {
      offset = packetDataEnd;
      continue;
    }

    if (payloadStart + IP_HEADER_MIN_SIZE > buffer.byteLength) {
      offset = packetDataEnd;
      continue;
    }

    const srcIp = ipToString(view, payloadStart + IP_SRC_OFFSET);
    const dstIp = ipToString(view, payloadStart + IP_DST_OFFSET);
    const srcMac = macToString(view, packetDataStart);

    const tsSec = readU32(view, offset, littleEndian);
    const tsUsec = readU32(view, offset + 4, littleEndian);
    const tsMs = tsSec * 1000 + (isNano ? tsUsec / 1e6 : Math.floor(tsUsec / 1000));

    // Track hosts
    for (const ip of [srcIp, dstIp]) {
      const existing = hostMap.get(ip);
      if (existing) {
        existing.packetCount += 1;
        if (tsMs != null) {
          existing.lastSeenMs = tsMs;
          if (existing.firstSeenMs == null) existing.firstSeenMs = tsMs;
        }
      } else {
        hostMap.set(ip, {
          ip,
          packetCount: 1,
          mac: ip === srcIp ? srcMac : undefined,
          firstSeenMs: tsMs,
          lastSeenMs: tsMs,
        });
      }
    }

    // Track connections (both directions; normalize key for dedup)
    const key = srcIp < dstIp ? `${srcIp}|${dstIp}` : `${dstIp}|${srcIp}`;
    connectionMap.set(key, (connectionMap.get(key) ?? 0) + 1);

    // DHCP: extract hostname
    const ipHeaderLen = (view.getUint8(payloadStart) & 0x0f) * 4;
    const udpStart = payloadStart + ipHeaderLen;
    if (
      view.getUint8(payloadStart + IP_PROTOCOL_OFFSET) === PROTO_UDP &&
      udpStart + UDP_HEADER_SIZE + DHCP_OPTIONS_START + 2 <= packetDataEnd
    ) {
      const udpDstPort = readU16(view, udpStart + 2, false);
      if (udpDstPort === DHCP_BOOTPS_PORT) {
        const dhcpPayload = udpStart + UDP_HEADER_SIZE;
        let optOffset = dhcpPayload + DHCP_OPTIONS_START;
        while (optOffset + 1 < packetDataEnd) {
          const code = view.getUint8(optOffset);
          if (code === DHCP_OPTION_END) break;
          const len = view.getUint8(optOffset + 1);
          if (optOffset + 2 + len > packetDataEnd) break;
          if (code === DHCP_OPTION_HOSTNAME && len > 0) {
            const hostname = decodeHostname(view, optOffset + 2, len);
            if (hostname) {
              if (srcIp !== "0.0.0.0") ipToHostname.set(srcIp, hostname);
              macToHostname.set(srcMac, hostname);
            }
            break;
          }
          optOffset += 2 + len;
        }
      }
    }

    offset = packetDataEnd;
  }

  for (const host of hostMap.values()) {
    host.hostname =
      ipToHostname.get(host.ip) ?? (host.mac ? macToHostname.get(host.mac) : undefined);
  }

  const connections: Connection[] = [];
  for (const [key, count] of connectionMap.entries()) {
    const [a, b] = key.split("|");
    connections.push({ srcIp: a, dstIp: b, packetCount: count });
  }

  return {
    hosts: Array.from(hostMap.values()),
    connections,
  };
}

/** Parsed IPv4 connection from a single packet */
export interface StreamPacket {
  srcIp: string;
  dstIp: string;
}

/**
 * Stream PCAP file and yield { srcIp, dstIp } for each IPv4 packet.
 * Use File.stream() to read incrementally.
 */
export async function* parsePcapStream(
  stream: ReadableStream<Uint8Array>
): AsyncGenerator<StreamPacket> {
  const reader = stream.getReader();
  let buffer = new Uint8Array(0);
  let littleEndian = false;

  const ensureBytes = async (n: number): Promise<Uint8Array | null> => {
    while (buffer.byteLength < n) {
      const { done, value } = await reader.read();
      if (done) return null;
      const combined = new Uint8Array(buffer.byteLength + value.length);
      combined.set(buffer);
      combined.set(value, buffer.byteLength);
      buffer = combined;
    }
    return buffer;
  };

  const consume = (n: number) => {
    buffer = buffer.slice(n);
  };

  const readU32 = (view: DataView, offset: number) =>
    view.getUint32(offset, littleEndian);
  const readU16 = (view: DataView, offset: number) =>
    view.getUint16(offset, false);
  const ipToString = (view: DataView, offset: number) =>
    `${view.getUint8(offset)}.${view.getUint8(offset + 1)}.${view.getUint8(offset + 2)}.${view.getUint8(offset + 3)}`;

  const chunk = await ensureBytes(24);
  if (!chunk || chunk.length < 24) return;
  const headerView = new DataView(
    chunk.buffer,
    chunk.byteOffset,
    chunk.byteLength
  );
  const magic = headerView.getUint32(0, false);
  littleEndian = magic === 0xd4c3b2a1 || magic === 0xd5c3b2a1;
  const validMagic =
    magic === 0xa1b2c3d4 ||
    magic === 0xa1b2c3d5 ||
    magic === 0xd4c3b2a1 ||
    magic === 0xd5c3b2a1;
  if (!validMagic) throw new Error("Invalid PCAP magic number");
  const linkType = readU32(headerView, 20);
  if (linkType !== 1) throw new Error("Only Ethernet link type supported");
  consume(24);

  const ETHERNET_HEADER_SIZE = 14;
  const ETHERTYPE_IPV4 = 0x0800;
  const IP_HEADER_MIN_SIZE = 20;
  const IP_SRC_OFFSET = 12;
  const IP_DST_OFFSET = 16;

  while (true) {
    const pHdr = await ensureBytes(16);
    if (!pHdr || pHdr.length < 16) break;
    const view = new DataView(pHdr.buffer, pHdr.byteOffset, pHdr.byteLength);
    const inclLen = readU32(view, 8);
    consume(16);

    const pktData = await ensureBytes(inclLen);
    if (!pktData || pktData.length < inclLen) break;

    const payloadStart = ETHERNET_HEADER_SIZE;
    if (inclLen < payloadStart + 4) {
      consume(inclLen);
      continue;
    }
    const pktView = new DataView(
      pktData.buffer,
      pktData.byteOffset,
      pktData.byteLength
    );
    const etherType = readU16(pktView, 12);
    if (etherType !== ETHERTYPE_IPV4) {
      consume(inclLen);
      continue;
    }
    if (inclLen < payloadStart + IP_HEADER_MIN_SIZE) {
      consume(inclLen);
      continue;
    }
    const srcIp = ipToString(pktView, payloadStart + IP_SRC_OFFSET);
    const dstIp = ipToString(pktView, payloadStart + IP_DST_OFFSET);
    consume(inclLen);
    yield { srcIp, dstIp };
  }
}
