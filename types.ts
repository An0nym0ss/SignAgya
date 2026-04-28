export type Language = 'asl' | 'nsl';

export interface Landmark {
  x: number;
  y: number;
  z: number;
}

export interface PredictionResponse {
  prediction: string;
  confidence: number;
  probabilities?: number[];
  hand?: string;
}

export interface GameState {
  score: number;
  target: string;
  lastPrediction: string;
  confidence: number;
  isBackendConnected: boolean;
}