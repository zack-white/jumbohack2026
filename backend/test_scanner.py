import asyncio
import json
from scanner import get_interface, run_scan

async def main():
    print(f"Detected interface: {get_interface()}")
    print("Starting 10-second scan...\n")

    async for message in run_scan(duration=10, batch_interval=2.0):
        if message["type"] == "batch":
            print(f"--- Batch: {len(message['packets'])} packets ---")
            for pkt in message["packets"][:3]:  # print first 3 to avoid flooding
                print(json.dumps(pkt, indent=2))
            if len(message["packets"]) > 3:
                print(f"  ... and {len(message['packets']) - 3} more")
            print(f"Known devices: {list(message['devices'].keys())}\n")

        elif message["type"] == "done":
            print("=== Scan complete ===")
            print(f"Devices found: {json.dumps(message['devices'], indent=2)}")

asyncio.run(main())
