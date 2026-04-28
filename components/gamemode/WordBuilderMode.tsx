import React, { useRef, useState, useCallback, useEffect } from 'react';
import { SEQUENCE_LENGTH, DEVANAGARI, VOWEL_SIGNS, VOWEL_MATRAS, combineDevanagari, signsMatch } from '../../constants';
import { predictGesture, predictNSL, testBackendConnection } from '../../services/apiService';
import { Language } from '../../types';
import CameraView from '../CameraView';
import StatsPanel from '../StatsPanel';
import LevelCompletePopup from '../LevelCompletePopup';

type WordBuilderModeProps = {
  language: Language;
  onEnd: () => void;
};

// ASL word lists
const ASL_WORD_LISTS: Record<number, string[]> = {
  1: ['AT', 'IT', 'TO', 'GO', 'NO', 'SO', 'DO', 'UP', 'IN', 'ON'],
  2: ['CAT', 'DOG', 'RUN', 'FUN', 'SUN', 'BIG', 'HAT', 'RED', 'YES', 'NEW'],
  3: ['STOP', 'JUMP', 'HELP', 'FAST', 'BEST', 'HAND', 'SIGN', 'PLAY', 'SHOW', 'THAT'],
  4: ['LEARN', 'STORY', 'MUSIC', 'WORLD', 'TRUST', 'BUILD', 'SPEAK', 'DANCE', 'GRACE', 'SMILE'],
  5: ['PERSON', 'ACTION', 'CHANGE', 'FRIEND', 'BRIDGE', 'SCHOOL', 'LISTEN', 'BREATH', 'CREATE', 'WONDER'],
  6: ['BALANCE', 'EMOTION', 'PICTURE', 'EXPLORE', 'CULTURE', 'INSPIRE', 'WEATHER', 'ACHIEVE', 'CONNECT', 'JOURNEY']
};

// NSL word lists — signs decomposed from real Nepali words
type NSLWord = { signs: string[]; meaning: string };
const NSL_WORD_LISTS: Record<number, NSLWord[]> = {
  1: [
    { signs: ['ka', 'o'],  meaning: 'who' },
    { signs: ['ka', 'e'],  meaning: 'what' },
    { signs: ['gha', 'ra'], meaning: 'house' },
    { signs: ['ma', 'nna'], meaning: 'heart' },
    { signs: ['aa', 'ja'], meaning: 'today' },
  ],
  2: [
    { signs: ['ka', 'i', 'nna'],  meaning: 'why' },
    { signs: ['dda', 'i', 'nna'], meaning: 'day' },
    { signs: ['ra', 'aa', 'ta'],  meaning: 'night' },
    { signs: ['ha', 'aa', 'ta'],  meaning: 'hand' },
    { signs: ['nna', 'aa', 'ma'], meaning: 'name' },
    { signs: ['ka', 'aa', 'ma'],  meaning: 'work' },
    { signs: ['ma', 'aa', 'nna'], meaning: 'respect' },
    { signs: ['dsha', 'u', 'kha'],  meaning: 'happiness' },
    { signs: ['pha', 'uu', 'la'], meaning: 'flower' },
    { signs: ['bha', 'aa', 'i'],  meaning: 'brother' },
    { signs: ['dsha', 'ma', 'ya'],  meaning: 'time' },
    { signs: ['aa', 'ma', 'aa'],  meaning: 'mother' },
    { signs: ['ka', 'ta', 'i'],   meaning: 'how much' },
  ],
  3: [
    { signs: ['pa', 'aa', 'nna', 'ii'],   meaning: 'water' },
    { signs: ['ma', 'aa', 'ya', 'aa'],    meaning: 'love' },
    { signs: ['ba', 'u', 'wa', 'aa'],     meaning: 'father' },
    { signs: ['chha', 'o', 'ra', 'aa'],   meaning: 'son' },
    { signs: ['chha', 'o', 'ra', 'ii'],   meaning: 'daughter' },
    { signs: ['dda', 'i', 'dda', 'ii'],   meaning: 'elder sister' },
    { signs: ['dsha', 'aa', 'ttha', 'ii'],  meaning: 'friend' },
    { signs: ['ba', 'aa', 'tta', 'o'],    meaning: 'road' },
    { signs: ['kha', 'aa', 'nna', 'aa'],  meaning: 'food' },
    { signs: ['pa', 'ai', 'dsha', 'aa'],    meaning: 'money' },
    { signs: ['kha', 'u', 'dsha', 'ii'],    meaning: 'happy' },
    { signs: ['bha', 'o', 'la', 'ii'],    meaning: 'tomorrow' },
    { signs: ['ha', 'i', 'ja', 'o'],      meaning: 'yesterday' },
    { signs: ['ddha', 'e', 'ra', 'ai'],   meaning: 'many' },
    { signs: ['ka', 'dsha', 'ra', 'ii'],    meaning: 'how' },
  ],
  4: [
    { signs: ['ka', 'i', 'ta', 'aa', 'ba'], meaning: 'book' },
  ],
};

const getRandomASLWord = (level: number): string => {
  const words = ASL_WORD_LISTS[level] || ASL_WORD_LISTS[5];
  return words[Math.floor(Math.random() * words.length)];
};

const getRandomNSLWord = (level: number): NSLWord => {
  const lvl = Math.min(level, Object.keys(NSL_WORD_LISTS).length);
  const words = NSL_WORD_LISTS[lvl] || NSL_WORD_LISTS[1];
  return words[Math.floor(Math.random() * words.length)];
};

const WordBuilderMode: React.FC<WordBuilderModeProps> = ({ language, onEnd }) => {
  const isNSL = language === 'nsl';
  const predict = isNSL ? predictNSL : predictGesture;
  const maxLevel = isNSL ? Object.keys(NSL_WORD_LISTS).length : 6;
  const imgFolder = isNSL ? '/nsl_signs' : '/asl';
  const imgExt = isNSL ? '.png' : '.jpg';

  // For NSL, word is an array of sign names; for ASL, a string split into chars
  const getWordLetters = (lvl: number): string[] => {
    if (isNSL) return getRandomNSLWord(lvl).signs;
    return getRandomASLWord(lvl).split('');
  };

  const getWordWithMeaning = (lvl: number): { letters: string[]; meaning: string } => {
    if (isNSL) {
      const w = getRandomNSLWord(lvl);
      return { letters: w.signs, meaning: w.meaning };
    }
    return { letters: getRandomASLWord(lvl).split(''), meaning: '' };
  };

  // Display a sign as its individual character (standalone vowel or consonant)
  const displayChar = (c: string) => isNSL ? (DEVANAGARI[c] || c) : c;

  // Display a sign in context: matra if vowel after consonant, standalone otherwise
  const displaySignInContext = (signs: string[], index: number): string => {
    if (!isNSL) return signs[index];
    const sign = signs[index];
    if (VOWEL_SIGNS.has(sign) && index > 0 && !VOWEL_SIGNS.has(signs[index - 1])) {
      return VOWEL_MATRAS[sign] ?? DEVANAGARI[sign] ?? sign;
    }
    return DEVANAGARI[sign] ?? sign;
  };

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [level, setLevel] = useState(1);
  const [wordLetters, setWordLetters] = useState<string[]>(() => {
    const w = getWordWithMeaning(1);
    return w.letters;
  });
  const [currentMeaningState, setCurrentMeaningState] = useState(() => {
    const w = getWordWithMeaning(1);
    return w.meaning;
  });
  const [progress, setProgress] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(120);
  const [gameOver, setGameOver] = useState(false);
  const [hintVisible, setHintVisible] = useState(false);
  const [canAffordHint, setCanAffordHint] = useState(false);
  
  // Inference State (for StatsPanel)
  const [lastPrediction, setLastPrediction] = useState('-');
  const [confidence, setConfidence] = useState(0);
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  
  // Refs for logic loop
  const sequenceBufferRef = useRef<number[][]>([]);
  const lastPredictionTimeRef = useRef<number>(0);
  const isPredictingRef = useRef<boolean>(false);
  // synchronous ref to guard against duplicate processing (prevents race conditions)
  const processingRef = useRef<boolean>(false);
  // Track consecutive completions for level-up logic
  const consecutiveCompletionsRef = useRef<number>(0);
  const completionLevelRef = useRef<number | null>(null);
  // Track whether a hint was used during the current word
  const currentWordHintUsedRef = useRef<boolean>(false);
  const animationFrameId = useRef<number | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Timer countdown
  useEffect(() => {
    if (gameOver || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setGameOver(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameOver, timeLeft]);

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle letter detection
  const handleLetterDetected = useCallback((letter: string) => {
    if (processingRef.current) return;

    const targetLetter = wordLetters[progress.length];
    if (isNSL ? signsMatch(letter, targetLetter) : letter === targetLetter) {
      processingRef.current = true;
      setIsProcessing(true);

      const newProgress = [...progress, letter];
      setProgress(newProgress);
      setScore(prev => prev + 1);
      lastPredictionTimeRef.current = Date.now();

      if (newProgress.length === wordLetters.length) {
        setTimeout(() => {
          const wordLevel = level;
          let nextLevel = level;

          if (currentWordHintUsedRef.current) {
            consecutiveCompletionsRef.current = 0;
            completionLevelRef.current = null;
          } else {
            if (completionLevelRef.current == null || completionLevelRef.current !== wordLevel) {
              completionLevelRef.current = wordLevel;
              consecutiveCompletionsRef.current = 1;
            } else {
              consecutiveCompletionsRef.current += 1;
            }

            if (consecutiveCompletionsRef.current >= 2 && level < maxLevel) {
              nextLevel = Math.min(maxLevel, level + 1);
              consecutiveCompletionsRef.current = 0;
              completionLevelRef.current = null;
            }
          }

          setLevel(nextLevel);
          const newWord = getWordWithMeaning(nextLevel);
          setWordLetters(newWord.letters);
          setCurrentMeaningState(newWord.meaning);
          setProgress([]);
          setHintVisible(false);
          sequenceBufferRef.current = [];
          currentWordHintUsedRef.current = false;
          processingRef.current = false;
          setIsProcessing(false);
        }, 800);
      } else {
        sequenceBufferRef.current = [];
        setTimeout(() => {
          processingRef.current = false;
          setIsProcessing(false);
        }, 800);
      }
    }
  }, [progress, wordLetters, level, maxLevel]);

  // Main Prediction Loop
  const checkPredictionRef = useRef<() => Promise<void>>();
  checkPredictionRef.current = async () => {
    if (gameOver) return;
    
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

          const targetLetter = wordLetters[progress.length];
          if (!processingRef.current && (isNSL ? signsMatch(result.prediction, targetLetter) : result.prediction === targetLetter) && result.confidence > 0.75) {
            handleLetterDetected(result.prediction);
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
    checkPredictionRef.current?.().catch(e => console.error(e));
    animationFrameId.current = requestAnimationFrame(loop);
  }, []);

  // Test backend connection on mount
  useEffect(() => {
    const testConnection = async () => {
      const connected = await testBackendConnection();
      console.log('Backend connection test:', connected ? '✓ Connected' : '✗ Failed');
      if (connected) {
        setIsBackendConnected(true);
      }
    };
    testConnection();
  }, []);

  useEffect(() => {
    animationFrameId.current = requestAnimationFrame(loop);
    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, [loop]);

  // Update hint affordability
    useEffect(() => {
      // Hint cost scales with level: level 1 = 1 star, level 2 = 2 stars, etc.
      setCanAffordHint(score >= level);
    }, [score, level]);

  // NOTE: Level up is now handled by consecutive successful completions
  // (three consecutive words of the same level without using a hint).

  // Handle hint purchase
  const handleHintClick = () => {
    // Hint cost scales with level: level 1 = 1 star, level 2 = 2 stars, etc.
    const hintCost = level;
    if (score >= hintCost && !hintVisible) {
      setScore(prev => prev - hintCost);
      setHintVisible(true);
      // mark that current word used a hint
      currentWordHintUsedRef.current = true;
    }
  };

  // Get letter status for color coding
  const getLetterStatus = (index: number): 'completed' | 'current' | 'pending' => {
    if (index < progress.length) return 'completed';
    if (index === progress.length) return 'current';
    return 'pending';
  };

  const getLetterColor = (status: 'completed' | 'current' | 'pending'): string => {
    switch (status) {
      case 'completed': return 'bg-green-500 text-white border-green-600';
      case 'current': return 'bg-yellow-400 text-slate-800 border-yellow-500 animate-pulse';
      case 'pending': return 'bg-red-100 text-red-600 border-red-300';
    }
  };

  return (
    <div className="w-full bg-slate-50 rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
      
      {/* HEADER: Level, Timer, Score & Exit */}
      <div className="px-3 py-2 flex justify-between items-center bg-white shadow-sm border-b border-gray-100">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500 font-mono uppercase tracking-wider">Lv</span>
            <span className="text-lg font-black text-blue-600 font-mono">{level}</span>
          </div>
          <div className="w-px h-5 bg-gray-300"></div>
          <div className="flex items-center gap-1">
            <span className={`text-base font-black font-mono ${timeLeft <= 30 ? 'text-red-600 animate-pulse' : 'text-slate-800'}`}>
              {formatTime(timeLeft)}
            </span>
          </div>
          <div className="w-px h-5 bg-gray-300"></div>
          <div className="flex items-center gap-1">
            <span className="text-base text-yellow-400">⭐</span>
            <span className="text-base font-black text-slate-800 font-mono">{score}</span>
          </div>
        </div>
        <button 
          onClick={() => setShowExitConfirm(true)}
          className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg font-bold text-xs transition-colors"
        >
          End
        </button>
      </div>

      {/* Desktop: side-by-side | Mobile: stacked */}
      <div className="md:flex md:flex-row">
        {/* Camera */}
        <div className="md:w-1/2 lg:w-3/5">
          <CameraView videoRef={videoRef} canvasRef={canvasRef} sequenceBufferRef={sequenceBufferRef} />
        </div>

        {/* Right panel */}
        <div className="md:w-1/2 lg:w-2/5 md:flex md:flex-col">
          {/* Word Progress & Hint */}
          <div className="flex flex-row gap-2 p-2 w-full">
            {/* Word Progress Display */}
            <div className="flex-1 bg-white rounded-2xl shadow-sm border-2 border-gray-200 p-2 flex flex-col justify-center h-24 sm:h-28">
              <div className="text-center mb-1">
                <span className="text-[10px] text-gray-400 font-mono uppercase tracking-widest">Build This Word</span>
                {isNSL && (
                  <span className="ml-2 text-sm font-bold text-blue-700">
                    {combineDevanagari(wordLetters)}
                    {currentMeaningState && <span className="text-gray-500 font-normal text-xs ml-1">({currentMeaningState})</span>}
                  </span>
                )}
              </div>
              <div className="flex justify-center gap-1 sm:gap-1.5 flex-wrap">
                {wordLetters.map((letter, index) => {
                  const status = getLetterStatus(index);
                  const boxSize = wordLetters.length <= 3 ? 'w-10 h-10 text-xl sm:w-12 sm:h-12 sm:text-2xl' : wordLetters.length <= 4 ? 'w-8 h-8 text-lg sm:w-10 sm:h-10 sm:text-xl' : 'w-7 h-7 text-base sm:w-9 sm:h-9 sm:text-lg';
                  return (
                    <div
                      key={index}
                      className={`${boxSize} flex items-center justify-center rounded-lg border-2 font-black transition-all duration-300 ${getLetterColor(status)}`}
                    >
                      {isNSL ? displaySignInContext(wordLetters, index) : letter}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Hint Display */}
            <div className="w-24 sm:w-28 bg-white rounded-2xl shadow-sm border-2 border-gray-200 p-2 flex flex-col items-center justify-center h-24 sm:h-28">
              {!hintVisible ? (
                <button
                  onClick={handleHintClick}
                  disabled={!canAffordHint}
                  className={`w-full h-full flex flex-col items-center justify-center gap-1 rounded-lg transition-all ${
                    canAffordHint 
                      ? 'bg-blue-50 hover:bg-blue-100 cursor-pointer' 
                      : 'bg-gray-50 cursor-not-allowed opacity-50'
                  }`}
                >
                  <span className="text-2xl">💡</span>
                  <span className="text-[9px] font-bold text-slate-700">Hint</span>
                  <span className="text-[8px] text-gray-500 font-mono">{level}⭐</span>
                </button>
              ) : (
                <div className="w-full h-full flex items-center justify-center overflow-hidden rounded-lg">
                  {(() => {
                    const letterIdx = progress.length;
                    const letter = wordLetters[letterIdx];
                    if (!letter) return null;
                    return (
                      <img
                        src={`${imgFolder}/${letter}${imgExt}`}
                        alt={`Hint for ${letter}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          const parent = e.currentTarget.parentElement;
                          if (parent) parent.innerHTML = '<span class=\"text-[10px] text-gray-400 text-center p-2\">Hint unavailable</span>';
                        }}
                      />
                    );
                  })()}
                </div>
              )}
            </div>
          </div>

          {/* Stats Panel */}
          <StatsPanel
            lastPrediction={displayChar(lastPrediction)}
            confidence={confidence}
            isBackendConnected={isBackendConnected}
            bufferLength={sequenceBufferRef.current.length}
            sequenceLength={SEQUENCE_LENGTH}
          />
        </div>
      </div>

      {/* EXIT CONFIRMATION MODAL */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-2xl shadow-xl max-w-xs w-full text-center border border-gray-100">
            <p className="text-slate-800 mb-6 font-semibold text-lg">End Game?</p>
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

      {/* GAME OVER POPUP */}
      {gameOver && (
        <LevelCompletePopup level={level} onClose={onEnd} />
      )}
    </div>
  );
};

export default WordBuilderMode;
