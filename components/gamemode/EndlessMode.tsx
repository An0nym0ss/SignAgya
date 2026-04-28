import React, { useRef, useState, useCallback } from 'react';
import { SEQUENCE_LENGTH, ALPHABET, NSL_CLASSES, DEVANAGARI, signsMatch } from '../../constants';
import { predictGesture, predictNSL } from '../../services/apiService';
import { GameState, Language } from '../../types';
import CameraView from '../CameraView';
import HUD from '../HUD';
import StatsPanel from '../StatsPanel';

type EndlessModeProps = {
  language: Language;
  onEnd?: () => void;
};

const EndlessMode: React.FC<EndlessModeProps> = ({ language, onEnd }) => {
  const isNSL = language === 'nsl';
  const alphabet = isNSL ? NSL_CLASSES : ALPHABET.split('');
  const predict = isNSL ? predictNSL : predictGesture;

  const randomTarget = () => alphabet[Math.floor(Math.random() * alphabet.length)];
  const displayChar = (c: string) => isNSL ? (DEVANAGARI[c] || c) : c;

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [state, setState] = useState<GameState>({
    score: 0,
    target: alphabet[Math.floor(Math.random() * alphabet.length)],
    lastPrediction: '-',
    confidence: 0,
    isBackendConnected: false
  });

  const sequenceBufferRef = useRef<number[][]>([]);
  const lastPredictionTimeRef = useRef<number>(0);
  const isPredictingRef = useRef<boolean>(false);
  const animationFrameId = useRef<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const checkPrediction = async () => {
    const now = Date.now();
    const bufferLength = sequenceBufferRef.current.length;
    if (isPredictingRef.current) return;
    if (now - lastPredictionTimeRef.current > 200 && bufferLength >= SEQUENCE_LENGTH) {
      lastPredictionTimeRef.current = now;
      isPredictingRef.current = true;

      const currentSequence = [...sequenceBufferRef.current].slice(-SEQUENCE_LENGTH);

      try {
        const result = await predict(currentSequence);

        if (result) {
          setState(prev => {
            const isMatch = isNSL ? signsMatch(result.prediction, prev.target) : result.prediction === prev.target;
            let newScore = prev.score;
            let newTarget = prev.target;

            if (isMatch && result.confidence > 0.7) {
              newScore += 1;
              const remaining = alphabet.filter(c => c !== prev.target);
              newTarget = remaining[Math.floor(Math.random() * remaining.length)];
              sequenceBufferRef.current = [];
            }

            return {
              ...prev,
              lastPrediction: result.prediction,
              confidence: result.confidence,
              score: newScore,
              target: newTarget,
              isBackendConnected: true
            };
          });
        } else {
          setState(prev => ({ ...prev, isBackendConnected: false }));
        }
      } finally {
        isPredictingRef.current = false;
      }
    }
  };

  const checkPredictionRef = useRef(checkPrediction);
  checkPredictionRef.current = checkPrediction;

  const loop = useCallback(() => {
    checkPredictionRef.current().catch(e => console.error(e));
    animationFrameId.current = requestAnimationFrame(loop);
  }, []);

  React.useEffect(() => {
    animationFrameId.current = requestAnimationFrame(loop);
    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, [loop]);

  return (
    <div className="w-full bg-slate-50 rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
      <div className="md:flex md:flex-row">
        <div className="md:w-1/2 lg:w-3/5 relative">
          <HUD target={displayChar(state.target)} score={state.score} />
          <CameraView videoRef={videoRef} canvasRef={canvasRef} sequenceBufferRef={sequenceBufferRef} />
        </div>

        <div className="md:w-1/2 lg:w-2/5 md:flex md:flex-col">
          {/* Show target sign name for NSL */}
          {isNSL && (
            <div className="bg-white px-4 py-2 border-b border-gray-100 text-center">
              <span className="text-xs text-gray-400 font-mono">SIGN: </span>
              <span className="text-sm font-bold text-slate-700 font-mono">{state.target}</span>
            </div>
          )}

          <StatsPanel
            lastPrediction={displayChar(state.lastPrediction)}
            confidence={state.confidence}
            isBackendConnected={state.isBackendConnected}
            bufferLength={sequenceBufferRef.current.length}
            sequenceLength={SEQUENCE_LENGTH}
          />

          <div className="w-full p-3 sm:p-4 flex flex-col items-center">
            <button
              onClick={() => setConfirmOpen(true)}
              className="w-full max-w-xs px-6 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold shadow-lg text-base sm:text-lg"
            >
              End
            </button>
          </div>
        </div>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-2xl shadow-xl max-w-xs mx-4 text-center border border-gray-100">
            <p className="text-slate-800 mb-6 font-semibold text-lg">End the game?</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => { setConfirmOpen(false); onEnd && onEnd(); }}
                className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold transition-colors"
              >
                Yes, End
              </button>
              <button
                onClick={() => setConfirmOpen(false)}
                className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-slate-600 rounded-xl font-bold transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EndlessMode;
