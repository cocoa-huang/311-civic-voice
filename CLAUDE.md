# 311 Civic Voice Agent — Project Context

**Hackathon**: NYC Build With AI (GDG NYC x NYU Tandon)
**Date**: March 28 2026 — Deadline: 2:30 PM ET
**Status**: Implementation in progress (or about to begin)

---

## What This Project Does

A resident points their phone camera at a civic issue (pothole, broken streetlight, graffiti, flooding, etc.) and speaks to an AI agent. The agent uses **Gemini Live API** to see the camera in real time, guides the resident ("tilt down so I can see the full pothole"), gathers all complaint details through natural conversation, then generates a professional NYC 311 complaint report routed to the correct city department.

**The key demo moment**: Agent actively directing the camera angle — proving real-time vision + bidirectional voice in one gesture.

---

## Hackathon Requirements (mandatory)
- Must use **Gemini Live API** (real-time audio + vision)
- Must use **Google GenAI SDK** (using raw SDK, not ADK — satisfies requirement)
- Must be hosted on **Google Cloud Run**
- Must use **NYC Open Data 311 Socrata API** (dataset `erm2-nwe9`) for department routing
- Must NOT be a basic chatbot — interaction must be live, natural, interruptible

---

## Tech Stack
- **Backend**: Python + FastAPI (WebSocket proxy to Gemini Live)
- **Frontend**: React + Tailwind + Vite (single-screen PWA, 3 states)
- **AI**: Gemini Live API via `google-genai` Python SDK
- **Model**: `gemini-live-2.5-flash-native-audio` (use this exact name)
- **Data**: NYC 311 Socrata API `https://data.cityofnewyork.us/resource/erm2-nwe9.json`
- **Maps**: Google Maps Static API (no JS SDK needed, just image embed)
- **Deploy**: Google Cloud Run — single container (multi-stage Dockerfile: Node build → Python serve)

---

## Project Structure
```
gdg-hackathon/
├── backend/
│   ├── main.py              # FastAPI + CORS + serves static frontend
│   ├── live_session.py      # /ws/live WebSocket proxy to Gemini Live (CORE FILE)
│   ├── report.py            # generate_report_pipeline + /api/report endpoint
│   ├── routing.py           # 311 Socrata queries + hardcoded fallback routing table
│   ├── requirements.txt
│   └── Dockerfile           # Multi-stage: Node (Vite) → Python
├── frontend/
│   ├── public/
│   │   └── audio-processor.js   # AudioWorklet PCM processor (NOT an ES module, must be in public/)
│   ├── src/
│   │   ├── App.jsx              # State machine: "intake" | "processing" | "report"
│   │   ├── components/
│   │   │   ├── IntakeView.jsx       # Full-screen camera + mic button + live transcript
│   │   │   ├── ProcessingView.jsx   # "Agent writing your report..." animation
│   │   │   └── ReportCard.jsx       # Report output: narrative, map, department, submit
│   │   ├── hooks/
│   │   │   ├── useAgentSocket.js    # WS connect/send audio+video/receive
│   │   │   ├── useCamera.js         # getUserMedia + 1 FPS JPEG frame capture
│   │   │   └── useAudio.js          # Dual AudioContext: 16kHz input + 24kHz playback
│   │   └── main.jsx
│   ├── vite.config.js           # Proxy /ws → :8000, /api → :8000 for local dev
│   └── package.json
├── .env                         # GEMINI_API_KEY, SOCRATA_APP_TOKEN, GOOGLE_MAPS_API_KEY
├── .env.development             # VITE_WS_BASE=ws://localhost:8000, VITE_MAPS_KEY=...
└── CLAUDE.md                    # This file
```

---

## Build Order (do in this sequence)
1. **Phase 0** (15 min): Init git + create GitHub repo (`gh repo create 311-civic-voice --public`), create `.gitignore` (exclude `.env`, `.venv/`, `node_modules/`, `frontend/dist/`), scaffold Vite + FastAPI, create `audio-processor.js` in public/
2. **Phase 1** (50 min): Audio-only live loop — voice conversation works end-to-end
3. **Phase 2** (25 min): Video streaming — agent can see camera, guides angle
4. **Phase 3** (35 min): Tool calling + report generation pipeline
5. **Phase 4** (20 min): Report card UI (Tailwind, map embed, professional look)
6. **Phase 5** (20 min): Cloud Run deploy (do last)

---

## Critical Technical Details

### Gemini Live Session — Core Pattern
The WebSocket proxy uses `asyncio.gather(send_loop, receive_loop)` — NOT sequential. Both loops must run concurrently or it deadlocks.

```python
MODEL = "gemini-live-2.5-flash-native-audio"  # exact model name

config = types.LiveConnectConfig(
    response_modalities=["AUDIO"],
    system_instruction=types.Content(parts=[types.Part(text=SYSTEM_PROMPT)]),
    tools=[GENERATE_REPORT_TOOL],
    output_audio_transcription=types.AudioTranscriptionConfig(),
    context_window_compression=types.ContextWindowCompressionConfig(trigger_tokens=25600),
)
```

### WebSocket Message Protocol
**Client → Server**: `{"type": "audio"|"video"|"stop", "data": "<base64>"}`
**Server → Client**: `{"type": "audio"|"transcript"|"report_ready"|"interrupted"|"session_expiring", ...}`

### Audio Format
- **Input to Gemini**: raw 16-bit PCM, 16kHz, little-endian → `mime_type="audio/pcm;rate=16000"`
- **Output from Gemini**: raw 16-bit PCM, 24kHz, little-endian
- Use **two separate AudioContexts**: `new AudioContext({sampleRate:16000})` for input, `new AudioContext({sampleRate:24000})` for output
- `audio-processor.js` converts float32→int16 in AudioWorklet, MUST be in `frontend/public/` (not imported as ES module)
- Load it via: `await audioContext.audioWorklet.addModule("/audio-processor.js")`

### Video Frame Capture
- `facingMode: "environment"` for rear camera
- Canvas capture every 1000ms (1 FPS max for Gemini), encode as JPEG quality 0.8

### Tool Declaration (for generate_report)
Use `types.Tool(function_declarations=[types.FunctionDeclaration(...)])` with `parameters_json_schema` dict.
Required params: `complaint_type`, `description`, `severity`, `location_hint`
Optional: `lat`, `lng`

### 311 Socrata API
- `GET https://data.cityofnewyork.us/resource/erm2-nwe9.json`
- Routing: `?$where=complaint_type='Pothole'&$limit=1&$select=agency`
- Use `agency` field (NOT `agency_name` — has data quality issues)
- Nearby count: bounding box `lat±0.005, lng±0.005`
- `X-App-Token` header for auth

### Hardcoded Routing Fallback
```python
COMPLAINT_TO_AGENCY = {
    "Pothole": {"agency": "DOT", "name": "Dept of Transportation"},
    "Street Light Condition": {"agency": "DOT", "name": "Dept of Transportation"},
    "Graffiti": {"agency": "DSNY", "name": "Sanitation"},
    "Illegal Dumping": {"agency": "DSNY", "name": "Sanitation"},
    "Rodent": {"agency": "DOHMH", "name": "Dept of Health & Mental Hygiene"},
    "Flooding": {"agency": "DEP", "name": "Dept of Environmental Protection"},
    "Noise - Residential": {"agency": "NYPD", "name": "Police Department"},
    "HEAT/HOT WATER": {"agency": "HPD", "name": "Housing Preservation & Development"},
}
```

### System Prompt (agent behavior)
```
You are a 311 Civic Voice Agent for NYC. Help residents report civic issues efficiently.
You see through their camera in real time.
1. Identify the issue (pothole, streetlight, graffiti, flooding, illegal dumping, rodent, noise...)
2. Guide camera: "Can you tilt down slightly so I can see the full extent?"
3. Gather: street address or cross streets, how long the issue has existed, severity
4. Confirm details, then call generate_report()
Keep responses to 1-2 sentences. NYC residents are busy.
Do NOT call generate_report until you have confirmed location from the resident.
```

### Google Maps Static API (in ReportCard)
```jsx
`https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=16&size=600x200&markers=color:red|${lat},${lng}&key=${import.meta.env.VITE_MAPS_KEY}`
```

### Vite Dev Proxy
```js
server: { proxy: { "/ws": { target: "ws://localhost:8000", ws: true }, "/api": "http://localhost:8000" } }
```

### Cloud Run Deploy
```bash
gcloud run deploy 311-civic-voice \
  --source . --region us-central1 \
  --timeout=300 \
  --set-env-vars GEMINI_API_KEY=...,SOCRATA_APP_TOKEN=...,GOOGLE_MAPS_API_KEY=...
```

### Dockerfile (multi-stage)
```dockerfile
FROM node:20-alpine AS frontend-builder
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ .
COPY --from=frontend-builder /frontend/dist ./static
EXPOSE 8080
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}"]
```

---

## Report Data Shape (what ReportCard.jsx receives)
```json
{
  "complaint_type": "Pothole",
  "description": "Large pothole ~2ft wide with exposed rebar",
  "severity": "High",
  "location_hint": "Corner of Atlantic Ave and 4th Ave, Brooklyn",
  "lat": 40.6782, "lng": -73.9442,
  "agency": "DOT",
  "agency_name": "Dept of Transportation",
  "nearby_count": 12,
  "narrative": "A significant pothole measuring approximately two feet in width...",
  "timestamp": "2026-03-28T14:30:00Z"
}
```

---

## Minimum Viable Demo (if short on time)
Keep: camera + voice loop, agent directs camera, tool call → report card
Cut: Google Maps embed, Socrata historical count, submit POST, Cloud Run (use ngrok)

---

## Common Gotchas
| Issue | Fix |
|-------|-----|
| Model not found | Use `gemini-live-2.5-flash-native-audio` exactly |
| Audio worklet silent | `audio-processor.js` must be in `frontend/public/`, load via `addModule("/audio-processor.js")` |
| WS drops at 60s on Cloud Run | `--timeout=300` on deploy |
| No audio on iOS | Call `startCapture()` from onClick, never from useEffect |
| Session drops at 2 min | Enable `context_window_compression` in LiveConnectConfig |
| goAway disconnects mid-demo | Handle `response.go_away` in receive_loop, send `{"type":"session_expiring"}` to frontend |
| CORS in local dev | Vite proxy handles it; also add FastAPI CORSMiddleware |
| WS URL broken on Cloud Run | Derive WS URL from `window.location.protocol/host`, not hardcoded |
