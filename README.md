# SignAgya

Real-time Sign Language recognition web app supporting ASL (American Sign Language)
and NSL (Nepali Sign Language). Uses MediaPipe for hand landmark detection and
LSTM/Attention models for sign classification.

## Features

- **Learn Mode** — Practice individual signs with real-time feedback
- **Endless Mode** — Continuous sign recognition challenge
- **Word Builder** — Spell Nepali words using NSL fingerspelling (with Devanagari vowel combining)
- ASL (26 letters) and NSL (53 characters) support
- WebSocket predictions for low latency, HTTP fallback
- Works fully offline on LAN — no internet required

## Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- Webcam
- ngrok account (free) - [Sign up here](https://dashboard.ngrok.com)

### 1. Install frontend dependencies

```bash
npm install
```

### 2. Create Python virtual environment and install backend

```bash
python -m venv .venv
# Linux/Mac:
source .venv/bin/activate
# Windows:
.venv\Scripts\activate

pip install -r requirements.txt
```

### 3. Configure ngrok (One-time setup)

Get your ngrok authtoken from https://dashboard.ngrok.com/get-started/your-authtoken

```bash
ngrok config add-authtoken YOUR_AUTHTOKEN_HERE
```

### 4. Start all services (4 terminals required)

Open 4 separate terminals in your project directory:

**Terminal 1 - Backend:**
```bash
.venv\Scripts\python backend/src/server.py    # Windows
# or
source .venv/bin/activate && python backend/src/server.py    # Linux/Mac
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

**Terminal 3 - Backend ngrok tunnel:**
```bash
ngrok http 8000
```
Copy the HTTPS URL shown (e.g., `https://abc-def-ghi.ngrok-free.dev`)

**Terminal 4 - Frontend ngrok tunnel:**
```bash
ngrok http 5173
```

### 5. Set environment variables and restart frontend

Before running frontend, set the backend API URL. In **Terminal 2**, stop it (Ctrl+C) and run:

**Windows:**
```bash
set VITE_API_URL=https://<BACKEND_NGROK_URL>/predict
set VITE_NSL_API_URL=https://<BACKEND_NGROK_URL>/predict_nsl
npm run dev
```

**Linux/Mac:**
```bash
export VITE_API_URL=https://<BACKEND_NGROK_URL>/predict
export VITE_NSL_API_URL=https://<BACKEND_NGROK_URL>/predict_nsl
npm run dev
```

Replace `<BACKEND_NGROK_URL>` with the URL from Terminal 3 (without `/predict` at the end).

### 6. Access the app

Use the **FRONTEND ngrok URL** from Terminal 4 to access the app from any device:

```
https://<FRONTEND_NGROK_URL>
```

**Access Points:**
| Device Type | URL | Camera Access | Notes |
|---|---|---|---|
| This PC | `http://localhost:5173` | ✓ Yes | Local only |
| Local Network | `http://192.168.1.113:5173` | ⚠️ Mixed | Same WiFi only |
| Any Device (Recommended) | `https://<frontend-ngrok-url>` | ✓ Yes | Works anywhere, requires HTTPS |

**Example:**
```
Frontend URL: https://nigel-bagwigged-first.ngrok-free.dev
Backend URL: https://example-backend-123.ngrok-free.dev

Then set:
VITE_API_URL=https://example-backend-123.ngrok-free.dev/predict
VITE_NSL_API_URL=https://example-backend-123.ngrok-free.dev/predict_nsl
```

## Project Structure

```
├── App.tsx                     # Root React component
├── index.html / index.tsx      # Entry points
├── constants.ts                # Shared constants, Devanagari maps, sign aliases
├── types.ts                    # TypeScript interfaces
├── vite.config.ts              # Vite config (proxy /api → backend, host 0.0.0.0)
├── components/
│   ├── SignGame.tsx             # Main game controller
│   ├── CameraView.tsx          # MediaPipe camera + landmark extraction
│   ├── SplashScreen.tsx        # Loading screen (preloads MediaPipe)
│   ├── HomeScreen.tsx          # Home / language select
│   ├── ModeSelectScreen.tsx    # Game mode selection
│   └── gamemode/
│       ├── LearnMode.tsx       # Practice individual signs
│       ├── EndlessMode.tsx     # Continuous challenge
│       └── WordBuilderMode.tsx # Nepali word spelling
├── services/
│   ├── apiService.ts           # Prediction API (WebSocket + HTTP)
│   └── mediapipeLoader.ts      # Singleton MediaPipe preloader
├── backend/
│   └── src/server.py           # FastAPI backend (ASL + NSL inference)
├── model/                      # AI models
│   ├── lstm_model1.keras       # ASL LSTM model
│   ├── vnsl_model.keras        # NSL v10g Attention model
│   └── label_map_lstm.json     # ASL class labels
└── public/
    ├── mediapipe/              # MediaPipe WASM + hand model (bundled)
    ├── asl_mirrored/           # ASL reference images
    └── nsl_signs/              # NSL reference images
```

## Backend API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check + model status |
| `/predict` | POST | ASL prediction |
| `/predict_nsl` | POST | NSL prediction |
| `/ws` | WebSocket | Low-latency prediction channel |

## Requirements

- Python 3.10+ with TensorFlow 2.x
- Node.js 18+
- Webcam

## Contributors

- An0nym0ss
- nabin-khadka
