from fastapi import FastAPI, HTTPException
import requests
from sse_starlette import EventSourceResponse
import json
from scanner import run_scan 
from ping import get_avahi_devices

app = FastAPI()

@app.get("/ping")
def ping(timeout: float = 3.0):
    # response = requests.get("https://api.ipify.org?format=json")
    # return response.json()["ip"]
    try:
        # ping.py prints to stdout by default; we want a Python dict back.
        # So: call its internal helpers if you have them, otherwise expose a function.
        return ping.get_avahi_devices(timeout=timeout)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

@app.get("/scan")
async def scan(duration: int = 60, batch_interval: float = 2.0):
    async def event_generator():
        async for message in run_scan(duration, batch_interval):
            yield { "data": json.dumps(message) }
    return EventSourceResponse(event_generator())


@app.get("/nmap")
async def nmap(ips: list[str], timeout: int = 60, args: str = None):
    """
    Stream nmap scan results for provided IPs.
    Body: list of IP addresses
    Query params: timeout (seconds), args (nmap arguments as string)
    """
    nmap_args = args.split() if args else DEFAULT_NMAP_ARGS
    
    async def event_generator():
        async for message in stream_nmap_scan(ips, timeout, nmap_args):
            yield {"data": json.dumps(message)}
    
    return EventSourceResponse(event_generator())


@app.get("/llm")
def llm():
    return { "data": "llm" }
