import React, { useState } from 'react';
import SplashScreen from './SplashScreen';
import HomeScreen from './HomeScreen';
import ModeSelectScreen from './ModeSelectScreen';
import EndlessMode from './gamemode/EndlessMode';
import LearnMode from './gamemode/LearnMode';
import WordBuilderMode from './gamemode/WordBuilderMode';
import { Language } from '../types';

type Route = 'splash' | 'home' | 'modeSelect' | 'endless' | 'learn' | 'wordbuilder';

const SignGame: React.FC = () => {
  const [route, setRoute] = useState<Route>('splash');
  const [language, setLanguage] = useState<Language>('asl');

  if (route === 'splash') {
    return <SplashScreen onFinish={() => setRoute('home')} />;
  }

  if (route === 'home') {
    return <HomeScreen onSelectLanguage={(lang) => { setLanguage(lang); setRoute('modeSelect'); }} />;
  }

  if (route === 'modeSelect') {
    return <ModeSelectScreen language={language} onSelectMode={(m) => setRoute(m as Route)} onBack={() => setRoute('home')} />;
  }

  if (route === 'endless') {
    return <EndlessMode language={language} onEnd={() => setRoute('modeSelect')} />;
  }

  if (route === 'learn') {
    return <LearnMode language={language} onEnd={() => setRoute('modeSelect')} />;
  }

  if (route === 'wordbuilder') {
    return <WordBuilderMode language={language} onEnd={() => setRoute('modeSelect')} />;
  }
};

export default SignGame;