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

export interface TestResult {
    status: string;
    message: string;
    ips_received: string[];
    timestamp: string;
}

export function useScan() {
    const [packets, setPackets] = useState<Packet[]>([]);
    const [devices, setDevices] = useState<Record<string, Device>>({});
    const [status, setStatus] = useState<"idle" | "scanning" | "done" | "nmap-scanning" | "complete" | "error">("idle");
    const [nmapResults, setNmapResults] = useState<NmapResult[]>([]);
    const [nmapProgress, setNmapProgress] = useState<NmapProgress | null>(null);
    const [testResults, setTestResults] = useState<TestResult[]>([]);

    // Refs for EventSource connections
    const scanEventSourceRef = useRef<EventSource | null>(null);
    const nmapEventSourceRef = useRef<EventSource | null>(null);

    const sendTestRequest = async (ips: string[]) => {
        try {
            console.log('[TEST] Attempting to send request to /api/pi/test with IPs:', ips);
            
            const response = await fetch('/api/pi/test', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ ips }),
            });
            
            console.log('[TEST] Response status:', response.status);
            
            if (response.ok) {
                const result: TestResult = await response.json();
                setTestResults(prev => [...prev, result]);
                console.log('[TEST] Success! Response:', result);
            } else {
                const errorText = await response.text();
                console.error('[TEST] HTTP Error:', response.status, errorText);
                
                // Try GET request as fallback to test if endpoint exists
                const getResponse = await fetch('/api/pi/test');
                console.log('[TEST] GET fallback status:', getResponse.status);
                if (getResponse.ok) {
                    const getResult = await getResponse.json();
                    console.log('[TEST] GET fallback worked:', getResult);
                }
            }
        } catch (error) {
            console.error('[TEST] Network/Parse Error:', error);
            
            // Additional debugging: try to reach the endpoint via GET
            try {
                const testGet = await fetch('/api/pi/test');
                console.log('[TEST] GET test status:', testGet.status);
            } catch (getError) {
                console.error('[TEST] GET test also failed:', getError);
            }
        }
    };

    const start = (duration = 60) => {
        // Reset state
        setPackets([]);
        setDevices({});
        setNmapResults([]);
        setNmapProgress(null);
        setTestResults([]);
        
        const es = new EventSource(`/api/pi/scan?duration=${duration}`);
        scanEventSourceRef.current = es;
        setStatus("scanning");

        // Update data when each new batch arrives
        es.onmessage = (event) => {
            const message = JSON.parse(event.data);

            if (message.type === "batch") {
                setPackets((prevPackets) => [...prevPackets, ...(message.packets ?? [])]);
                setDevices(message.devices);
                
                // Continuously send device IPs to test endpoint
                const currentIps = Object.keys(message.devices);
                if (currentIps.length > 0) {
                    sendTestRequest(currentIps);
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
        testResults,
        start 
    }; 
}