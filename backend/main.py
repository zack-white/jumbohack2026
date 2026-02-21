from fastapi import FastAPI
import requests

app = FastAPI()

@app.get("/ping")
def ping():
    response = requests.get("https://api.ipify.org?format=json")
    return response.json()["ip"]

@app.get("/scan")
def scan():
    return { "data": "scan" }


@app.get("/llm")
def llm():
    return { "data": "llm" }
