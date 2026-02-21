from fastapi import FastAPI
import requests
from sse_starlette import EventSourceResponse
import json
from scanner import run_scan 

app = FastAPI()

@app.get("/ping")
def ping():
    response = requests.get("https://api.ipify.org?format=json")
    return response.json()["ip"]

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
