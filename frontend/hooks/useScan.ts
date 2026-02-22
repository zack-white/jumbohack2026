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

export function useScan() {
    const [packets, setPackets] = useState<Packet[]>([]);
    const [devices, setDevices] = useState<Record<string, Device>>({});
    const [status, setStatus]   = useState<"idle" | "scanning" | "done" | "error">("idle");

    // Ref for EventSource to eventually close the connection
    const esRef = useRef<EventSource | null>(null);

    const start = (duration = 60) => {
        const es = new EventSource(`/api/pi/scan?duration=${duration}`);
        esRef.current = es;
        setStatus("scanning");

        // Update data when each new batch arrives
        es.onmessage = (event) => {
            const message = JSON.parse(event.data);

            if (message.type === "batch") {
                setPackets((prevPackets) => [...prevPackets, ...(message.packets ?? [])]);
                setDevices(message.devices);
            } else if (message.type === "done") {
                setDevices(message.devices);
                setStatus("done");
                es.close();
            }
        }

        // Detect any errors and close
        es.onerror = () => {
            setStatus("error");
            es.close();
        };
    }
    
    // Cleanup EventSource ref
    useEffect(() => {
        return () => esRef.current?.close();
    }, []);

    return { packets, devices, status, start }; 
}