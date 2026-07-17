import { PORTAL_ART } from '../art/portalRegistry';
import { PuppyMascotArt } from '../art/mascot';
import { gameMeta } from '../content/games';
import type { DomainKey } from '../domain/types';
import { DOMAIN_KEYS } from '../domain/types';

interface HomeScreenProps {
  onOpenGame: (domain: DomainKey) => void;
}

/**
 * Child home: all stable-identity activity portals are visible together.
 * No swipe knowledge, reading, progress dashboard, or caregiver copy is
 * required to discover and launch an activity.
 */
export function HomeScreen({ onOpenGame }: HomeScreenProps) {
  return (
    <main className="page home-page" aria-label="בחירת משחק">
      <header className="home-welcome">
        <PuppyMascotArt mood="idle" className="home-welcome__mascot" />
        <h1>שלום שון</h1>
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
