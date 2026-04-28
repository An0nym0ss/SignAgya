import React from 'react';

type HUDProps = {
  target: string;
  score: number;
};

const HUD: React.FC<HUDProps> = ({ target, score }) => {
  return (
    <div className="absolute top-0 left-0 w-full z-20 p-4 bg-gradient-to-b from-black/80 to-transparent">
      <div className="flex justify-between items-start">
        <div className="flex flex-col">
          <span className="text-gray-400 text-xs font-mono mb-1">TARGET</span>
          <div className="text-4xl font-black text-white drop-shadow-lg font-mono">
            {target}
          </div>
        </div>
        
        <div className="flex flex-col items-end">
          <span className="text-gray-400 text-xs font-mono mb-1">SCORE</span>
          <div className="text-3xl font-bold text-green-400 drop-shadow-lg font-mono">
            {score}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HUD;
