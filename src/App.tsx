import { useCallback, useEffect, useState } from 'react';
import { CaregiverGate } from './components/CaregiverGate';
import { CaregiverPanel } from './components/CaregiverPanel';
import { HomeScreen } from './components/HomeScreen';
import { applyRoundResult, createInitialProgress } from './domain/progression';
import type { DomainKey, RecordedRound, ToddlerSettings } from './domain/types';
import { clearProgress, loadProgress, saveProgress } from './services/storage';
import { soundService } from './services/sound';
import { speechService } from './services/speech';
import { parseHash, type Route } from './routes';
import { CountingGame } from './games/CountingGame';
import { ListeningGame } from './games/ListeningGame';
import { MemoryGame } from './games/MemoryGame';
import { NumberPairsGame } from './games/NumberPairsGame';
import { PuzzleGame } from './games/PuzzleGame';
import { SillyAlienGame } from './games/SillyAlienGame';
import { SortingGame } from './games/SortingGame';

function navigate(path: string) {
  speechService.cancelAll('navigation');
  window.location.hash = path;
}

export default function App() {
  const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [progress, setProgress] = useState(() => loadProgress(prefersReducedMotion));
  const [route, setRoute] = useState<Route>(() => parseHash(typeof window !== 'undefined' ? window.location.hash : '#/'));
  const [mediaReady, setMediaReady] = useState(false);
  const [caregiverUnlocked, setCaregiverUnlocked] = useState(false);
  const [speechStatus, setSpeechStatus] = useState(() => speechService.getStatus());

  useEffect(() => {
    if (!window.location.hash) {
      navigate('/');
    }
    const handleHashChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    saveProgress(progress);
  }, [progress]);

  useEffect(() => speechService.subscribe(setSpeechStatus), []);

  useEffect(() => {
    const englishGame = route.kind === 'game' && progress.settings.languageMode === 'en';
    document.documentElement.lang = englishGame ? 'en' : 'he';
    document.documentElement.dir = englishGame ? 'ltr' : 'rtl';
    document.body.dataset.reducedMotion = progress.settings.reducedMotion ? 'true' : 'false';
  }, [progress.settings.languageMode, progress.settings.reducedMotion, route.kind]);

  const unlockMedia = useCallback(() => {
    speechService.unlock(progress.settings);
    soundService.unlock();
    setMediaReady(true);
  }, [progress.settings]);

  const updateSettings = (patch: Partial<ToddlerSettings>) => {
    setProgress((current) => ({
      ...current,
      updatedAt: Date.now(),
      settings: {
        ...current.settings,
        ...patch,
      },
    }));
  };

  const completeRound = (domain: DomainKey) => (round: RecordedRound) => {
    const result = applyRoundResult(progress, domain, round, Date.now());
    setProgress(result.progress);
    return result.summary;
  };

  const resetAll = () => {
    const next = createInitialProgress(prefersReducedMotion, Date.now());
    clearProgress();
    setProgress(next);
  };

  const sharedProps = {
    mediaReady,
    overallStars: progress.totalStars,
    settings: progress.settings,
    speechStatus,
  };

  let content;
  if (route.kind === 'caregiver') {
    content = caregiverUnlocked ? (
      <CaregiverPanel onBack={() => navigate('/')} onReset={resetAll} onUpdateSettings={updateSettings} progress={progress} />
    ) : (
      <main className="page lock-page">
        <section className="lock-card">
          <h1>האזור הזה נפתח רק בלחיצה ארוכה למבוגרים</h1>
          <p>חוזרים לדף הבית ולוחצים לחיצה ארוכה על גלגל השיניים למשך בערך 3 שניות.</p>
          <button className="primary-button" onClick={() => navigate('/')} type="button">
            חזרה לדף הבית
          </button>
        </section>
      </main>
    );
  } else if (route.kind === 'game') {
    const domainProgress = progress.domains[route.domain];
    const gameProps = {
      ...sharedProps,
      domainProgress,
      onBack: () => navigate('/'),
      onCompleteRound: completeRound(route.domain),
    };

    content = {
      listening: <ListeningGame {...gameProps} />,
      counting: <CountingGame {...gameProps} />,
      sorting: <SortingGame {...gameProps} />,
      puzzle: <PuzzleGame {...gameProps} />,
      memory: <MemoryGame {...gameProps} />,
      numberPairs: <NumberPairsGame {...gameProps} />,
      sillyAlien: <SillyAlienGame {...gameProps} />,
    }[route.domain];
  } else {
    content = <HomeScreen onOpenGame={(domain) => navigate(`/games/${domain}`)} />;
  }

  return (
    <div
      className="app-shell"
      onClickCapture={unlockMedia}
      onKeyDownCapture={unlockMedia}
      onPointerDownCapture={unlockMedia}
    >
      <div className="background-orb background-orb--one" aria-hidden="true" />
      <div className="background-orb background-orb--two" aria-hidden="true" />
      <div className="background-orb background-orb--three" aria-hidden="true" />
      {content}
      {route.kind === 'home' ? <CaregiverGate onUnlock={() => { setCaregiverUnlocked(true); navigate('/caregiver'); }} /> : null}
    </div>
  );
}
