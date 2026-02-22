from fastapi import FastAPI, HTTPException, Query
import requests
from sse_starlette import EventSourceResponse
import json
from datetime import datetime
from scanner import run_scan 
from ping import get_avahi_devices
from nmap import stream_nmap_scan, DEFAULT_NMAP_ARGS
from typing import List
from pydantic import BaseModel

app = FastAPI()

class TestRequest(BaseModel):
    ips: List[str]

@app.get("/ping")
def ping(timeout: float = 3.0):
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


@app.get("/nmap")
async def nmap(ips: List[str] = Query(...), timeout: int = 60, args: str = None):
    """
    Stream nmap scan results for provided IPs.
    Query params: ips (multiple), timeout (seconds), args (nmap arguments as string)
    """
    if not ips:
        raise HTTPException(status_code=400, detail="At least one IP address is required")
    
    nmap_args = args.split() if args else DEFAULT_NMAP_ARGS
    
    async def event_generator():
        async for message in stream_nmap_scan(ips, timeout, nmap_args):
            yield {"data": json.dumps(message)}
    
    return EventSourceResponse(event_generator())


@app.post("/test")
async def test(request: TestRequest):
    """
    Test endpoint that receives IP addresses and logs them.
    Expects a JSON body with an 'ips' field containing a list of IP addresses.
    """
    print(f"[TEST] Received request to /test endpoint")
    
    try:
        ips = request.ips
        print(f"[TEST] Received {len(ips)} IP addresses: {ips}")
        
        # Return confirmation with the IPs received
        return {
            "status": "success",
            "message": f"Received {len(ips)} IP addresses",
            "ips_received": ips,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        print(f"[TEST] Error processing request: {e}")
        raise HTTPException(status_code=400, detail=str(e))


# Also add a GET version for easier testing
@app.get("/test")
def test_get():
    """
    GET version of test endpoint for easier debugging
    """
    print(f"[TEST] GET request to /test endpoint")
    return {
        "status": "success",
        "message": "Test endpoint is working",
        "timestamp": datetime.now().isoformat()
    }


@app.get("/llm")
def llm():
    return { "data": "llm" }