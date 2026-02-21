from fastapi import FastAPI
import subprocess

app = FastAPI()

@app.get("/ping")
def ping():
    result = subprocess.run(["hostname", "-i"], capture_output=True, text=True)
    return result.stdout


@app.get("/scan")
def scan():
    return { "data": "scan" }


@app.get("/llm")
def llm():
    return { "data": "llm" }
