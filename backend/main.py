from fastapi import FastAPI, HTTPException, Query
import requests
from sse_starlette import EventSourceResponse
import json
from datetime import datetime
from scanner import run_scan 
from ping import get_avahi_devices
from nmap import stream_nmap_scan, DEFAULT_NMAP_ARGS, run_nmap
from typing import List
from pydantic import BaseModel
import asyncio

app = FastAPI()

class NmapRequest(BaseModel):
    ips: List[str]
    timeout: int = 300
    args: List[str] = None

@app.get("/ping")
def ping(timeout: float = 20.0):
    # response = requests.get("https://api.ipify.org?format=json")
    # return response.json()["ip"]
    try:
        # ping.py prints to stdout by default; we want a Python dict back.
        # So: call its internal helpers if you have them, otherwise expose a function.
        return get_avahi_devices(timeout=timeout)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

@app.get("/scan")
async def scan(duration: int = 60, batch_interval: float = 2.0):
    async def event_generator():
        async for message in run_scan(duration, batch_interval):
            yield { "data": json.dumps(message) }
    return EventSourceResponse(event_generator())


@app.post("/nmap-scan")
async def nmap_scan(request: NmapRequest):
    """
    Run nmap scans on provided IPs and return results.
    Expects a JSON body with 'ips', optional 'timeout', and optional 'args'.
    """
    print(f"[NMAP-SCAN] Received request to /nmap-scan endpoint")
    
    try:
        ips = request.ips
        timeout = request.timeout or 60
        nmap_args = request.args or DEFAULT_NMAP_ARGS
        
        print(f"[NMAP-SCAN] Starting nmap scan for {len(ips)} IPs: {ips}")
        
        # Run nmap scans for all IPs
        results = []
        for ip in ips:
            print(f"[NMAP-SCAN] Scanning {ip}...")
            result = await asyncio.get_event_loop().run_in_executor(
                None, run_nmap, ip, nmap_args, timeout
            )
            results.append(result)
            print(f"[NMAP-SCAN] Completed scan for {ip}")
        
        print(f"[NMAP-SCAN] All scans completed")
        
        # Return results
        return {
            "status": "success",
            "message": f"Completed nmap scan for {len(ips)} IP addresses",
            "results": results,
            "timestamp": datetime.now().isoformat(),
            "nmap_args": nmap_args
        }
    except Exception as e:
        print(f"[NMAP-SCAN] Error processing request: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/llm")
def llm():
    return { "data": "llm" }