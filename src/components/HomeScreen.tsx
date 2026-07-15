import { PORTAL_ART } from '../art/portalRegistry';
import { PuppyMascotArt } from '../art/mascot';
import { gameMeta } from '../content/games';
import type { DomainKey } from '../domain/types';
import { DOMAIN_KEYS } from '../domain/types';

interface HomeScreenProps {
  onOpenGame: (domain: DomainKey) => void;
}

/**
 * Child home: a horizontal CSS scroll-snap carousel of five enormous,
 * stable-identity activity portals. No instructions, install hints,
 * privacy copy, or progress dashboard live here - those are caregiver-only
 * (see CaregiverPanel).
 */
export function HomeScreen({ onOpenGame }: HomeScreenProps) {
  return (
    <main className="page home-page" aria-label="בחירת משחק">
      <header className="home-welcome">
        <PuppyMascotArt mood="idle" className="home-welcome__mascot" />
        <h1>שלום שון</h1>
      </header>
      <ul className="portal-carousel">
        {DOMAIN_KEYS.map((domain) => {
          const meta = gameMeta[domain];
          const PortalArt = PORTAL_ART[domain];
          return (
            <li key={domain} className="portal-carousel__item">
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
