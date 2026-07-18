import { useCallback, useEffect, useMemo, useState } from 'react';
import { CaregiverGate } from './components/CaregiverGate';
import { CaregiverPanel } from './components/CaregiverPanel';
import { CommunicationShelf } from './components/CommunicationShelf';
import { ErrorBoundary } from './components/ErrorBoundary';
import { HomeScreen } from './components/HomeScreen';
import {
  buildCommunicationCaregiverItems,
  communicationIntegration as defaultCommunicationIntegration,
  evaluateCommunicationPublicAvailability,
  seedLegacyCommunicationActivities,
  type CommunicationIntegrationContract,
} from './communication/integration';
import {
  COMMUNICATION_SHELF_PATH,
  communicationShelfEntry,
} from './communication/registry';
import { applyRoundResult, createInitialProgress } from './domain/progression';
import { childGreeting, normalizeChildName } from './domain/childName';
import type { CommunicationActivityId } from './domain/communicationGame';
import type { DomainKey, RecordedRound, ToddlerSettings } from './domain/types';
import { clearProgress, loadProgress, saveProgress } from './services/storage';
import { soundService } from './services/sound';
import { speechService } from './services/speech';
import {
  isCommunicationHash,
  parseHash,
  resolveRouteForCommunicationAvailability,
} from './routes';
import { CountingGame } from './games/CountingGame';
import { ListeningGame } from './games/ListeningGame';
import { MemoryGame } from './games/MemoryGame';
import { NumberPairsGame } from './games/NumberPairsGame';
import { PuzzleGame } from './games/PuzzleGame';
import { SillyAlienGame } from './games/SillyAlienGame';
import { SortingGame } from './games/SortingGame';
import { SyllableTrainGame } from './games/SyllableTrainGame';

function navigate(path: string) {
  speechService.cancelAll('navigation');
  window.location.hash = path;
}

function replaceHashWithoutMedia(path: string) {
  window.history.replaceState(window.history.state, '', `#${path}`);
}

export interface AppProps {
  communication?: CommunicationIntegrationContract;
}

export default function App({
  communication = defaultCommunicationIntegration,
}: AppProps = {}) {
  const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [progress, setProgress] = useState(() => loadProgress(prefersReducedMotion));
  const [requestedHash, setRequestedHash] = useState(() => (
    typeof window !== 'undefined' ? window.location.hash || '#/' : '#/'
  ));
  const [mediaReady, setMediaReady] = useState(false);
  const [caregiverUnlocked, setCaregiverUnlocked] = useState(false);
  const [speechStatus, setSpeechStatus] = useState(() => speechService.getStatus());
  const requestedRoute = useMemo(() => parseHash(requestedHash), [requestedHash]);
  const communicationAvailability = useMemo(
    () => evaluateCommunicationPublicAvailability(communication),
    [communication],
  );
  const route = useMemo(
    () => resolveRouteForCommunicationAvailability(
      requestedRoute,
      communicationAvailability.publicActivityIds,
    ),
    [communicationAvailability.publicActivityIds, requestedRoute],
  );
  const communicationCaregiverItems = useMemo(
    () => buildCommunicationCaregiverItems(
      communication,
      progress,
      communicationAvailability.release,
    ),
    [communication, communicationAvailability.release, progress],
  );

  useEffect(() => {
    if (!window.location.hash) {
      navigate('/');
    }
    const handleHashChange = () => setRequestedHash(window.location.hash || '#/');
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    if (route.kind !== 'home' || !isCommunicationHash(requestedHash)) return;
    replaceHashWithoutMedia('/');
    setRequestedHash('#/');
  }, [requestedHash, route.kind]);

  useEffect(() => {
    saveProgress(progress);
  }, [progress]);

  useEffect(() => speechService.subscribe(setSpeechStatus), []);

  useEffect(() => {
    const englishChildRoute = (
      route.kind === 'game'
      || route.kind === 'communication-shelf'
      || route.kind === 'communication-game'
    ) && progress.settings.languageMode === 'en';
    document.documentElement.lang = englishChildRoute ? 'en' : 'he';
    document.documentElement.dir = englishChildRoute ? 'ltr' : 'rtl';
    document.body.dataset.reducedMotion = progress.settings.reducedMotion ? 'true' : 'false';
  }, [progress.settings.languageMode, progress.settings.reducedMotion, route.kind]);

  useEffect(() => {
    const title = childGreeting(progress.settings.childName, progress.settings.languageMode);
    document.title = title;
  }, [progress.settings.childName, progress.settings.languageMode]);

  const unlockMedia = useCallback(() => {
    speechService.unlock(progress.settings);
    soundService.unlock();
    setMediaReady(true);
  }, [progress.settings]);

  const updateSettings = (patch: Partial<ToddlerSettings>) => {
    const normalizedPatch = patch.childName === undefined
      ? patch
      : { ...patch, childName: normalizeChildName(patch.childName) };
    setProgress((current) => ({
      ...current,
      updatedAt: Date.now(),
      settings: {
        ...current.settings,
        ...normalizedPatch,
      },
    }));
  };

  const completeRound = (domain: DomainKey) => (round: RecordedRound) => {
    const result = applyRoundResult(progress, domain, round, Date.now());
    setProgress(result.progress);
    return result.summary;
  };

  const updateCommunicationProgress = (activityId: CommunicationActivityId) => (
    communicationProgress: typeof progress.communication,
  ) => {
    setProgress((current) => ({
      ...current,
      updatedAt: Date.now(),
      communication: communicationProgress,
      communicationActivities: {
        ...seedLegacyCommunicationActivities(current, communication),
        [activityId]: communicationProgress,
      },
    }));
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
      <CaregiverPanel
        communicationItems={communicationCaregiverItems}
        communicationReleaseAvailable={communicationAvailability.available}
        onBack={() => navigate('/')}
        onReset={resetAll}
        onUpdateSettings={updateSettings}
        progress={progress}
      />
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
      syllableTrain: <SyllableTrainGame {...gameProps} />,
    }[route.domain];
  } else if (route.kind === 'communication-shelf') {
    content = (
      <CommunicationShelf
        activityIds={communicationAvailability.publicActivityIds}
        languageMode={progress.settings.languageMode}
        onHome={() => navigate('/')}
        onSelect={(activityId) => navigate(communicationShelfEntry(activityId).path)}
        reducedMotion={progress.settings.reducedMotion}
      />
    );
  } else if (route.kind === 'communication-game') {
    const registration = communication.games[route.activityId];
    if (!registration) {
      throw new Error(`Missing communication integration for ${route.activityId}.`);
    }
    const CommunicationGame = registration.component;
    const communicationProgress = registration.selectProgress?.(progress) ?? progress.communication;
    content = (
      <CommunicationGame
        activityId={route.activityId}
        mediaReady={mediaReady}
        onBackToShelf={() => navigate(COMMUNICATION_SHELF_PATH)}
        onCompleteSyllableTrainRound={completeRound('syllableTrain')}
        onHome={() => navigate('/')}
        onProgressChange={updateCommunicationProgress(route.activityId)}
        overallStars={progress.totalStars}
        progress={communicationProgress}
        settings={progress.settings}
        speechStatus={speechStatus}
        syllableTrainDomainProgress={progress.domains.syllableTrain}
      />
    );
  } else {
    content = (
      <HomeScreen
        communicationAvailable={communicationAvailability.available}
        onOpenCommunication={() => navigate(COMMUNICATION_SHELF_PATH)}
        onOpenGame={(domain) => navigate(`/games/${domain}`)}
        settings={progress.settings}
      />
    );
  }

  const routeKey = route.kind === 'game'
    ? `game:${route.domain}`
    : route.kind === 'communication-game'
      ? `communication:${route.activityId}`
      : route.kind;

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
      <ErrorBoundary resetKey={routeKey} onReset={() => navigate('/')}>
        {content}
      </ErrorBoundary>
      {route.kind === 'home' ? <CaregiverGate onUnlock={() => { setCaregiverUnlocked(true); navigate('/caregiver'); }} /> : null}
    </div>
  );
}
