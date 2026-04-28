import React from 'react';
import SignGame from './components/SignGame';

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col items-center p-2 sm:p-4">
      <header className="w-full max-w-lg md:max-w-5xl mb-2 flex justify-between items-center px-1">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-purple-500 to-pink-600 bg-clip-text text-transparent">
            SignAgya
          </h1>
          <p className="text-[10px] sm:text-xs text-gray-400">Sign Language Learning Platform</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
          <span className="text-[10px] sm:text-xs font-mono text-gray-400">ONLINE</span>
        </div>
      </header>
      
      <main className="w-full max-w-lg md:max-w-5xl">
        <SignGame />
      </main>
    </div>
  );
};

export default App;