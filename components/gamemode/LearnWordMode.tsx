import React, { useRef, useState, useCallback, useEffect } from 'react';
import { SEQUENCE_LENGTH } from '../../constants';
import { predictGesture, testBackendConnection } from '../../services/apiService';
import CameraView from '../CameraView';
import StatsPanel from '../StatsPanel';

type LearnWordModeProps = {
  onEnd: () => void;
};

// Labels from the words model
const WORD_LABELS = ['friend','help','i_love_you','more','name','no','repeat','see_you_later','yes'];

const displayWord = (w: string) => w.replace(/_/g, ' ').toUpperCase();

const LearnWordMode: React.FC<LearnWordModeProps> = ({ onEnd }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Game State
  const [target, setTarget] = useState(WORD_LABELS[0]);
  const [score, setScore] = useState(0);
  const [isSuccess, setIsSuccess] = useState(false);
  
  // Inference State (for StatsPanel)
  const [lastPrediction, setLastPrediction] = useState('-');
  const [confidence, setConfidence] = useState(0);
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  
  // Refs for logic loop
  const sequenceBufferRef = useRef<number[][]>([]);
  const lastPredictionTimeRef = useRef<number>(0);
  const successRef = useRef<boolean>(false);
  const animationFrameId = useRef<number | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const handleSuccess = useCallback(() => {
    if (successRef.current) return;
    successRef.current = true;

    setIsSuccess(true);
    setScore(prev => prev + 1);
    sequenceBufferRef.current = [];
    lastPredictionTimeRef.current = Date.now();

    setTimeout(() => {
      setIsSuccess(false);
      const remaining = WORD_LABELS.filter(w => w !== target);
      const newTarget = remaining[Math.floor(Math.random() * remaining.length)];
      setTarget(newTarget);
      successRef.current = false;
    }, 1500);
  }, [target]);

  const checkPrediction = async () => {
    const now = Date.now();
    const bufferLength = sequenceBufferRef.current.length;
    if (now - lastPredictionTimeRef.current > 200 && bufferLength >= SEQUENCE_LENGTH) {
      lastPredictionTimeRef.current = now;
      const currentSequence = [...sequenceBufferRef.current].slice(-SEQUENCE_LENGTH);
      const result = await predictGesture(currentSequence);

      if (result) {
        setLastPrediction(result.prediction);
        setConfidence(result.confidence);
        setIsBackendConnected(true);

        if (!isSuccess && !successRef.current && result.prediction === target && result.confidence > 0.75) {
          handleSuccess();
        }
      } else {
        setIsBackendConnected(false);
      }
    } else if (bufferLength < SEQUENCE_LENGTH && bufferLength > 0 && now - lastPredictionTimeRef.current > 1000) {
      lastPredictionTimeRef.current = now;
    }
  };

  const loop = useCallback(() => {
    checkPrediction().catch(e => console.error(e));
    animationFrameId.current = requestAnimationFrame(loop);
  }, [isSuccess, target, handleSuccess]);

  useEffect(() => {
    const testConnection = async () => {
      const connected = await testBackendConnection();
      if (connected) setIsBackendConnected(true);
    };
    testConnection();
  }, []);

  useEffect(() => {
    animationFrameId.current = requestAnimationFrame(loop);
    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, [loop]);

  return (
    <div className="relative w-full h-full bg-slate-50 flex flex-col overflow-hidden">
      <div className="flex-none px-4 py-2 flex justify-between items-center bg-white shadow-sm z-20 border-b border-gray-100 h-14">
        <div className="flex items-center gap-2">
            <span className="text-2xl text-yellow-400 filter drop-shadow-sm">⭐</span>
            <span className="text-xl font-black text-slate-800 font-mono">{score}</span>
        </div>
        <button 
            onClick={() => setShowExitConfirm(true)}
            className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg font-bold text-xs transition-colors"
        >
            End
        </button>
      </div>

      <div className="flex-1 flex flex-col p-3 gap-3 items-center justify-start overflow-hidden">
        <div className="flex-none flex flex-row gap-3 w-full h-32">
           <div className={`flex-1 bg-white rounded-2xl shadow-sm border-2 flex flex-col items-center justify-center relative transition-colors duration-500
              ${isSuccess ? 'border-green-400 bg-green-50' : 'border-gray-200'}
           `}>
              <span className="text-[10px] text-gray-400 font-mono uppercase tracking-widest absolute top-2 left-3">Sign This</span>
              <span className="text-2xl font-black text-slate-800 text-center px-4">{displayWord(target)}</span>
           </div>

           <div className="flex-1 bg-white rounded-2xl shadow-sm border-2 border-gray-200 flex items-center justify-center p-2 overflow-hidden">
              <div className="text-sm text-gray-500 text-center">Follow the target word and make that sign</div>
           </div>
        </div>

        <div className="flex-none h-80 aspect-[3/4] relative bg-black rounded-xl overflow-hidden shadow-md border border-gray-200 my-auto">
             <CameraView videoRef={videoRef} canvasRef={canvasRef} sequenceBufferRef={sequenceBufferRef} />
             {isSuccess && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-green-500/20 backdrop-blur-[2px]">
                   <div className="bg-white rounded-full p-3 shadow-xl animate-bounce">
                      <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
                      </svg>
                   </div>
                </div>
             )}
        </div>

      </div>

      <div className="flex-none z-30 w-full">
        <StatsPanel
            lastPrediction={lastPrediction}
            confidence={confidence}
            isBackendConnected={isBackendConnected}
            bufferLength={sequenceBufferRef.current.length}
            sequenceLength={SEQUENCE_LENGTH}
        />
      </div>

      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-2xl shadow-xl max-w-xs w-full text-center border border-gray-100">
            <p className="text-slate-800 mb-6 font-semibold text-lg">Finish Learning?</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={onEnd}
                className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold transition-colors"
              >
                Yes
              </button>
              <button
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-slate-600 rounded-xl font-bold transition-colors"
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LearnWordMode;
