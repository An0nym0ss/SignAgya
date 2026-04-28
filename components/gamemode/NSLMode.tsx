import React, { useRef, useState, useCallback } from 'react';
import { SEQUENCE_LENGTH } from '../../constants';
import { predictNSL } from '../../services/apiService';
import CameraView from '../CameraView';
import StatsPanel from '../StatsPanel';

type NSLModeProps = {
  onEnd?: () => void;
};

const NSLMode: React.FC<NSLModeProps> = ({ onEnd }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [prediction, setPrediction] = useState<string>('-');
  const [confidence, setConfidence] = useState<number>(0);
  const [isConnected, setIsConnected] = useState(false);
  const [capturedText, setCapturedText] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const sequenceBufferRef = useRef<number[][]>([]);
  const lastPredictionTimeRef = useRef<number>(0);
  const lastCaptureTimeRef = useRef<number>(0);
  const isPredictingRef = useRef<boolean>(false);
  const animationFrameId = useRef<number | null>(null);

  const CONF_THRESHOLD = 0.80;
  const CAPTURE_COOLDOWN_MS = 3000;

  const checkPrediction = async () => {
    const now = Date.now();
    if (isPredictingRef.current) return;
    if (now - lastPredictionTimeRef.current > 200 && sequenceBufferRef.current.length === SEQUENCE_LENGTH) {
      lastPredictionTimeRef.current = now;
      isPredictingRef.current = true;
      const currentSequence = [...sequenceBufferRef.current];

      try {
        const result = await predictNSL(currentSequence);

        if (result) {
          setPrediction(result.prediction);
          setConfidence(result.confidence);
          setIsConnected(true);

          if (result.confidence >= CONF_THRESHOLD && now - lastCaptureTimeRef.current > CAPTURE_COOLDOWN_MS) {
            lastCaptureTimeRef.current = now;
            setCapturedText(prev => [...prev, result.prediction]);
          }
        } else {
          setIsConnected(false);
        }
      } finally {
        isPredictingRef.current = false;
      }
    }
  };

  const loop = useCallback(() => {
    checkPrediction().catch(e => console.error(e));
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
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 px-4 py-2 sm:py-3 flex items-center justify-between">
        <h2 className="text-white font-bold text-base sm:text-lg font-mono">🇳🇵 NSL MODE</h2>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
          <span className="text-xs text-white/70 font-mono">{isConnected ? 'CONNECTED' : 'OFFLINE'}</span>
        </div>
      </div>

      {/* Desktop: side-by-side | Mobile: stacked */}
      <div className="md:flex md:flex-row">
        {/* Camera */}
        <div className="md:w-1/2 lg:w-3/5">
          <CameraView videoRef={videoRef} canvasRef={canvasRef} sequenceBufferRef={sequenceBufferRef} />
        </div>

        {/* Right panel */}
        <div className="md:w-1/2 lg:w-2/5 md:flex md:flex-col">
          {/* Prediction Display */}
          <div className="bg-white px-4 py-2 sm:py-3 flex items-center gap-4 border-t md:border-t-0 border-gray-200">
            <div className="flex-1">
              <div className="text-[10px] sm:text-xs text-gray-400 font-mono mb-1">DETECTED</div>
              <div className="text-3xl sm:text-4xl font-bold text-slate-800">{prediction}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] sm:text-xs text-gray-400 font-mono mb-1">CONFIDENCE</div>
              <div className={`text-xl sm:text-2xl font-bold font-mono ${confidence >= CONF_THRESHOLD ? 'text-green-500' : 'text-orange-500'}`}>
                {(confidence * 100).toFixed(0)}%
              </div>
            </div>
          </div>

          {/* Confidence Bar */}
          <div className="px-4 pb-2 bg-white">
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-200 rounded-full ${confidence >= CONF_THRESHOLD ? 'bg-green-500' : 'bg-orange-500'}`}
                style={{ width: `${confidence * 100}%` }}
              />
            </div>
          </div>

          {/* Captured Text */}
          <div className="bg-gray-50 px-4 py-2 sm:py-3 border-t border-gray-200 md:flex-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] sm:text-xs text-gray-400 font-mono">CAPTURED SIGNS</span>
              <button
                onClick={() => setCapturedText([])}
                className="text-[10px] sm:text-xs text-gray-500 hover:text-slate-800 transition px-2 py-1 rounded bg-gray-200"
              >
                Clear
              </button>
            </div>
            <div className="min-h-[40px] sm:min-h-[48px] bg-white rounded-lg p-2 sm:p-3 text-xl sm:text-2xl text-slate-800 break-all border border-gray-200">
              {capturedText.length > 0 ? capturedText.join(' ') : <span className="text-gray-400 text-sm">Signs will appear here...</span>}
            </div>
          </div>

          {/* End button */}
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

      {/* Confirmation Modal */}
      {confirmOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-2xl shadow-xl max-w-xs mx-4 text-center border border-gray-100">
            <p className="text-slate-800 mb-6 font-semibold text-lg">Are you sure you want to end?</p>
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

export default NSLMode;
