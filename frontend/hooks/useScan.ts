import { useEffect, useState, useRef } from "react";

export interface Packet {
    timestamp: number;
    protocol: string;
    src_ip: string | null;
    dst_ip: string | null;
    src_port: number | null;
    dst_port: number | null;
    size: number;
    dns_query: string | null;
    flags: string | null;
}

export interface Device {
    mac: string;
    vendor: string;
    hostname: string | null;
}

export interface NmapResult {
    ip: string;
    returncode: number | null;
    stdout: string;
    stderr: string;
    error?: string;
}

export interface NmapProgress {
    type: "started" | "result" | "completed" | "error";
    progress?: number;
    total?: number;
    result?: NmapResult;
    message?: string;
    timestamp?: string;
}

export interface NmapScanResult {
    status: string;
    message: string;
    results: {
        ip: string;
        returncode: number | null;
        stdout: string;
        stderr: string;
        error?: string;
    }[];
    timestamp: string;
    nmap_args: string[];
}

export function useScan() {
    const [packets, setPackets] = useState<Packet[]>([]);
    const [devices, setDevices] = useState<Record<string, Device>>({});
    const [status, setStatus] = useState<"idle" | "scanning" | "done" | "nmap-scanning" | "complete" | "error">("idle");
    const [nmapResults, setNmapResults] = useState<NmapResult[]>([]);
    const [nmapProgress, setNmapProgress] = useState<NmapProgress | null>(null);
    const [nmapScanResults, setNmapScanResults] = useState<NmapScanResult[]>([]);
    
    // Track which IPs have already been sent for nmap scanning
    const scannedIpsRef = useRef<Set<string>>(new Set());

    // Refs for EventSource connections
    const scanEventSourceRef = useRef<EventSource | null>(null);
    const nmapEventSourceRef = useRef<EventSource | null>(null);

    const sendNmapRequest = async (ips: string[]) => {
        try {
            // Filter out IPs that have already been scanned
            const newIps = ips.filter(ip => !scannedIpsRef.current.has(ip));
            
            if (newIps.length === 0) {
                console.log('[NMAP] No new IPs to scan, skipping request');
                return;
            }
            
            // Mark these IPs as being scanned
            newIps.forEach(ip => scannedIpsRef.current.add(ip));
            
            console.log('[NMAP] Attempting to send request to /api/pi/nmap with NEW IPs:', newIps);
            console.log('[NMAP] Total IPs already scanned:', scannedIpsRef.current.size);

            const response = await fetch('/api/pi/nmap', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ ips: newIps }),
            });
            
            console.log('[NMAP] Response status:', response.status);
            
            if (response.ok) {
                const result: NmapScanResult = await response.json();
                setNmapScanResults(prev => [...prev, result]);
                console.log('[NMAP] Success! Response:', result);
            } else {
                // If the request failed, remove the IPs from the scanned set so they can be retried
                newIps.forEach(ip => scannedIpsRef.current.delete(ip));
                
                const errorText = await response.text();
                console.error('[NMAP] HTTP Error:', response.status, errorText);
                
                // Try GET request as fallback to test if endpoint exists
                const getResponse = await fetch('/api/pi/nmap');
                console.log('[NMAP] GET fallback status:', getResponse.status);
                if (getResponse.ok) {
                    const getResult = await getResponse.json();
                    console.log('[NMAP] GET fallback worked:', getResult);
                }
            }
        } catch (error) {
            // If there was a network error, remove the IPs from scanned set for retry
            const newIps = ips.filter(ip => !scannedIpsRef.current.has(ip));
            newIps.forEach(ip => scannedIpsRef.current.delete(ip));
            
            console.error('[NMAP] Network/Parse Error:', error);
            
            // Additional debugging: try to reach the endpoint via GET
            try {
                const testGet = await fetch('/api/pi/nmap');
                console.log('[NMAP] GET test status:', testGet.status);
            } catch (getError) {
                console.error('[NMAP] GET test also failed:', getError);
            }
        }
    };

    const start = (duration = 60) => {
        // Reset state
        setPackets([]);
        setDevices({});
        setNmapResults([]);
        setNmapProgress(null);
        setNmapScanResults([]);
        
        // Clear the set of scanned IPs for a fresh scan
        scannedIpsRef.current.clear();
        console.log('[NMAP] Cleared previously scanned IPs tracker');
        
        const es = new EventSource(`/api/pi/scan?duration=${duration}`);
        scanEventSourceRef.current = es;
        setStatus("scanning");

        // Update data when each new batch arrives
        es.onmessage = (event) => {
            const message = JSON.parse(event.data);

            if (message.type === "batch") {
                setPackets((prevPackets) => [...prevPackets, ...(message.packets ?? [])]);
                setDevices(message.devices);
                
                // Continuously send device IPs to nmap endpoint (only new ones)
                const currentIps = Object.keys(message.devices);
                if (currentIps.length > 0) {
                    sendNmapRequest(currentIps);
                }
                
            } else if (message.type === "done") {
                setDevices(message.devices);
                setStatus("done");
                es.close();
                
                // Extract unique IPs from devices and start nmap scan
                const ips = Object.keys(message.devices);
                if (ips.length > 0) {
                    startNmapScan(ips);
                }
            }
        };

        // Detect any errors and close
        es.onerror = () => {
            setStatus("error");
            es.close();
        };
    };

    const startNmapScan = (ips: string[]) => {
        setStatus("nmap-scanning");
        
        // Convert IPs array to query parameters
        const ipsParam = ips.map(ip => `ips=${encodeURIComponent(ip)}`).join('&');
        const nmapEs = new EventSource(`/api/pi/nmap?${ipsParam}&timeout=60`);
        nmapEventSourceRef.current = nmapEs;

        nmapEs.onmessage = (event) => {
            const message = JSON.parse(event.data);
            setNmapProgress(message);

            if (message.type === "result" && message.result) {
                setNmapResults(prev => [...prev, message.result]);
            } else if (message.type === "completed") {
                setStatus("complete");
                nmapEs.close();
            } else if (message.type === "error") {
                setStatus("error");
                nmapEs.close();
            }
        };

        nmapEs.onerror = () => {
            setStatus("error");
            nmapEs.close();
        };
    };
    
    // Cleanup EventSource refs
    useEffect(() => {
        return () => {
            scanEventSourceRef.current?.close();
            nmapEventSourceRef.current?.close();
        };
    }, []);

    return { 
        packets, 
        devices, 
        status, 
        nmapResults, 
        nmapProgress, 
        nmapScanResults,
        start 
    }; 
}