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
def nmap():
    return


@app.get("/llm")
def llm():
    return { "data": "llm" }
