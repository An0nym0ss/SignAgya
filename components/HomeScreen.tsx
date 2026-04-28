import React from 'react';
import { Language } from '../types';

type HomeScreenProps = {
  onSelectLanguage: (lang: Language) => void;
};

const HomeScreen: React.FC<HomeScreenProps> = ({ onSelectLanguage }) => {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-white p-6 rounded-2xl">
      <div className="w-full max-w-sm bg-white/80 border border-gray-200 rounded-2xl p-8 backdrop-blur-md shadow-xl">
        <h2 className="text-3xl font-bold text-slate-900 mb-2 font-mono text-center">SignAgya</h2>
        <p className="text-gray-500 text-sm text-center mb-8 font-mono">Choose your sign language</p>

        <div className="grid gap-4">
          <button
            onClick={() => onSelectLanguage('asl')}
            className="group w-full relative px-4 py-6 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 transition-all duration-300 overflow-hidden shadow-md hover:shadow-lg"
          >
            <div className="relative z-10 flex flex-col items-center gap-2">
              <span className="text-3xl">🇺🇸</span>
              <span className="font-bold text-white font-mono text-xl">ASL</span>
              <span className="text-blue-100 text-xs font-mono">American Sign Language</span>
            </div>
          </button>

          <button
            onClick={() => onSelectLanguage('nsl')}
            className="group w-full relative px-4 py-6 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 transition-all duration-300 overflow-hidden shadow-md hover:shadow-lg"
          >
            <div className="relative z-10 flex flex-col items-center gap-2">
              <span className="text-3xl">🇳🇵</span>
              <span className="font-bold text-white font-mono text-xl">NSL</span>
              <span className="text-purple-100 text-xs font-mono">Nepali Sign Language</span>
            </div>
          </button>
        </div>
        
        <div className="mt-8 text-center">
          <p className="text-gray-400 text-xs">Ensure your camera is enabled.</p>
        </div>
      </div>
    </div>
  );
};

export default HomeScreen;