import type { CSSProperties } from 'react';
import { CommunicationShelfPortalArt } from '../art/communicationShelf';
import { PORTAL_ART } from '../art/portalRegistry';
import { PuppyMascotArt } from '../art/mascot';
import { gameMeta } from '../content/games';
import { childGreeting } from '../domain/childName';
import type { DomainKey, ToddlerSettings } from '../domain/types';
import { homeItems } from './homeItems';

interface HomeScreenProps {
  onOpenGame: (domain: DomainKey) => void;
  onOpenCommunication: () => void;
  settings: Pick<ToddlerSettings, 'childName' | 'languageMode'>;
  communicationAvailable?: boolean;
}

/**
 * Child home: all eight stable-identity activity portals are visible together.
 * No swipe knowledge, reading, progress dashboard, or caregiver copy is
 * required to discover and launch an activity.
 */
export function HomeScreen({
  onOpenGame,
  onOpenCommunication,
  settings,
  communicationAvailable = false,
}: HomeScreenProps) {
  const greeting = childGreeting(settings.childName, settings.languageMode);
  const communicationTitle = settings.languageMode === 'en'
    ? 'Communication Shelf'
    : 'מדף התקשורת';
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
        {homeItems(communicationAvailable).map((item, index) => {
          const communication = item.kind === 'communication';
          const domain = communication ? null : item.domain;
          const meta = domain ? gameMeta[domain] : null;
          const PortalArt = domain ? PORTAL_ART[domain] : CommunicationShelfPortalArt;
          const title = meta?.title ?? communicationTitle;
          return (
            <li
              key={domain ?? 'communication'}
              className="portal-grid__item"
              data-domain={domain ?? 'communication'}
            >
              <button
                className={`portal-card ${meta?.accentClass ?? 'accent-communication'}`}
                style={{ '--enter-index': index } as CSSProperties}
                onClick={domain ? () => onOpenGame(domain) : onOpenCommunication}
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
