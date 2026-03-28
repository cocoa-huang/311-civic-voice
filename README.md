# 311 Civic Voice Agent

A real-time AI agent that helps NYC residents report civic issues by pointing their phone camera at the problem and speaking naturally. Built for the NYC Build With AI Hackathon (GDG NYC x NYU Tandon).

## What It Does

1. Resident points their camera at a civic issue (pothole, broken streetlight, graffiti, flooding, etc.)
2. The AI agent sees the camera feed in real time and guides the resident — "tilt down so I can see the full pothole"
3. Agent gathers all complaint details through natural conversation
4. Generates a professional NYC 311 complaint report and routes it to the correct city department

## Tech Stack

- **AI**: Gemini Live API (real-time audio + vision)
- **Backend**: Python + FastAPI (WebSocket proxy to Gemini Live)
- **Frontend**: React + Tailwind + Vite (PWA)
- **Data**: NYC Open Data 311 Socrata API for department routing
- **Maps**: Google Maps Static API
- **Deploy**: Google Cloud Run

## Local Development

### Prerequisites

- Python 3.12+
- Node.js 20+
- API keys: `GEMINI_API_KEY`, `SOCRATA_APP_TOKEN`, `GOOGLE_MAPS_API_KEY`

### Setup

```bash
# Clone the repo
git clone https://github.com/cocoa-huang/311-civic-voice.git
cd 311-civic-voice

# Backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r backend/requirements.txt

# Frontend
cd frontend && npm install && cd ..

# Environment
cp .env.example .env
# Fill in your API keys in .env
```

### Run

```bash
# Terminal 1 — backend
source .venv/bin/activate
uvicorn backend.main:app --reload --port 8000

# Terminal 2 — frontend
cd frontend && npm run dev
```

Open http://localhost:5173, tap the mic button, and start talking.

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
│   │   └── audio-processor.js  # AudioWorklet PCM processor
│   └── src/
│       ├── App.jsx              # State machine: intake → processing → report
│       ├── components/          # IntakeView, ProcessingView, ReportCard
│       └── hooks/               # useAudio, useCamera, useAgentSocket
└── .env.example
```

## Deploy to Cloud Run

```bash
gcloud run deploy 311-civic-voice \
  --source . \
  --region us-central1 \
  --timeout=300 \
  --set-env-vars GEMINI_API_KEY=...,SOCRATA_APP_TOKEN=...,GOOGLE_MAPS_API_KEY=...
```
