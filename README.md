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

### 3. Start the servers

**Terminal 1 - Start Backend:**
```bash
.venv\Scripts\python backend/src/server.py    # Windows
# or
source .venv/bin/activate && python backend/src/server.py    # Linux/Mac
```

**Terminal 2 - Start Frontend:**
```bash
npm run dev
```

Frontend will be available at:
- **Local PC**: `http://localhost:5173`
- **Local Network**: `http://<your-pc-ip>:5173` (e.g., `http://192.168.1.113:5173`)

### 4. (Optional) Run on any device with camera access using HTTPS

For accessing the app from external networks or ensuring camera access works on all devices, use localtunnel:

**Terminal 3 - Start Tunnel:**
```bash
npx localtunnel --port 5173
```

This will output a public HTTPS URL like: `https://thin-emus-show.loca.lt`

**Access Points:**
| Device Type | URL | Camera Access |
|---|---|---|
| This PC | `http://localhost:5173` | ✓ Yes |
| Local Network | `http://192.168.1.113:5173` | ⚠️ Check browser |
| External / Any Device | `https://thin-emus-show.loca.lt` | ✓ Yes |

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
