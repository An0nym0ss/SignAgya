import React from 'react';

type StatsPanelProps = {
  lastPrediction: string;
  confidence: number;
  isBackendConnected: boolean;
  bufferLength: number;
  sequenceLength: number;
};

const StatsPanel: React.FC<StatsPanelProps> = ({ lastPrediction, confidence, isBackendConnected, bufferLength, sequenceLength }) => {
  return (
    <div className="bg-gray-50 p-3 sm:p-4 border-t border-gray-200">
      <div className="flex justify-between items-center mb-2">
        <span className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider font-semibold">Inference Status</span>
        <span className={`text-[10px] px-2 py-0.5 rounded-full ${isBackendConnected ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-500'}`}>
          {isBackendConnected ? 'CONNECTED' : 'OFFLINE'}
        </span>
      </div>
      
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="bg-white rounded-lg p-2 sm:p-3 border border-gray-200">
           <span className="text-[10px] sm:text-xs text-gray-500 block mb-1">PREDICTION</span>
           <span className="text-lg sm:text-xl font-bold text-purple-600 font-mono">{lastPrediction}</span>
        </div>
        <div className="bg-white rounded-lg p-2 sm:p-3 border border-gray-200">
           <span className="text-[10px] sm:text-xs text-gray-500 block mb-1">CONFIDENCE</span>
           <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${(confidence * 100).toFixed(0)}%` }}
                ></div>
              </div>
              <span className="text-[10px] sm:text-xs text-gray-600 font-mono">{(confidence * 100).toFixed(0)}%</span>
           </div>
        </div>
      </div>
    </div>
  );
};

export default StatsPanel;
