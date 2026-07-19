import { useEffect, useState, type KeyboardEvent } from 'react';
import { PORTAL_ART } from '../art/portalRegistry';
import { gameMeta } from '../content/games';
import type { AppProgress, ToddlerSettings } from '../domain/types';
import { DOMAIN_KEYS } from '../domain/types';
import { CHILD_NAME_MAX_LENGTH, normalizeChildName, personalizeChildName } from '../domain/childName';
import { NARRATION_VOICE_PROFILES } from '../domain/narrationVoice';
import { InstallHint } from './InstallHint';
import { FamilyPhotoManager } from './FamilyPhotoManager';
import { ProgressStars } from './ProgressStars';

interface CaregiverPanelProps {
  progress: AppProgress;
  onBack: () => void;
  onUpdateSettings: (patch: Partial<ToddlerSettings>) => void;
  onReset: () => void;
}

/**
 * Text-rich, intentionally caregiver-only screen. Progress, install/offline
 * notes, and privacy copy live only here, never on the child home or in a
 * game screen.
 */
export function CaregiverPanel({
  progress,
  onBack,
  onUpdateSettings,
  onReset,
}: CaregiverPanelProps) {
  const [confirmReset, setConfirmReset] = useState(false);
  const [childNameDraft, setChildNameDraft] = useState(progress.settings.childName);

  useEffect(() => {
    setChildNameDraft(progress.settings.childName);
  }, [progress.settings.childName]);

  const commitChildName = () => {
    const childName = normalizeChildName(childNameDraft);
    setChildNameDraft(childName);
    if (childName !== progress.settings.childName) {
      onUpdateSettings({ childName });
    }
  };

  const handleChildNameKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.currentTarget.blur();
    }
  };

  return (
    <main className="page caregiver-page">
      <header className="screen-header caregiver-header">
        <button className="secondary-button" onClick={onBack} type="button">
          חזרה למשחקים
        </button>
        <div>
          <p className="eyebrow">אזור למבוגרים</p>
          <h1>הגדרות והתקדמות</h1>
        </div>
      </header>

      <section className="caregiver-card">
        <h2>מצב השמעה</h2>
        <div className="settings-grid">
          <label>
            <span>שם הילד או הילדה / Child&apos;s name</span>
            <input
              aria-describedby="child-name-privacy"
              autoComplete="off"
              dir="auto"
              maxLength={CHILD_NAME_MAX_LENGTH}
              onBlur={commitChildName}
              onChange={(event) => setChildNameDraft(event.target.value)}
              onKeyDown={handleChildNameKeyDown}
              type="text"
              value={childNameDraft}
            />
            <small id="child-name-privacy">השם נשמר רק במכשיר הזה ומשמש לברכות ולחיזוקים.</small>
          </label>

          <label>
            <span>שפה ראשית</span>
            <select value={progress.settings.languageMode} onChange={(event) => onUpdateSettings({ languageMode: event.target.value as ToddlerSettings['languageMode'] })}>
              <option value="he">עברית</option>
              <option value="en">English</option>
              <option value="bilingual">דו־לשוני</option>
            </select>
          </label>

          <label>
            <span>קול הקראה באנגלית / English narration voice</span>
            <select
              value={progress.settings.englishVoiceLocale}
              onChange={(event) => onUpdateSettings({ englishVoiceLocale: event.target.value as ToddlerSettings['englishVoiceLocale'] })}
            >
              <option value="en-US">{NARRATION_VOICE_PROFILES['en-US'].parentLabel}</option>
              <option value="en-GB">{NARRATION_VOICE_PROFILES['en-GB'].parentLabel}</option>
            </select>
            <small>
              באייפד שני הקולות באנגלית הם קולות ילדה מוקלטים. בעברית נעשה שימוש בקול Hila
              המאושר; Azure אינו מסווג קול ילד עברי במערך הקולות הזמין.
            </small>
          </label>

          <label className="range-control">
            <span>עוצמת קול</span>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={Math.round(progress.settings.soundLevel * 100)}
              onChange={(event) => onUpdateSettings({ soundLevel: Number(event.target.value) / 100 })}
            />
            <strong>{Math.round(progress.settings.soundLevel * 100)}%</strong>
          </label>
        </div>

        <div className="switch-list">
          <label className="switch-row">
            <input
              checked={progress.settings.quietMode}
              onChange={(event) => onUpdateSettings({ quietMode: event.target.checked })}
              type="checkbox"
            />
            <span>
              <strong>מצב שקט</strong>
              <small>מכבה הקראה, צלילי חיזוק ורטט.</small>
            </span>
          </label>
          <label className="switch-row">
            <input
              checked={progress.settings.reducedMotion}
              onChange={(event) => onUpdateSettings({ reducedMotion: event.target.checked })}
              type="checkbox"
            />
            <span>
              <strong>פחות תנועה</strong>
              <small>מפחית אנימציות, קונפטי וחגיגות לתנועה עדינה בלבד.</small>
            </span>
          </label>
        </div>
      </section>

      <FamilyPhotoManager />

      <section className="caregiver-card">
        <h2>התקדמות לפי תחום</h2>
        <div className="domain-progress-list">
          {DOMAIN_KEYS.map((domain) => {
            const item = progress.domains[domain];
            const meta = gameMeta[domain];
            const PortalArt = PORTAL_ART[domain];
            const masteryPercent = Math.round(item.mastery * 100);
            return (
              <article key={domain} className="domain-progress-item">
                <header>
                  <div className="domain-progress-item__title">
                    <PortalArt className="domain-progress-item__icon" />
                    <div>
                      <p>{meta.title}</p>
                      <small>{personalizeChildName(meta.subtitle, progress.settings.childName, 'he')}</small>
                    </div>
                  </div>
                  <ProgressStars count={item.stars} />
                </header>
                <div className="domain-progress-item__stats">
                  <span>שלב {item.level}</span>
                  <span>{item.successes} סיבובים מוצלחים</span>
                  <span>שליטה {masteryPercent}%</span>
                </div>
                <div className="meter" aria-hidden="true">
                  <span style={{ width: `${masteryPercent}%` }} />
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <InstallHint />

      <section className="caregiver-card caregiver-card--notes">
        <h2>הערות חשובות</h2>
        <ul>
          <li>ההתקדמות וההגדרות נשמרות ב־localStorage. עותקי תמונות פרטיים ומוקטנים נשמרים בנפרד ב־IndexedDB. הכול נשאר רק במכשיר הזה, בלי שרת, חשבונות או איסוף אנליטיקות.</li>
          <li>ההקראה משתמשת בתור סדרתי ובקצב מתון, אבל איכות הקול עצמו תלויה בקולות שמותקנים במכשיר. באייפד אפשר להוריד קול משופר דרך הגדרות › נגישות › תוכן מדובר › קולות. אם אין קול זמין, המשחקים עדיין עובדים במלואם עם תמונות ומגע.</li>
          <li>התמונות המשפחתיות אינן מופיעות בדף הבית או במסך הנעילה. הן זמינות רק כאן ובתוך משחק הפאזל.</li>
          <li>הגישה מבוססת בהשראת מקורות מקצועיים חינוכיים לגבי שפה ומסכים (ראו README), אך אינה מציעה אבחון, טיפול או ייעוץ קליני, ואינה תחליף לשיחה ומשחק משותף עם מבוגר.</li>
        </ul>
      </section>

      <section className="caregiver-card privacy-note">
        <strong>פרטיות מלאה:</strong>
        <span>הכול נשמר רק על המכשיר הזה. תמונות נבנות מחדש ללא פרטי מקור, ואינן נשלחות או מסונכרנות. אין חשבונות, פרסומות או איסוף נתונים.</span>
      </section>

      <section className="caregiver-card danger-zone">
        <h2>איפוס</h2>
        <p>האיפוס מוחק התקדמות, הגדרות וכוכבים רק מהמכשיר הזה.</p>
        {!confirmReset ? (
          <button className="danger-button" onClick={() => setConfirmReset(true)} type="button">
            אני רוצה לאפס
          </button>
        ) : (
          <div className="confirm-reset">
            <p>בטוחים? אין דרך להחזיר את המידע אחרי האיפוס.</p>
            <div className="confirm-reset__actions">
              <button className="danger-button" onClick={onReset} type="button">
                כן, לאפס עכשיו
              </button>
              <button className="secondary-button" onClick={() => setConfirmReset(false)} type="button">
                לא, להשאיר כמו שהוא
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
