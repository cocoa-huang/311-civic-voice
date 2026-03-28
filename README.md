# 311 Civic Voice Agent

A real-time AI agent that helps NYC residents report civic issues by pointing their phone camera at the problem and speaking naturally. Built for the NYC Build With AI Hackathon (GDG NYC x NYU Tandon).

## What It Does

1. Resident points their camera at a civic issue (pothole, broken streetlight, graffiti, flooding, etc.)
2. The AI agent sees the camera feed in real time and guides the resident — "tilt down so I can see the full pothole"
3. Agent gathers all complaint details through natural conversation
4. Generates a professional NYC 311 complaint report and routes it to the correct city department

## Tech Stack

- **AI**: Gemini Live API `gemini-live-2.5-flash-native-audio` via Vertex AI
- **Backend**: Python 3.12 + FastAPI (WebSocket proxy to Gemini Live)
- **Frontend**: React + Tailwind + Vite (PWA)
- **Data**: NYC Open Data 311 Socrata API for department routing
- **Maps**: Google Maps Static API
- **Deploy**: Google Cloud Run

## WebSocket Message Protocol

**Client → Server**: `{"type": "audio"|"video"|"stop", "data": "<base64>"}`

**Server → Client**:
- `{"type": "audio", "data": "<base64 PCM>"}` — agent voice response
- `{"type": "transcript", "text": "..."}` — agent speech transcript
- `{"type": "report_ready", "report": {...}}` — complaint report generated
- `{"type": "session_expiring"}` — Gemini session about to close

## Local Development

### Prerequisites

- Python 3.12
- Node.js 20+
- GCP project with Vertex AI API enabled
- `gcloud auth application-default login` completed

### Setup

```bash
# Clone the repo
git clone https://github.com/cocoa-huang/311-civic-voice.git
cd 311-civic-voice

# Backend — use Python 3.12 explicitly
python3.12 -m venv .venv
source .venv/bin/activate.fish  # fish shell
# or: source .venv/bin/activate  # bash/zsh
pip install -r backend/requirements.txt

# Frontend
cd frontend && npm install && cd ..

# Environment
cp .env.example .env
# Set GOOGLE_CLOUD_PROJECT in .env
```

### Run

```bash
# Terminal 1 — backend (run from backend/ directory)
cd backend && ../.venv/bin/python3 -m uvicorn main:app --reload --port 8000

# Terminal 2 — frontend
cd frontend && npm run dev
```

Open http://localhost:5173, tap the mic button, and start talking.

### Expose to local network (for phone testing)

```bash
cd frontend && npm run dev -- --host
# Then open http://YOUR_MAC_IP:5173 on your phone
ipconfig getifaddr en0  # find your IP
```

## Project Structure

```
├── backend/
│   ├── main.py          # FastAPI app + CORS + static serving
│   ├── live_session.py  # WebSocket proxy to Gemini Live (core)
│   ├── report.py        # Report generation pipeline
│   ├── routing.py       # NYC 311 Socrata API + department routing
│   └── Dockerfile
├── frontend/
│   ├── public/
│   │   └── audio-processor.js  # AudioWorklet PCM processor (must stay in public/)
│   └── src/
│       ├── App.jsx              # State machine: intake → processing → report
│       ├── components/          # IntakeView, ProcessingView, ReportCard
│       └── hooks/               # useAudio, useCamera, useAgentSocket
└── .env.example
```

## Environment Variables

```
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
GOOGLE_CLOUD_LOCATION=us-central1
SOCRATA_APP_TOKEN=optional-for-rate-limits
GOOGLE_MAPS_API_KEY=for-map-embed-in-report-card
```

Authentication uses Application Default Credentials (ADC) — no API key needed.

## Deploy to Cloud Run

```bash
gcloud run deploy 311-civic-voice \
  --source . \
  --region us-central1 \
  --timeout=300 \
  --set-env-vars GOOGLE_CLOUD_PROJECT=...,SOCRATA_APP_TOKEN=...,GOOGLE_MAPS_API_KEY=...
```
