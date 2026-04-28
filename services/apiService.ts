import { API_URL, NSL_API_URL } from '../constants';
import { PredictionResponse } from '../types';

// --- WebSocket singleton for low-latency predictions ---
let ws: WebSocket | null = null;
let wsReady = false;
let pendingResolve: ((val: PredictionResponse | null) => void) | null = null;

function getWsUrl(): string {
  const loc = window.location;
  const proto = loc.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${loc.host}/api/ws`;
}

function ensureWs(): WebSocket | null {
  if (ws && ws.readyState === WebSocket.OPEN) return ws;
  if (ws && ws.readyState === WebSocket.CONNECTING) return ws;
  try {
    ws = new WebSocket(getWsUrl());
    ws.onopen = () => { wsReady = true; };
    ws.onmessage = (ev) => {
      if (pendingResolve) {
        try {
          const data = JSON.parse(ev.data);
          pendingResolve({ prediction: data.prediction, confidence: data.confidence, probabilities: data.probabilities });
        } catch { pendingResolve(null); }
        pendingResolve = null;
      }
    };
    ws.onclose = () => { wsReady = false; ws = null; };
    ws.onerror = () => { wsReady = false; ws = null; };
    return ws;
  } catch {
    return null;
  }
}

// Initialize WebSocket on module load
ensureWs();

function wsSend(mode: string, sequence: number[][]): Promise<PredictionResponse | null> {
  return new Promise((resolve) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      resolve(null);
      return;
    }
    pendingResolve = resolve;
    ws.send(JSON.stringify({ mode, sequence }));
    // Timeout if no response in 2s
    setTimeout(() => { if (pendingResolve === resolve) { pendingResolve = null; resolve(null); } }, 2000);
  });
}

// Test backend connectivity
export const testBackendConnection = async (): Promise<boolean> => {
  try {
    const baseUrl = API_URL.replace('/predict', '');
    const response = await fetch(`${baseUrl}/`, { method: 'GET' });
    return response.ok;
  } catch {
    return false;
  }
};

/**
 * ASL prediction — uses WebSocket if available, falls back to HTTP.
 */
export const predictGesture = async (sequence: number[][]): Promise<PredictionResponse | null> => {
  ensureWs();
  if (wsReady && ws?.readyState === WebSocket.OPEN) {
    return wsSend('asl', sequence);
  }
  return _predict(API_URL, sequence);
};

/**
 * NSL prediction — uses WebSocket if available, falls back to HTTP.
 */
export const predictNSL = async (sequence: number[][]): Promise<PredictionResponse | null> => {
  ensureWs();
  if (wsReady && ws?.readyState === WebSocket.OPEN) {
    return wsSend('nsl', sequence);
  }
  return _predict(NSL_API_URL, sequence);
};

async function _predict(url: string, sequence: number[][]): Promise<PredictionResponse | null> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sequence }),
    });

    if (!response.ok) throw new Error(`Server error: ${response.status}`);
    const data = await response.json();
    return { prediction: data.prediction, confidence: data.confidence, probabilities: data.probabilities };
  } catch {
    return null;
  }
}