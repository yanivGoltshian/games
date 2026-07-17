import { PORTAL_ART } from '../art/portalRegistry';
import { PuppyMascotArt } from '../art/mascot';
import { gameMeta } from '../content/games';
import { childGreeting } from '../domain/childName';
import type { DomainKey, ToddlerSettings } from '../domain/types';
import { DOMAIN_KEYS } from '../domain/types';

interface HomeScreenProps {
  onOpenGame: (domain: DomainKey) => void;
  settings: Pick<ToddlerSettings, 'childName' | 'languageMode'>;
}

/**
 * Child home: all six stable-identity activity portals are visible together.
 * No swipe knowledge, reading, progress dashboard, or caregiver copy is
 * required to discover and launch an activity.
 */
export function HomeScreen({ onOpenGame, settings }: HomeScreenProps) {
  const greeting = childGreeting(settings.childName, settings.languageMode);
  return (
    <main
      className="page home-page"
      aria-label={settings.languageMode === 'en' ? 'Choose a game' : 'בחירת משחק'}
    >
      <header className="home-welcome">
        <PuppyMascotArt mood="idle" className="home-welcome__mascot" />
        <h1>{greeting}</h1>
      </header>
      <ul className="portal-grid">
        {DOMAIN_KEYS.map((domain) => {
          const meta = gameMeta[domain];
          const PortalArt = PORTAL_ART[domain];
          return (
            <li key={domain} className="portal-grid__item" data-domain={domain}>
              <button
                className={`portal-card ${meta.accentClass}`}
                onClick={() => onOpenGame(domain)}
                aria-label={meta.title}
                type="button"
              >
                <PortalArt className="portal-card__art" />
                <span className="portal-card__label">{meta.title}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
