import React from 'react';
import { Language } from '../types';

type ModeSelectScreenProps = {
  language: Language;
  onSelectMode: (mode: string) => void;
  onBack: () => void;
};

const ModeSelectScreen: React.FC<ModeSelectScreenProps> = ({ language, onSelectMode, onBack }) => {
  const isNSL = language === 'nsl';

  const flag = isNSL ? '🇳🇵' : '🇺🇸';
  const title = isNSL ? 'NSL मोडहरू' : 'ASL Modes';
  const backLabel = isNSL ? '← पछाडि' : '← Back';

  const modeLabels = isNSL
    ? { endless: 'अनन्त यात्रा', learn: 'ज्ञान यात्रा', wordBuilder: 'शब्द निर्माण', wordLearn: 'शब्द सिक्नुहोस्' }
    : { endless: 'ENDLESS MODE', learn: 'LEARN MODE', wordBuilder: 'WORD BUILDER', wordLearn: 'WORD LEARN' };

  // ASL (US flag): red, blue, navy  |  NSL (Nepal flag): crimson, blue
  const colors = isNSL
    ? {
        endless: 'bg-gradient-to-r from-red-700 to-red-600 hover:from-red-800 hover:to-red-700',
        learn: 'bg-gradient-to-r from-blue-700 to-blue-600 hover:from-blue-800 hover:to-blue-700',
        wordBuilder: 'bg-gradient-to-r from-red-600 to-blue-700 hover:from-red-700 hover:to-blue-800',
      }
    : {
        endless: 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700',
        learn: 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800',
        wordBuilder: 'bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700',
      };

  return (
    <div className="h-full w-full flex flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-white p-6 rounded-2xl">
      <div className="w-full max-w-sm bg-white/80 border border-gray-200 rounded-2xl p-8 backdrop-blur-md shadow-xl">
        <button
          onClick={onBack}
          className="mb-4 text-sm text-gray-500 hover:text-slate-800 transition flex items-center gap-1 font-mono"
        >
          {backLabel}
        </button>

        <div className="flex flex-col items-center mb-6">
          <span className="text-5xl mb-2">{flag}</span>
          <h2 className="text-2xl font-bold text-slate-900 font-mono text-center">{title}</h2>
        </div>

        <div className="grid gap-4">
          <button
            onClick={() => onSelectMode('endless')}
            className={`group w-full relative px-4 py-4 rounded-xl ${colors.endless} transition-all duration-300 overflow-hidden shadow-md hover:shadow-lg`}
          >
            <div className="relative z-10 flex items-center justify-center gap-2">
              <span className="font-bold text-white font-mono text-lg">{modeLabels.endless}</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
            </div>
          </button>

          <button
            onClick={() => onSelectMode('learn')}
            className={`group w-full relative px-4 py-4 rounded-xl ${colors.learn} transition-all duration-300 overflow-hidden shadow-md hover:shadow-lg flex items-center justify-center gap-2`}
          >
            <span className="font-bold text-white font-mono text-lg">{modeLabels.learn}</span>
            <span className="text-lg">📖</span>
          </button>

          <button
            onClick={() => onSelectMode('wordbuilder')}
            className={`group w-full relative px-4 py-4 rounded-xl ${colors.wordBuilder} transition-all duration-300 overflow-hidden shadow-md hover:shadow-lg flex items-center justify-center gap-2`}
          >
            <span className="font-bold text-white font-mono text-lg">{modeLabels.wordBuilder}</span>
            <span className="text-lg">📝</span>
          </button>

          <button
            disabled
            className="group w-full relative px-4 py-4 rounded-xl bg-gray-200 text-gray-500 cursor-not-allowed transition-all duration-300 overflow-hidden shadow-sm flex items-center justify-center gap-2"
          >
            <span className="font-bold text-gray-600 font-mono text-lg">{modeLabels.wordLearn}</span>
            <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-1 rounded-full">{isNSL ? 'छिट्टै आउँदैछ' : 'Coming Soon'}</span>
          </button>
        </div>

        <div className="mt-8 text-center">
          <p className="text-gray-400 text-xs">{isNSL ? 'तपाईंको क्यामेरा सक्षम छ भनी सुनिश्चित गर्नुहोस्।' : 'Ensure your camera is enabled.'}</p>
        </div>
      </div>
    </div>
  );
};

export default ModeSelectScreen;
