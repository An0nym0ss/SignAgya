import React from 'react';

type LevelCompletePopupProps = {
  level: number;
  onClose: () => void;
};

const LevelCompletePopup: React.FC<LevelCompletePopupProps> = ({ level, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-sm w-full text-center border border-gray-100">
        <div className="mb-4">
          <span className="text-6xl">🎉</span>
        </div>
        <h2 className="text-2xl font-black text-slate-800 mb-2">Game Over!</h2>
        <p className="text-lg text-slate-600 mb-6">
          You reached <span className="font-bold text-blue-600">Level {level}</span>
        </p>
        <button
          onClick={onClose}
          className="w-full px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default LevelCompletePopup;
