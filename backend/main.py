from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import requests
from scanner import run_scan 

app = FastAPI()

@app.get("/ping")
def ping():
    response = requests.get("https://api.ipify.org?format=json")
    return response.json()["ip"]

@app.websocket("/scan")
async def scan(websocket: WebSocket, duration: int = 60, batch_interval: float = 2.0):
    await websocket.accept()
    try:
        async for message in run_scan(duration, batch_interval):
            await websocket.send_json(message)
    except WebSocketDisconnect:
        pass


@app.get("/nmap")
def nmap():
    return


@app.get("/llm")
def llm():
    return { "data": "llm" }
