"use client";

import { useScan } from "@/hooks/useScan";

export default function TestPage() {
    const { packets, devices, status, start } = useScan(); 
    
    return (
        <div>
            <p>Status: {status}</p>
            <p>Devices: {Object.keys(devices).length}</p>
            <p>Packets: {packets.length}</p>

            <button onClick={() => start()} disabled={status === "scanning"}>
                Start Scan
            </button>

            <pre style={{ height: "80vh", overflow: "auto" }}>
            {packets.map((p, i) => (
                <div key={i}>{JSON.stringify(p)}</div>
            ))}
            </pre>
        </div>
    );

}