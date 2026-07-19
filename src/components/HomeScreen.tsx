import type { CSSProperties } from 'react';
import { PORTAL_ART } from '../art/portalRegistry';
import { PuppyMascotArt } from '../art/mascot';
import { gameMeta } from '../content/games';
import { childGreeting } from '../domain/childName';
import type { DomainKey, ToddlerSettings } from '../domain/types';
import { homeItems } from './homeItems';

interface HomeScreenProps {
  onOpenGame: (domain: DomainKey) => void;
  settings: Pick<ToddlerSettings, 'childName' | 'languageMode'>;
}

/**
 * Child home: the seven retained stable-identity game portals are visible together.
 * No swipe knowledge, reading, progress dashboard, or caregiver copy is
 * required to discover and launch an activity.
 */
export function HomeScreen({
  onOpenGame,
  settings,
}: HomeScreenProps) {
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
        {homeItems().map((item, index) => {
          const { domain } = item;
          const meta = gameMeta[domain];
          const PortalArt = PORTAL_ART[domain];
          const { title } = meta;
          return (
            <li
              key={domain}
              className="portal-grid__item"
              data-domain={domain}
            >
              <button
                className={`portal-card ${meta.accentClass}`}
                style={{ '--enter-index': index } as CSSProperties}
                onClick={() => onOpenGame(domain)}
                aria-label={title}
                type="button"
              >
                <PortalArt className="portal-card__art" />
                <span className="portal-card__label">{title}</span>
                <span className="portal-card__sparkles" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
