import numpy as np
import tensorflow as tf
import keras
import json
import uvicorn
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import os

# --- Configuration ---
ASL_MODEL_PATH = "./model/lstm_model1.keras"
ASL_LABEL_MAP_PATH = "./model/label_map_lstm.json"
ASL_SEQ_LEN = 50
FEATURE_DIM = 63  # 21 landmarks * 3 (x,y,z)

VNSL_MODEL_PATH = "./model/vnsl_model.keras"
VNSL_SEQ_LEN = 16
VNSL_FEATURE_DIM = 64  # 63 landmarks + 1 openness

# 53 VNSL class names (consonants + vowels) — matches training class order
VNSL_CLASS_NAMES = [
    "a", "aa", "ah", "ai", "am", "au", "ba", "bha", "cha", "chha",
    "da", "dda", "ddha", "dha", "dsha", "e", "ga", "gha", "gya", "ha",
    "i", "ii", "ja", "jha", "ka", "kha", "ksha", "la", "ma", "msha",
    "na", "nga", "nna", "nya", "o", "pa", "pha", "ra", "ri", "sa",
    "sha", "ssa", "ta", "tha", "tra", "tsha", "tta", "ttha", "u", "uu",
    "wa", "ya", "yan",
]
DEVANAGARI = {
    "ka": "क", "kha": "ख", "ga": "ग", "gha": "घ", "nga": "ङ",
    "cha": "च", "chha": "छ", "ja": "ज", "jha": "झ", "nya": "ञ",
    "ta": "ट", "tha": "ठ", "da": "ड", "dha": "ढ", "na": "ण",
    "tta": "त", "ttha": "थ", "dda": "द", "ddha": "ध", "nna": "न",
    "pa": "प", "pha": "फ", "ba": "ब", "bha": "भ", "ma": "म",
    "ya": "य", "ra": "र", "la": "ल", "wa": "व", "sha": "श",
    "ssa": "ष", "sa": "स", "ha": "ह", "ksha": "क्ष", "tra": "त्र",
    "gya": "ज्ञ", "a": "अ", "aa": "आ", "i": "इ", "ii": "ई",
    "u": "उ", "uu": "ऊ", "e": "ए", "o": "ओ", "ai": "ऐ",
    "au": "औ", "am": "अं", "ah": "अः", "ri": "ऋ", "dsha": "स",
    "msha": "ष", "tsha": "श", "yan": "ञ",
}

# Alias normalization: model may output either name for the same letter
SIGN_ALIASES = {"dsha": "sa", "msha": "ssa", "tsha": "sha", "yan": "nya"}
def normalize_sign(name: str) -> str:
    return SIGN_ALIASES.get(name, name)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Load ASL Model & Labels ---
print("Loading ASL model...")
asl_infer_fn = None
try:
    asl_model = tf.keras.models.load_model(ASL_MODEL_PATH)
    # Compile inference graph with tf.function for ~100x speedup on CPU
    @tf.function(input_signature=[tf.TensorSpec(shape=(1, ASL_SEQ_LEN, FEATURE_DIM), dtype=tf.float32)])
    def _asl_infer(x):
        return asl_model(x, training=False)
    asl_infer_fn = _asl_infer
    print("ASL model loaded successfully.")
except Exception as e:
    print(f"Error loading ASL model: {e}")
    asl_model = None

try:
    with open(ASL_LABEL_MAP_PATH, "r") as f:
        asl_label_map = json.load(f)
        asl_inv_label_map = {v: k for k, v in asl_label_map.items()}
    print("ASL label map loaded.")
except Exception as e:
    print(f"Error loading ASL label map: {e}")
    asl_inv_label_map = {}

# --- Load VNSL Model (custom layer) ---
@keras.saving.register_keras_serializable(package="hamro")
class WeightedSum(keras.layers.Layer):
    def call(self, inputs):
        h, w = inputs
        return tf.reduce_sum(h * w, axis=1)

vnsl_infer_fn = None
print("Loading VNSL model...")
try:
    vnsl_model = tf.keras.models.load_model(VNSL_MODEL_PATH, compile=False)
    @tf.function(input_signature=[tf.TensorSpec(shape=(1, VNSL_SEQ_LEN, VNSL_FEATURE_DIM), dtype=tf.float32)])
    def _vnsl_infer(x):
        return vnsl_model(x, training=False)
    vnsl_infer_fn = _vnsl_infer
    print("VNSL model loaded successfully.")
except Exception as e:
    print(f"Error loading VNSL model: {e}")
    vnsl_model = None

# --- Preprocessing helpers ---
def flip_landmarks_x(seq):
    """Simulate cv2.flip(frame,1): invert X coords. Desktop ASL training used flipped frames."""
    seq = seq.copy()
    seq[:, 0::3] = 1.0 - seq[:, 0::3]
    return seq

def normalize_wrist_relative(frame_63):
    """Subtract wrist position and scale by palm size (matches VNSL training)."""
    frame = frame_63.copy()
    wrist = frame[:3].copy()
    for j in range(21):
        frame[j*3]   -= wrist[0]
        frame[j*3+1] -= wrist[1]
        frame[j*3+2] -= wrist[2]
    palm_size = np.sqrt(frame[9*3]**2 + frame[9*3+1]**2 + frame[9*3+2]**2)
    if palm_size > 1e-6:
        frame /= palm_size
    return frame

def engineer_features_64(raw_seq):
    """Raw landmarks (N, 63) → features (N, 64). Adds hand openness."""
    lm = raw_seq.reshape(-1, 21, 3)
    wrist = lm[:, 0:1, :]
    tips = lm[:, [4, 8, 12, 16, 20], :]
    dists = np.sqrt(((tips - wrist) ** 2).sum(axis=-1))
    openness = dists.mean(axis=1, keepdims=True)
    return np.concatenate([raw_seq, openness], axis=-1)

# --- Request Model ---
class SequenceInput(BaseModel):
    sequence: list

# --- Warmup: trace tf.function graphs so first real call is fast ---
print("Warming up models...")
if asl_infer_fn is not None:
    _dummy_asl = tf.constant(np.zeros((1, ASL_SEQ_LEN, FEATURE_DIM), dtype=np.float32))
    asl_infer_fn(_dummy_asl)
    print("ASL model warmed up.")
if vnsl_infer_fn is not None:
    _dummy_vnsl = tf.constant(np.zeros((1, VNSL_SEQ_LEN, VNSL_FEATURE_DIM), dtype=np.float32))
    vnsl_infer_fn(_dummy_vnsl)
    print("VNSL model warmed up.")

@app.get("/")
def home():
    return {"status": "running", "message": "SignAgya Backend is Active"}

@app.get("/health")
def health():
    return {
        "status": "ok",
        "asl_model_loaded": asl_infer_fn is not None,
        "vnsl_model_loaded": vnsl_infer_fn is not None,
    }

@app.post("/predict")
def predict(input_data: SequenceInput):
    """ASL prediction. Applies X-flip to match desktop training preprocessing."""
    if asl_infer_fn is None:
        raise HTTPException(status_code=500, detail="ASL model not loaded")

    seq = np.array(input_data.sequence, dtype=np.float32)

    # Pad/truncate to ASL_SEQ_LEN
    if len(seq) > ASL_SEQ_LEN:
        seq = seq[-ASL_SEQ_LEN:]
    elif len(seq) < ASL_SEQ_LEN:
        padding = np.zeros((ASL_SEQ_LEN - len(seq), FEATURE_DIM), dtype=np.float32)
        seq = np.vstack((padding, seq))
    if seq.shape[1] != FEATURE_DIM:
        raise HTTPException(status_code=400, detail=f"Expected {FEATURE_DIM} features, got {seq.shape[1]}")

    # Flip X coords removed — model was trained on raw (un-flipped) landmarks

    prediction = asl_infer_fn(tf.constant(seq[np.newaxis], dtype=tf.float32))
    probs = prediction[0].numpy().tolist()
    class_idx = int(np.argmax(prediction[0]))
    confidence = float(np.max(prediction[0]))
    predicted_char = asl_inv_label_map.get(class_idx, "?")

    if os.environ.get('DEBUG_PRED', '0') == '1':
        topk = sorted(enumerate(probs), key=lambda x: x[1], reverse=True)[:5]
        print(f"[ASL] Top-5:", [(asl_inv_label_map.get(i, '?'), f"{p:.3f}") for i, p in topk])

    return {"prediction": predicted_char, "confidence": confidence, "class_id": class_idx, "probabilities": probs}

@app.post("/predict_nsl")
def predict_nsl(input_data: SequenceInput):
    """NSL prediction using VNSL model. Matches v10g desktop pipeline exactly."""
    if vnsl_infer_fn is None:
        raise HTTPException(status_code=500, detail="VNSL model not loaded")

    seq = np.array(input_data.sequence, dtype=np.float32)

    if seq.shape[-1] != FEATURE_DIM:
        raise HTTPException(status_code=400, detail=f"Expected {FEATURE_DIM} features, got {seq.shape[-1]}")

    # Filter out zero frames (no hand detected) — desktop repeats last valid frame
    valid_mask = np.any(seq != 0, axis=1)
    valid_frames = seq[valid_mask]
    if len(valid_frames) == 0:
        return {"prediction": "-", "confidence": 0.0, "class_id": -1, "probabilities": []}

    # Subsample with FRAME_INTERVAL=2 to match desktop temporal spacing
    # Desktop collects every 2nd camera frame; web sends every frame
    # Take every 2nd frame from the valid frames to simulate FRAME_INTERVAL=2
    if len(valid_frames) >= VNSL_SEQ_LEN * 2:
        # Enough frames: take every 2nd from the last (VNSL_SEQ_LEN*2) valid frames
        sampled = valid_frames[-(VNSL_SEQ_LEN * 2)::2]
    elif len(valid_frames) > VNSL_SEQ_LEN:
        # Some frames: subsample evenly to get VNSL_SEQ_LEN frames
        indices = np.linspace(0, len(valid_frames) - 1, VNSL_SEQ_LEN, dtype=int)
        sampled = valid_frames[indices]
    else:
        sampled = valid_frames

    # Pad to VNSL_SEQ_LEN if still short (repeat last valid frame like desktop)
    if len(sampled) < VNSL_SEQ_LEN:
        last_valid = sampled[-1:]
        repeats = VNSL_SEQ_LEN - len(sampled)
        padding = np.tile(last_valid, (repeats, 1))
        sampled = np.vstack((padding, sampled))

    sampled = sampled[-VNSL_SEQ_LEN:]  # ensure exactly VNSL_SEQ_LEN

    # Apply wrist-relative normalization to each frame (matches extract_landmarks)
    normalized = np.array([normalize_wrist_relative(frame) for frame in sampled], dtype=np.float32)

    # Engineer features: add hand openness (63 → 64)
    features = engineer_features_64(normalized).astype(np.float32)

    # Predict
    logits = vnsl_infer_fn(tf.constant(features[np.newaxis], dtype=tf.float32))[0].numpy()
    exp = np.exp(logits - logits.max())
    probs = (exp / exp.sum()).tolist()
    class_idx = int(np.argmax(probs))
    confidence = float(max(probs))

    # Return romanized class name — frontend maps to Devanagari
    class_name = normalize_sign(VNSL_CLASS_NAMES[class_idx] if class_idx < len(VNSL_CLASS_NAMES) else "?")

    if os.environ.get('DEBUG_PRED', '0') == '1':
        topk = sorted(enumerate(probs), key=lambda x: x[1], reverse=True)[:5]
        print(f"[NSL] Top-5:", [(VNSL_CLASS_NAMES[i] if i < len(VNSL_CLASS_NAMES) else '?', f"{p:.3f}") for i, p in topk])

    return {"prediction": class_name, "confidence": confidence, "class_id": class_idx, "probabilities": probs}

# --- WebSocket endpoint for low-latency streaming predictions ---
def _run_asl(seq_raw):
    seq = np.array(seq_raw, dtype=np.float32)
    if len(seq) > ASL_SEQ_LEN:
        seq = seq[-ASL_SEQ_LEN:]
    elif len(seq) < ASL_SEQ_LEN:
        padding = np.zeros((ASL_SEQ_LEN - len(seq), FEATURE_DIM), dtype=np.float32)
        seq = np.vstack((padding, seq))
    if seq.shape[1] != FEATURE_DIM:
        return {"error": f"Expected {FEATURE_DIM} features"}
    prediction = asl_infer_fn(tf.constant(seq[np.newaxis], dtype=tf.float32))
    probs = prediction[0].numpy()
    class_idx = int(np.argmax(probs))
    return {"prediction": asl_inv_label_map.get(class_idx, "?"), "confidence": float(probs[class_idx])}

def _run_nsl(seq_raw):
    seq = np.array(seq_raw, dtype=np.float32)
    if seq.shape[-1] != FEATURE_DIM:
        return {"error": f"Expected {FEATURE_DIM} features"}
    valid_mask = np.any(seq != 0, axis=1)
    valid_frames = seq[valid_mask]
    if len(valid_frames) == 0:
        return {"prediction": "-", "confidence": 0.0}
    if len(valid_frames) >= VNSL_SEQ_LEN * 2:
        sampled = valid_frames[-(VNSL_SEQ_LEN * 2)::2]
    elif len(valid_frames) > VNSL_SEQ_LEN:
        indices = np.linspace(0, len(valid_frames) - 1, VNSL_SEQ_LEN, dtype=int)
        sampled = valid_frames[indices]
    else:
        sampled = valid_frames
    if len(sampled) < VNSL_SEQ_LEN:
        last_valid = sampled[-1:]
        repeats = VNSL_SEQ_LEN - len(sampled)
        sampled = np.vstack((np.tile(last_valid, (repeats, 1)), sampled))
    sampled = sampled[-VNSL_SEQ_LEN:]
    normalized = np.array([normalize_wrist_relative(frame) for frame in sampled], dtype=np.float32)
    features = engineer_features_64(normalized).astype(np.float32)
    logits = vnsl_infer_fn(tf.constant(features[np.newaxis], dtype=tf.float32))[0].numpy()
    exp = np.exp(logits - logits.max())
    probs = (exp / exp.sum())
    class_idx = int(np.argmax(probs))
    class_name = normalize_sign(VNSL_CLASS_NAMES[class_idx] if class_idx < len(VNSL_CLASS_NAMES) else "?")
    return {"prediction": class_name, "confidence": float(probs[class_idx])}

@app.websocket("/ws")
async def websocket_predict(websocket: WebSocket):
    await websocket.accept()
    # Per-connection NSL prediction smoothing (majority vote over last 5)
    nsl_pred_history: list[str] = []
    NSL_SMOOTH_WINDOW = 5
    try:
        while True:
            msg = await websocket.receive_json()
            mode = msg.get("mode", "asl")
            seq = msg.get("sequence", [])
            if mode == "nsl" and vnsl_infer_fn is not None:
                result = _run_nsl(seq)
                # Apply majority-vote smoothing
                raw_pred = result.get("prediction", "-")
                if raw_pred != "-":
                    nsl_pred_history.append(raw_pred)
                    if len(nsl_pred_history) > NSL_SMOOTH_WINDOW:
                        nsl_pred_history.pop(0)
                    if len(nsl_pred_history) >= 3:
                        from collections import Counter
                        counts = Counter(nsl_pred_history)
                        smoothed, _ = counts.most_common(1)[0]
                        result["prediction"] = smoothed
            elif asl_infer_fn is not None:
                result = _run_asl(seq)
            else:
                result = {"error": "model not loaded"}
            await websocket.send_json(result)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[WS] Error: {e}")

if __name__ == "__main__":
    # 0.0.0.0 allows access from other devices on the network
    # Default to port 8000 to avoid colliding with the frontend dev server on 3000.
    port = int(os.environ.get('PORT', os.environ.get('BACKEND_PORT', 8000)))
    print(f"Starting server on 0.0.0.0:{port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
    