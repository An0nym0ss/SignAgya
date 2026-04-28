import React, { useRef, useState, useCallback, useEffect } from 'react';
import { SEQUENCE_LENGTH, ALPHABET, NSL_CLASSES, DEVANAGARI, signsMatch } from '../../constants';
import { predictGesture, predictNSL, testBackendConnection } from '../../services/apiService';
import { Language } from '../../types';
import CameraView from '../CameraView';
import StatsPanel from '../StatsPanel';

type LearnModeProps = {
  language: Language;
  onEnd: () => void;
};

const LearnMode: React.FC<LearnModeProps> = ({ language, onEnd }) => {
  const isNSL = language === 'nsl';
  const alphabet = isNSL ? NSL_CLASSES : ALPHABET.split('');
  const predict = isNSL ? predictNSL : predictGesture;
  const displayChar = (c: string) => isNSL ? (DEVANAGARI[c] || c) : c;
  const imgFolder = isNSL ? '/nsl_signs' : '/asl_mirrored';
  const imgExt = isNSL ? '.png' : '.jpg';

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [target, setTarget] = useState(alphabet[0]);
  const [score, setScore] = useState(0);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const [lastPrediction, setLastPrediction] = useState('-');
  const [confidence, setConfidence] = useState(0);
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  
  const sequenceBufferRef = useRef<number[][]>([]);
  const lastPredictionTimeRef = useRef<number>(0);
  const isPredictingRef = useRef<boolean>(false);
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
        const remaining = alphabet.filter(c => c !== target);
        const newTarget = remaining[Math.floor(Math.random() * remaining.length)];
        setTarget(newTarget);
        successRef.current = false;
    }, 1500);
  }, [target, alphabet]);

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
          setLastPrediction(result.prediction);
          setConfidence(result.confidence);
          setIsBackendConnected(true);

          if (!isSuccess && !successRef.current && (isNSL ? signsMatch(result.prediction, target) : result.prediction === target) && result.confidence > 0.75) {
            handleSuccess();
          }
        } else {
          setIsBackendConnected(false);
        }
      } finally {
        isPredictingRef.current = false;
      }
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
    <div className="w-full bg-slate-50 rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
      
      {/* HEADER */}
      <div className="px-4 py-2 flex justify-between items-center bg-white shadow-sm border-b border-gray-100">
        <div className="flex items-center gap-2">
            <span className="text-2xl text-yellow-400 filter drop-shadow-sm">⭐</span>
            <span className="text-xl font-black text-slate-800 font-mono">{score}</span>
            {isNSL && <span className="text-xs text-purple-500 font-mono ml-2">🇳🇵 NSL</span>}
        </div>
        <button 
            onClick={() => setShowExitConfirm(true)}
            className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg font-bold text-xs transition-colors"
        >
            End
        </button>
      </div>

      <div className="md:flex md:flex-row">
        <div className="md:w-1/2 lg:w-3/5 relative">
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

        <div className="md:w-1/2 lg:w-2/5 md:flex md:flex-col">
          {/* Target & Image */}
          <div className="flex flex-row gap-2 p-2 w-full">
            <div className={`flex-1 bg-white rounded-2xl shadow-sm border-2 flex flex-col items-center justify-center relative transition-colors duration-500 h-24 sm:h-28
              ${isSuccess ? 'border-green-400 bg-green-50' : 'border-gray-200'}
            `}>
              <span className="text-[10px] text-gray-400 font-mono uppercase tracking-widest absolute top-2 left-3">Sign This</span>
              <span className={`font-black text-slate-800 ${isNSL ? 'text-3xl sm:text-4xl' : 'text-5xl sm:text-6xl'}`}>{displayChar(target)}</span>
              {isNSL && <span className="text-xs text-gray-400 font-mono mt-1">{target}</span>}
            </div>

            <div className="flex-1 bg-white rounded-2xl shadow-sm border-2 border-gray-200 flex items-center justify-center p-2 overflow-hidden h-24 sm:h-28">
              <img 
                src={`${imgFolder}/${target}${imgExt}`} 
                alt={`Sign for ${target}`} 
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.parentElement!.classList.add('bg-gray-100');
                  e.currentTarget.parentElement!.innerHTML = '<span class="text-xs text-gray-400 text-center">Image unavailable</span>';
                }}
              />
            </div>
          </div>

          <StatsPanel
            lastPrediction={displayChar(lastPrediction)}
            confidence={confidence}
            isBackendConnected={isBackendConnected}
            bufferLength={sequenceBufferRef.current.length}
            sequenceLength={SEQUENCE_LENGTH}
          />
        </div>
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

export default LearnMode;