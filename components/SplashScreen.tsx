import React, { useEffect, useState } from 'react';
import { preloadMediaPipe } from '../services/mediapipeLoader';

type SplashScreenProps = {
  onFinish: () => void;
  duration?: number; // ms
};

const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish, duration = 5000 }) => {
  const [mpReady, setMpReady] = useState(false);
  const [timerDone, setTimerDone] = useState(false);

  // Minimum display time
  useEffect(() => {
    const t = setTimeout(() => setTimerDone(true), duration);
    return () => clearTimeout(t);
  }, [duration]);

  // Preload MediaPipe in parallel
  useEffect(() => {
    preloadMediaPipe().then(() => setMpReady(true));
  }, []);

  // Finish only when both timer AND preload are done
  useEffect(() => {
    if (timerDone && mpReady) onFinish();
  }, [timerDone, mpReady, onFinish]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white">
      <div className="absolute inset-0 bg-gradient-to-b from-slate-50 to-white opacity-90"></div>
      
      <div className="relative z-10 text-center animate-bounce flex flex-col items-center">
        <img 
          src="/hello.png" 
          onError={(e) => { e.currentTarget.src = '/hello.png'; }}
          alt="Hello" 
          className="w-48 h-48 object-contain drop-shadow-xl" 
        />
        <h1 className="mt-8 text-4xl font-black text-slate-900 font-mono tracking-tighter">SignAgya</h1>
        <p className="mt-2 text-accent text-sm font-mono tracking-widest uppercase">AI-Powered Sign Language Tutor</p>
        {timerDone && !mpReady && (
          <div className="mt-4 flex items-center gap-2">
            <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs text-gray-500 font-mono">Loading AI models...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SplashScreen;