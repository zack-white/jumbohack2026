# PingPoint — Network Insight

Frontend frame for a hackathon app that visualizes packet/network analysis: a pannable device map and an AI assistant panel.

## Run locally

```bash
npm install
npm run dev
```

Open the URL shown in the terminal (e.g. http://localhost:5173).

## What’s in the frame

- **Header**: “Add device” button — each click adds a new device and auto-places it on the map (grid + jitter).
- **Center**: Pannable “map” — drag the background to move around; device nodes are laid out in a grid. Devices use placeholder status styling (e.g. `data-status="online"` ready for real data).
- **Right panel**: “Network assistant” — text area to ask questions and a placeholder reply (no AI backend yet).

## Next steps for the hackathon

- Hook up real packet/device data and drive `devices` from your backend or capture pipeline.
- Replace the placeholder AI reply with your model API (e.g. OpenAI, local LLM) and pass network context (device list, summaries, alerts).
- Optionally: zoom, device drag-to-reposition, connections between devices, and filters (by status, type, etc.).
