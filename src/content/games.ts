import type { DomainKey } from '../domain/types';

export interface GameMeta {
  title: string;
  /** Used for aria-label/caregiver context only; never shown as a child-facing instructional paragraph. */
  subtitle: string;
  accentClass: string;
  colorToken: string;
}

export const gameMeta: Record<DomainKey, GameMeta> = {
  listening: {
    title: 'שומעים ובוחרים',
    subtitle: 'מקשיבים למילה ולוחצים על התמונה הנכונה',
    accentClass: 'accent-listening',
    colorToken: 'coral',
  },
  counting: {
    title: 'כמה יש?',
    subtitle: 'סופרים בכיף בקצב שמתאים לשון',
    accentClass: 'accent-counting',
    colorToken: 'honey',
  },
  sorting: {
    title: 'ממיינים צבעים וצורות',
    subtitle: 'גוררים בעדינות למקום הנכון',
    accentClass: 'accent-sorting',
    colorToken: 'ocean',
  },
  puzzle: {
    title: 'פאזל קטן',
    subtitle: 'מחברים חתיכות גדולות עם סנאפ סלחני',
    accentClass: 'accent-puzzle',
    colorToken: 'plum',
  },
  memory: {
    title: 'זוגות זיכרון',
    subtitle: 'פותחים קלפים ומחפשים זוגות מוכרים',
    accentClass: 'accent-memory',
    colorToken: 'leaf',
  },
  numberPairs: {
    title: 'זוגות מספרים',
    subtitle: 'מתאימים מספרים זהים בשתי שורות',
    accentClass: 'accent-number-pairs',
    colorToken: 'aqua',
  },
  sillyAlien: {
    title: 'החייזר המבולבל',
    subtitle: 'עוזרים לחייזר שבלע את ההברה הראשונה — אומרים את המילה בקול',
    accentClass: 'accent-silly-alien',
    colorToken: 'alien',
  },
  syllableTrain: {
    title: 'רכבת ההברות',
    subtitle: 'מחברים את קרונות ההברות ושומעים את המילה השלמה נוסעת',
    accentClass: 'accent-syllable-train',
    colorToken: 'rail',
  },
};
