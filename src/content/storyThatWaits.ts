import {
  createCommunicationLocaleLock,
  type CommunicationGameScope,
  type CommunicationLocaleLock,
} from '../domain/communicationGame';
import type { CommunicationContentRequirements } from '../services/communicationAssetReadiness';
import {
  STORY_THAT_WAITS_HEBREW_DISPLAY_TEXTS,
  type StoryThatWaitsHebrewLookupText,
} from './storyThatWaitsHebrew';

export const STORY_THAT_WAITS_VERSION = 'story-that-waits-v1';
export const STORY_THAT_WAITS_LOCALES = ['he-IL', 'en-US', 'en-GB'] as const;
export type StoryThatWaitsLocale = (typeof STORY_THAT_WAITS_LOCALES)[number];

export const STORY_THAT_WAITS_MAX_WORDS = 7;
export const STORY_THAT_WAITS_MAX_CHARACTERS = 36;

export const STORY_THAT_WAITS_APPROVED_ART_IDS = ['duck', 'ball', 'rabbit', 'carrot', 'bus', 'tree', 'flower', 'cat', 'shoe', 'cup'] as const;
export type StoryThatWaitsArtId = (typeof STORY_THAT_WAITS_APPROVED_ART_IDS)[number];

export const STORY_THAT_WAITS_STORY_IDS = ['duck-and-ball', 'rabbit-and-carrot', 'bus-to-tree-and-flower', 'cat-finds-shoe-and-cup'] as const;
export type StoryThatWaitsStoryId = (typeof STORY_THAT_WAITS_STORY_IDS)[number];

export const STORY_THAT_WAITS_PAGE_IDS = ['page-1', 'page-2', 'page-3', 'page-4'] as const;
export type StoryThatWaitsPageId = (typeof STORY_THAT_WAITS_PAGE_IDS)[number];

export const STORY_THAT_WAITS_ACTION_KINDS = ['see', 'tap', 'roll', 'hug', 'lift', 'smell', 'eat', 'travel', 'stop', 'rest', 'nudge', 'find', 'sit'] as const;
export type StoryThatWaitsActionKind = (typeof STORY_THAT_WAITS_ACTION_KINDS)[number];

export const STORY_THAT_WAITS_NARRATIVE_BEATS = ['beginning', 'middle', 'end'] as const;
export type StoryThatWaitsNarrativeBeat = (typeof STORY_THAT_WAITS_NARRATIVE_BEATS)[number];

export interface StoryThatWaitsUtterance {
  locale: StoryThatWaitsLocale;
  sentence: string;
  recordingKey: string;
  recordedLookupText: string;
  accessibilityLabel: string;
}

export interface StoryThatWaitsIllustrationAction {
  kind: StoryThatWaitsActionKind;
  subjectArtId: StoryThatWaitsArtId;
  objectArtId?: StoryThatWaitsArtId;
}

export interface StoryThatWaitsPage {
  id: StoryThatWaitsPageId;
  order: 1 | 2 | 3 | 4;
  beat: StoryThatWaitsNarrativeBeat;
  action: StoryThatWaitsIllustrationAction;
  artIds: readonly StoryThatWaitsArtId[];
  utterances: Record<StoryThatWaitsLocale, StoryThatWaitsUtterance>;
}

export interface StoryThatWaitsStory {
  id: StoryThatWaitsStoryId;
  order: 1 | 2 | 3 | 4;
  localeLockBoundary: 'session';
  activityId: string;
  titles: Record<StoryThatWaitsLocale, string>;
  pages: readonly StoryThatWaitsPage[];
}

export interface StoryThatWaitsLocaleLockTemplate {
  storyId: StoryThatWaitsStoryId;
  activityId: string;
  boundary: 'session';
}

export const STORY_THAT_WAITS_SHELF_METADATA = {
  'he-IL': {
    title: 'סִפּוּר שֶׁמְּחַכֶּה',
    description: 'גְּעוּ בַּסֵּפֶר',
  },
  'en-US': {
    title: 'Story That Waits',
    description: 'Touch the book',
  },
  'en-GB': {
    title: 'Story That Waits',
    description: 'Touch the book',
  },
} as const satisfies Readonly<Record<
  StoryThatWaitsLocale,
  Readonly<{ title: string; description: string }>
>>;

export interface StoryThatWaitsRecordingRequirement {
  locale: StoryThatWaitsLocale;
  storyId: StoryThatWaitsStoryId;
  pageId: StoryThatWaitsPageId;
  storyOrder: StoryThatWaitsStory['order'];
  pageOrder: StoryThatWaitsPage['order'];
  beat: StoryThatWaitsNarrativeBeat;
  actionKind: StoryThatWaitsActionKind;
  artIds: readonly StoryThatWaitsArtId[];
  recordingKey: string;
  recordedLookupText: string;
  sentence: string;
  accessibilityLabel: string;
}

export const STORY_THAT_WAITS_STORIES = [
  {
    id: 'duck-and-ball',
    order: 1 as const,
    localeLockBoundary: 'session',
    activityId: 'story-that-waits:duck-and-ball',
    titles: {
      'he-IL': 'בַּרְוָז וְכַדּוּר',
      'en-US': 'Duck and Ball',
      'en-GB': 'Duck and Ball',
    },
    pages: [
      {
        id: 'page-1',
        order: 1 as const,
        beat: 'beginning',
        action: {
          kind: 'see',
          subjectArtId: 'duck',
          objectArtId: 'ball',
        },
        artIds: ['duck', 'ball'] as const,
        utterances: {
          'he-IL': {
            locale: 'he-IL',
            sentence: 'ברווז רואה כדור.',
            recordingKey: 'story-that-waits/v1/he-IL/duck-and-ball/page-1',
            recordedLookupText: 'ברווז רואה כדור.',
            accessibilityLabel: 'ברווז וכדור, עמוד 1 מתוך 4. ברווז רואה כדור.',
          },
          'en-US': {
            locale: 'en-US',
            sentence: 'The duck sees a ball.',
            recordingKey: 'story-that-waits/v1/en-US/duck-and-ball/page-1',
            recordedLookupText: 'The duck sees a ball.',
            accessibilityLabel: 'Duck and Ball, page 1 of 4. The duck sees a ball.',
          },
          'en-GB': {
            locale: 'en-GB',
            sentence: 'The duck spots a ball.',
            recordingKey: 'story-that-waits/v1/en-GB/duck-and-ball/page-1',
            recordedLookupText: 'The duck spots a ball.',
            accessibilityLabel: 'Duck and Ball, page 1 of 4. The duck spots a ball.',
          },
        },
      },
      {
        id: 'page-2',
        order: 2 as const,
        beat: 'middle',
        action: {
          kind: 'tap',
          subjectArtId: 'duck',
          objectArtId: 'ball',
        },
        artIds: ['duck', 'ball'] as const,
        utterances: {
          'he-IL': {
            locale: 'he-IL',
            sentence: 'ברווז נוגע בכדור.',
            recordingKey: 'story-that-waits/v1/he-IL/duck-and-ball/page-2',
            recordedLookupText: 'ברווז נוגע בכדור.',
            accessibilityLabel: 'ברווז וכדור, עמוד 2 מתוך 4. ברווז נוגע בכדור.',
          },
          'en-US': {
            locale: 'en-US',
            sentence: 'The duck taps the ball.',
            recordingKey: 'story-that-waits/v1/en-US/duck-and-ball/page-2',
            recordedLookupText: 'The duck taps the ball.',
            accessibilityLabel: 'Duck and Ball, page 2 of 4. The duck taps the ball.',
          },
          'en-GB': {
            locale: 'en-GB',
            sentence: 'The duck gives the ball a tap.',
            recordingKey: 'story-that-waits/v1/en-GB/duck-and-ball/page-2',
            recordedLookupText: 'The duck gives the ball a tap.',
            accessibilityLabel: 'Duck and Ball, page 2 of 4. The duck gives the ball a tap.',
          },
        },
      },
      {
        id: 'page-3',
        order: 3 as const,
        beat: 'middle',
        action: {
          kind: 'roll',
          subjectArtId: 'ball',
          objectArtId: 'duck',
        },
        artIds: ['duck', 'ball'] as const,
        utterances: {
          'he-IL': {
            locale: 'he-IL',
            sentence: 'הכדור מתגלגל אל הברווז.',
            recordingKey: 'story-that-waits/v1/he-IL/duck-and-ball/page-3',
            recordedLookupText: 'הכדור מתגלגל אל הברווז.',
            accessibilityLabel: 'ברווז וכדור, עמוד 3 מתוך 4. הכדור מתגלגל אל הברווז.',
          },
          'en-US': {
            locale: 'en-US',
            sentence: 'The ball rolls to the duck.',
            recordingKey: 'story-that-waits/v1/en-US/duck-and-ball/page-3',
            recordedLookupText: 'The ball rolls to the duck.',
            accessibilityLabel: 'Duck and Ball, page 3 of 4. The ball rolls to the duck.',
          },
          'en-GB': {
            locale: 'en-GB',
            sentence: 'The ball rolls to the duck.',
            recordingKey: 'story-that-waits/v1/en-GB/duck-and-ball/page-3',
            recordedLookupText: 'The ball rolls to the duck.',
            accessibilityLabel: 'Duck and Ball, page 3 of 4. The ball rolls to the duck.',
          },
        },
      },
      {
        id: 'page-4',
        order: 4 as const,
        beat: 'end',
        action: {
          kind: 'hug',
          subjectArtId: 'duck',
          objectArtId: 'ball',
        },
        artIds: ['duck', 'ball'] as const,
        utterances: {
          'he-IL': {
            locale: 'he-IL',
            sentence: 'ברווז מחבק את הכדור.',
            recordingKey: 'story-that-waits/v1/he-IL/duck-and-ball/page-4',
            recordedLookupText: 'ברווז מחבק את הכדור.',
            accessibilityLabel: 'ברווז וכדור, עמוד 4 מתוך 4. ברווז מחבק את הכדור.',
          },
          'en-US': {
            locale: 'en-US',
            sentence: 'The duck hugs the ball.',
            recordingKey: 'story-that-waits/v1/en-US/duck-and-ball/page-4',
            recordedLookupText: 'The duck hugs the ball.',
            accessibilityLabel: 'Duck and Ball, page 4 of 4. The duck hugs the ball.',
          },
          'en-GB': {
            locale: 'en-GB',
            sentence: 'The duck hugs the ball.',
            recordingKey: 'story-that-waits/v1/en-GB/duck-and-ball/page-4',
            recordedLookupText: 'The duck hugs the ball.',
            accessibilityLabel: 'Duck and Ball, page 4 of 4. The duck hugs the ball.',
          },
        },
      },
    ] as const,
  },
  {
    id: 'rabbit-and-carrot',
    order: 2 as const,
    localeLockBoundary: 'session',
    activityId: 'story-that-waits:rabbit-and-carrot',
    titles: {
      'he-IL': 'אַרְנָב וְגֶזֶר',
      'en-US': 'Rabbit and Carrot',
      'en-GB': 'Rabbit and Carrot',
    },
    pages: [
      {
        id: 'page-1',
        order: 1 as const,
        beat: 'beginning',
        action: {
          kind: 'see',
          subjectArtId: 'rabbit',
          objectArtId: 'carrot',
        },
        artIds: ['rabbit', 'carrot'] as const,
        utterances: {
          'he-IL': {
            locale: 'he-IL',
            sentence: 'ארנב רואה גזר.',
            recordingKey: 'story-that-waits/v1/he-IL/rabbit-and-carrot/page-1',
            recordedLookupText: 'ארנב רואה גזר.',
            accessibilityLabel: 'ארנב וגזר, עמוד 1 מתוך 4. ארנב רואה גזר.',
          },
          'en-US': {
            locale: 'en-US',
            sentence: 'The rabbit sees a carrot.',
            recordingKey: 'story-that-waits/v1/en-US/rabbit-and-carrot/page-1',
            recordedLookupText: 'The rabbit sees a carrot.',
            accessibilityLabel: 'Rabbit and Carrot, page 1 of 4. The rabbit sees a carrot.',
          },
          'en-GB': {
            locale: 'en-GB',
            sentence: 'The rabbit spots a carrot.',
            recordingKey: 'story-that-waits/v1/en-GB/rabbit-and-carrot/page-1',
            recordedLookupText: 'The rabbit spots a carrot.',
            accessibilityLabel: 'Rabbit and Carrot, page 1 of 4. The rabbit spots a carrot.',
          },
        },
      },
      {
        id: 'page-2',
        order: 2 as const,
        beat: 'middle',
        action: {
          kind: 'lift',
          subjectArtId: 'rabbit',
          objectArtId: 'carrot',
        },
        artIds: ['rabbit', 'carrot'] as const,
        utterances: {
          'he-IL': {
            locale: 'he-IL',
            sentence: 'ארנב מרים את הגזר.',
            recordingKey: 'story-that-waits/v1/he-IL/rabbit-and-carrot/page-2',
            recordedLookupText: 'ארנב מרים את הגזר.',
            accessibilityLabel: 'ארנב וגזר, עמוד 2 מתוך 4. ארנב מרים את הגזר.',
          },
          'en-US': {
            locale: 'en-US',
            sentence: 'The rabbit lifts the carrot.',
            recordingKey: 'story-that-waits/v1/en-US/rabbit-and-carrot/page-2',
            recordedLookupText: 'The rabbit lifts the carrot.',
            accessibilityLabel: 'Rabbit and Carrot, page 2 of 4. The rabbit lifts the carrot.',
          },
          'en-GB': {
            locale: 'en-GB',
            sentence: 'The rabbit lifts the carrot.',
            recordingKey: 'story-that-waits/v1/en-GB/rabbit-and-carrot/page-2',
            recordedLookupText: 'The rabbit lifts the carrot.',
            accessibilityLabel: 'Rabbit and Carrot, page 2 of 4. The rabbit lifts the carrot.',
          },
        },
      },
      {
        id: 'page-3',
        order: 3 as const,
        beat: 'middle',
        action: {
          kind: 'smell',
          subjectArtId: 'rabbit',
          objectArtId: 'carrot',
        },
        artIds: ['rabbit', 'carrot'] as const,
        utterances: {
          'he-IL': {
            locale: 'he-IL',
            sentence: 'ארנב מריח את הגזר.',
            recordingKey: 'story-that-waits/v1/he-IL/rabbit-and-carrot/page-3',
            recordedLookupText: 'ארנב מריח את הגזר.',
            accessibilityLabel: 'ארנב וגזר, עמוד 3 מתוך 4. ארנב מריח את הגזר.',
          },
          'en-US': {
            locale: 'en-US',
            sentence: 'The rabbit smells the carrot.',
            recordingKey: 'story-that-waits/v1/en-US/rabbit-and-carrot/page-3',
            recordedLookupText: 'The rabbit smells the carrot.',
            accessibilityLabel: 'Rabbit and Carrot, page 3 of 4. The rabbit smells the carrot.',
          },
          'en-GB': {
            locale: 'en-GB',
            sentence: 'The rabbit sniffs the carrot.',
            recordingKey: 'story-that-waits/v1/en-GB/rabbit-and-carrot/page-3',
            recordedLookupText: 'The rabbit sniffs the carrot.',
            accessibilityLabel: 'Rabbit and Carrot, page 3 of 4. The rabbit sniffs the carrot.',
          },
        },
      },
      {
        id: 'page-4',
        order: 4 as const,
        beat: 'end',
        action: {
          kind: 'eat',
          subjectArtId: 'rabbit',
          objectArtId: 'carrot',
        },
        artIds: ['rabbit', 'carrot'] as const,
        utterances: {
          'he-IL': {
            locale: 'he-IL',
            sentence: 'ארנב אוכל את הגזר.',
            recordingKey: 'story-that-waits/v1/he-IL/rabbit-and-carrot/page-4',
            recordedLookupText: 'ארנב אוכל את הגזר.',
            accessibilityLabel: 'ארנב וגזר, עמוד 4 מתוך 4. ארנב אוכל את הגזר.',
          },
          'en-US': {
            locale: 'en-US',
            sentence: 'The rabbit eats the carrot.',
            recordingKey: 'story-that-waits/v1/en-US/rabbit-and-carrot/page-4',
            recordedLookupText: 'The rabbit eats the carrot.',
            accessibilityLabel: 'Rabbit and Carrot, page 4 of 4. The rabbit eats the carrot.',
          },
          'en-GB': {
            locale: 'en-GB',
            sentence: 'The rabbit eats the carrot.',
            recordingKey: 'story-that-waits/v1/en-GB/rabbit-and-carrot/page-4',
            recordedLookupText: 'The rabbit eats the carrot.',
            accessibilityLabel: 'Rabbit and Carrot, page 4 of 4. The rabbit eats the carrot.',
          },
        },
      },
    ] as const,
  },
  {
    id: 'bus-to-tree-and-flower',
    order: 3 as const,
    localeLockBoundary: 'session',
    activityId: 'story-that-waits:bus-to-tree-and-flower',
    titles: {
      'he-IL': 'אוֹטוֹבּוּס לָעֵץ וְלַפֶּרַח',
      'en-US': 'Bus, Tree, and Flower',
      'en-GB': 'Bus, Tree, and Flower',
    },
    pages: [
      {
        id: 'page-1',
        order: 1 as const,
        beat: 'beginning',
        action: {
          kind: 'travel',
          subjectArtId: 'bus',
          objectArtId: 'tree',
        },
        artIds: ['bus', 'tree'] as const,
        utterances: {
          'he-IL': {
            locale: 'he-IL',
            sentence: 'אוטובוס נוסע אל העץ.',
            recordingKey: 'story-that-waits/v1/he-IL/bus-to-tree-and-flower/page-1',
            recordedLookupText: 'אוטובוס נוסע אל העץ.',
            accessibilityLabel: 'אוטובוס לעץ ולפרח, עמוד 1 מתוך 4. אוטובוס נוסע אל העץ.',
          },
          'en-US': {
            locale: 'en-US',
            sentence: 'The bus drives to the tree.',
            recordingKey: 'story-that-waits/v1/en-US/bus-to-tree-and-flower/page-1',
            recordedLookupText: 'The bus drives to the tree.',
            accessibilityLabel: 'Bus, Tree, and Flower, page 1 of 4. The bus drives to the tree.',
          },
          'en-GB': {
            locale: 'en-GB',
            sentence: 'The bus drives to the tree.',
            recordingKey: 'story-that-waits/v1/en-GB/bus-to-tree-and-flower/page-1',
            recordedLookupText: 'The bus drives to the tree.',
            accessibilityLabel: 'Bus, Tree, and Flower, page 1 of 4. The bus drives to the tree.',
          },
        },
      },
      {
        id: 'page-2',
        order: 2 as const,
        beat: 'middle',
        action: {
          kind: 'stop',
          subjectArtId: 'bus',
          objectArtId: 'tree',
        },
        artIds: ['bus', 'tree'] as const,
        utterances: {
          'he-IL': {
            locale: 'he-IL',
            sentence: 'אוטובוס עוצר ליד העץ.',
            recordingKey: 'story-that-waits/v1/he-IL/bus-to-tree-and-flower/page-2',
            recordedLookupText: 'אוטובוס עוצר ליד העץ.',
            accessibilityLabel: 'אוטובוס לעץ ולפרח, עמוד 2 מתוך 4. אוטובוס עוצר ליד העץ.',
          },
          'en-US': {
            locale: 'en-US',
            sentence: 'The bus stops by the tree.',
            recordingKey: 'story-that-waits/v1/en-US/bus-to-tree-and-flower/page-2',
            recordedLookupText: 'The bus stops by the tree.',
            accessibilityLabel: 'Bus, Tree, and Flower, page 2 of 4. The bus stops by the tree.',
          },
          'en-GB': {
            locale: 'en-GB',
            sentence: 'The bus stops beside the tree.',
            recordingKey: 'story-that-waits/v1/en-GB/bus-to-tree-and-flower/page-2',
            recordedLookupText: 'The bus stops beside the tree.',
            accessibilityLabel: 'Bus, Tree, and Flower, page 2 of 4. The bus stops beside the tree.',
          },
        },
      },
      {
        id: 'page-3',
        order: 3 as const,
        beat: 'middle',
        action: {
          kind: 'travel',
          subjectArtId: 'bus',
          objectArtId: 'flower',
        },
        artIds: ['bus', 'flower'] as const,
        utterances: {
          'he-IL': {
            locale: 'he-IL',
            sentence: 'אוטובוס נוסע אל הפרח.',
            recordingKey: 'story-that-waits/v1/he-IL/bus-to-tree-and-flower/page-3',
            recordedLookupText: 'אוטובוס נוסע אל הפרח.',
            accessibilityLabel: 'אוטובוס לעץ ולפרח, עמוד 3 מתוך 4. אוטובוס נוסע אל הפרח.',
          },
          'en-US': {
            locale: 'en-US',
            sentence: 'The bus drives to the flower.',
            recordingKey: 'story-that-waits/v1/en-US/bus-to-tree-and-flower/page-3',
            recordedLookupText: 'The bus drives to the flower.',
            accessibilityLabel: 'Bus, Tree, and Flower, page 3 of 4. The bus drives to the flower.',
          },
          'en-GB': {
            locale: 'en-GB',
            sentence: 'The bus drives to the flower.',
            recordingKey: 'story-that-waits/v1/en-GB/bus-to-tree-and-flower/page-3',
            recordedLookupText: 'The bus drives to the flower.',
            accessibilityLabel: 'Bus, Tree, and Flower, page 3 of 4. The bus drives to the flower.',
          },
        },
      },
      {
        id: 'page-4',
        order: 4 as const,
        beat: 'end',
        action: {
          kind: 'rest',
          subjectArtId: 'bus',
          objectArtId: 'flower',
        },
        artIds: ['bus', 'flower'] as const,
        utterances: {
          'he-IL': {
            locale: 'he-IL',
            sentence: 'אוטובוס נח ליד הפרח.',
            recordingKey: 'story-that-waits/v1/he-IL/bus-to-tree-and-flower/page-4',
            recordedLookupText: 'אוטובוס נח ליד הפרח.',
            accessibilityLabel: 'אוטובוס לעץ ולפרח, עמוד 4 מתוך 4. אוטובוס נח ליד הפרח.',
          },
          'en-US': {
            locale: 'en-US',
            sentence: 'The bus rests by the flower.',
            recordingKey: 'story-that-waits/v1/en-US/bus-to-tree-and-flower/page-4',
            recordedLookupText: 'The bus rests by the flower.',
            accessibilityLabel: 'Bus, Tree, and Flower, page 4 of 4. The bus rests by the flower.',
          },
          'en-GB': {
            locale: 'en-GB',
            sentence: 'The bus rests beside the flower.',
            recordingKey: 'story-that-waits/v1/en-GB/bus-to-tree-and-flower/page-4',
            recordedLookupText: 'The bus rests beside the flower.',
            accessibilityLabel: 'Bus, Tree, and Flower, page 4 of 4. The bus rests beside the flower.',
          },
        },
      },
    ] as const,
  },
  {
    id: 'cat-finds-shoe-and-cup',
    order: 4 as const,
    localeLockBoundary: 'session',
    activityId: 'story-that-waits:cat-finds-shoe-and-cup',
    titles: {
      'he-IL': 'חָתוּל, נַעַל וְכוֹס',
      'en-US': 'Cat, Shoe, and Cup',
      'en-GB': 'Cat, Shoe, and Cup',
    },
    pages: [
      {
        id: 'page-1',
        order: 1 as const,
        beat: 'beginning',
        action: {
          kind: 'see',
          subjectArtId: 'cat',
          objectArtId: 'shoe',
        },
        artIds: ['cat', 'shoe'] as const,
        utterances: {
          'he-IL': {
            locale: 'he-IL',
            sentence: 'חתול רואה נעל.',
            recordingKey: 'story-that-waits/v1/he-IL/cat-finds-shoe-and-cup/page-1',
            recordedLookupText: 'חתול רואה נעל.',
            accessibilityLabel: 'חתול, נעל וכוס, עמוד 1 מתוך 4. חתול רואה נעל.',
          },
          'en-US': {
            locale: 'en-US',
            sentence: 'The cat sees a shoe.',
            recordingKey: 'story-that-waits/v1/en-US/cat-finds-shoe-and-cup/page-1',
            recordedLookupText: 'The cat sees a shoe.',
            accessibilityLabel: 'Cat, Shoe, and Cup, page 1 of 4. The cat sees a shoe.',
          },
          'en-GB': {
            locale: 'en-GB',
            sentence: 'The cat spots a shoe.',
            recordingKey: 'story-that-waits/v1/en-GB/cat-finds-shoe-and-cup/page-1',
            recordedLookupText: 'The cat spots a shoe.',
            accessibilityLabel: 'Cat, Shoe, and Cup, page 1 of 4. The cat spots a shoe.',
          },
        },
      },
      {
        id: 'page-2',
        order: 2 as const,
        beat: 'middle',
        action: {
          kind: 'nudge',
          subjectArtId: 'cat',
          objectArtId: 'shoe',
        },
        artIds: ['cat', 'shoe'] as const,
        utterances: {
          'he-IL': {
            locale: 'he-IL',
            sentence: 'חתול מזיז את הנעל.',
            recordingKey: 'story-that-waits/v1/he-IL/cat-finds-shoe-and-cup/page-2',
            recordedLookupText: 'חתול מזיז את הנעל.',
            accessibilityLabel: 'חתול, נעל וכוס, עמוד 2 מתוך 4. חתול מזיז את הנעל.',
          },
          'en-US': {
            locale: 'en-US',
            sentence: 'The cat nudges the shoe.',
            recordingKey: 'story-that-waits/v1/en-US/cat-finds-shoe-and-cup/page-2',
            recordedLookupText: 'The cat nudges the shoe.',
            accessibilityLabel: 'Cat, Shoe, and Cup, page 2 of 4. The cat nudges the shoe.',
          },
          'en-GB': {
            locale: 'en-GB',
            sentence: 'The cat nudges the shoe.',
            recordingKey: 'story-that-waits/v1/en-GB/cat-finds-shoe-and-cup/page-2',
            recordedLookupText: 'The cat nudges the shoe.',
            accessibilityLabel: 'Cat, Shoe, and Cup, page 2 of 4. The cat nudges the shoe.',
          },
        },
      },
      {
        id: 'page-3',
        order: 3 as const,
        beat: 'middle',
        action: {
          kind: 'find',
          subjectArtId: 'cat',
          objectArtId: 'cup',
        },
        artIds: ['cat', 'cup'] as const,
        utterances: {
          'he-IL': {
            locale: 'he-IL',
            sentence: 'חתול מוצא כוס.',
            recordingKey: 'story-that-waits/v1/he-IL/cat-finds-shoe-and-cup/page-3',
            recordedLookupText: 'חתול מוצא כוס.',
            accessibilityLabel: 'חתול, נעל וכוס, עמוד 3 מתוך 4. חתול מוצא כוס.',
          },
          'en-US': {
            locale: 'en-US',
            sentence: 'The cat finds a cup.',
            recordingKey: 'story-that-waits/v1/en-US/cat-finds-shoe-and-cup/page-3',
            recordedLookupText: 'The cat finds a cup.',
            accessibilityLabel: 'Cat, Shoe, and Cup, page 3 of 4. The cat finds a cup.',
          },
          'en-GB': {
            locale: 'en-GB',
            sentence: 'The cat finds a cup.',
            recordingKey: 'story-that-waits/v1/en-GB/cat-finds-shoe-and-cup/page-3',
            recordedLookupText: 'The cat finds a cup.',
            accessibilityLabel: 'Cat, Shoe, and Cup, page 3 of 4. The cat finds a cup.',
          },
        },
      },
      {
        id: 'page-4',
        order: 4 as const,
        beat: 'end',
        action: {
          kind: 'sit',
          subjectArtId: 'cat',
          objectArtId: 'cup',
        },
        artIds: ['cat', 'cup'] as const,
        utterances: {
          'he-IL': {
            locale: 'he-IL',
            sentence: 'חתול יושב ליד הכוס.',
            recordingKey: 'story-that-waits/v1/he-IL/cat-finds-shoe-and-cup/page-4',
            recordedLookupText: 'חתול יושב ליד הכוס.',
            accessibilityLabel: 'חתול, נעל וכוס, עמוד 4 מתוך 4. חתול יושב ליד הכוס.',
          },
          'en-US': {
            locale: 'en-US',
            sentence: 'The cat sits by the cup.',
            recordingKey: 'story-that-waits/v1/en-US/cat-finds-shoe-and-cup/page-4',
            recordedLookupText: 'The cat sits by the cup.',
            accessibilityLabel: 'Cat, Shoe, and Cup, page 4 of 4. The cat sits by the cup.',
          },
          'en-GB': {
            locale: 'en-GB',
            sentence: 'The cat sits beside the cup.',
            recordingKey: 'story-that-waits/v1/en-GB/cat-finds-shoe-and-cup/page-4',
            recordedLookupText: 'The cat sits beside the cup.',
            accessibilityLabel: 'Cat, Shoe, and Cup, page 4 of 4. The cat sits beside the cup.',
          },
        },
      },
    ] as const,
  },
] as const satisfies readonly StoryThatWaitsStory[];

export const STORY_THAT_WAITS_LOCALE_LOCK_TEMPLATES = STORY_THAT_WAITS_STORIES.map((story) => ({
  storyId: story.id,
  activityId: story.activityId,
  boundary: story.localeLockBoundary,
})) as readonly StoryThatWaitsLocaleLockTemplate[];

const storiesById = STORY_THAT_WAITS_STORY_IDS.reduce((registry, storyId) => {
  const story = STORY_THAT_WAITS_STORIES.find((candidate) => candidate.id === storyId);
  if (!story) {
    throw new Error(`Missing Story That Waits definition for ${storyId}`);
  }
  registry[storyId] = story;
  return registry;
}, {} as Record<StoryThatWaitsStoryId, StoryThatWaitsStory>);

function wordCount(sentence: string): number {
  return sentence.trim().split(/\s+/u).filter(Boolean).length;
}

function uniqueArtIds(story: StoryThatWaitsStory): readonly StoryThatWaitsArtId[] {
  return [...new Set(story.pages.flatMap((page) => page.artIds))] as readonly StoryThatWaitsArtId[];
}

export function getStoryThatWaitsStory(storyId: StoryThatWaitsStoryId): StoryThatWaitsStory {
  return storiesById[storyId];
}

export function getStoryThatWaitsPage(
  storyId: StoryThatWaitsStoryId,
  pageId: StoryThatWaitsPageId,
): StoryThatWaitsPage {
  const page = getStoryThatWaitsStory(storyId).pages.find((candidate) => candidate.id === pageId);
  if (!page) {
    throw new Error(`Unknown Story That Waits page: ${storyId}/${pageId}`);
  }
  return page;
}

export function getStoryThatWaitsUtterance(
  storyId: StoryThatWaitsStoryId,
  pageId: StoryThatWaitsPageId,
  locale: StoryThatWaitsLocale,
): StoryThatWaitsUtterance {
  return getStoryThatWaitsPage(storyId, pageId).utterances[locale];
}

export function getStoryThatWaitsDisplaySentence(
  storyId: StoryThatWaitsStoryId,
  pageId: StoryThatWaitsPageId,
  locale: StoryThatWaitsLocale,
): string {
  const utterance = getStoryThatWaitsUtterance(storyId, pageId, locale);
  if (locale !== 'he-IL') {
    return utterance.sentence;
  }
  const displaySentence = STORY_THAT_WAITS_HEBREW_DISPLAY_TEXTS[
    utterance.recordedLookupText as StoryThatWaitsHebrewLookupText
  ];
  if (!displaySentence) {
    throw new Error(`Missing pointed Story display sentence for ${storyId}/${pageId}`);
  }
  return displaySentence;
}

export function getStoryThatWaitsAccessibilityLabel(
  storyId: StoryThatWaitsStoryId,
  pageId: StoryThatWaitsPageId,
  locale: StoryThatWaitsLocale,
): string {
  if (locale !== 'he-IL') {
    return getStoryThatWaitsUtterance(storyId, pageId, locale).accessibilityLabel;
  }
  const story = getStoryThatWaitsStory(storyId);
  const page = getStoryThatWaitsPage(storyId, pageId);
  return `${story.titles[locale]}, עַמּוּד ${page.order} מִתּוֹךְ 4. ${getStoryThatWaitsDisplaySentence(storyId, pageId, locale)}`;
}

export function getStoryThatWaitsRecordingKeys(
  locale?: StoryThatWaitsLocale,
): readonly string[] {
  return collectStoryThatWaitsRecordingRequirements(locale).map((entry) => entry.recordingKey);
}

export function getStoryThatWaitsRecordedLookupTexts(
  locale?: StoryThatWaitsLocale,
): readonly string[] {
  return collectStoryThatWaitsRecordingRequirements(locale).map((entry) => entry.recordedLookupText);
}

export function createStoryThatWaitsScope(
  storyId: StoryThatWaitsStoryId,
  sessionId: string,
  pageId: StoryThatWaitsPageId = 'page-1',
): CommunicationGameScope {
  return {
    activityId: getStoryThatWaitsStory(storyId).activityId,
    sessionId,
    roundId: storyId,
    stepId: pageId,
  };
}

export function createStoryThatWaitsLocaleLock(
  storyId: StoryThatWaitsStoryId,
  sessionId: string,
  locale: StoryThatWaitsLocale,
  pageId: StoryThatWaitsPageId = 'page-1',
): CommunicationLocaleLock {
  return createCommunicationLocaleLock(
    createStoryThatWaitsScope(storyId, sessionId, pageId),
    locale,
    'session',
  );
}

export function createStoryThatWaitsContentRequirements(
  storyId: StoryThatWaitsStoryId,
  sessionId: string,
  locale: StoryThatWaitsLocale,
): CommunicationContentRequirements {
  const story = getStoryThatWaitsStory(storyId);
  return {
    contentVersion: STORY_THAT_WAITS_VERSION,
    scope: createStoryThatWaitsScope(storyId, sessionId),
    locale,
    localeLock: createStoryThatWaitsLocaleLock(storyId, sessionId, locale),
    recordingKeys: story.pages.map((page) => page.utterances[locale].recordedLookupText),
    images: uniqueArtIds(story).map((artId) => ({ kind: 'id', value: artId })),
  };
}

export function collectStoryThatWaitsRecordingRequirements(
  locale?: StoryThatWaitsLocale,
): readonly StoryThatWaitsRecordingRequirement[] {
  const requirements: StoryThatWaitsRecordingRequirement[] = [];
  for (const story of STORY_THAT_WAITS_STORIES) {
    for (const page of story.pages) {
      for (const storyLocale of STORY_THAT_WAITS_LOCALES) {
        if (locale && locale !== storyLocale) {
          continue;
        }
        const utterance = page.utterances[storyLocale];
        requirements.push({
          locale: storyLocale,
          storyId: story.id,
          pageId: page.id,
          storyOrder: story.order,
          pageOrder: page.order,
          beat: page.beat,
          actionKind: page.action.kind,
          artIds: page.artIds,
          recordingKey: utterance.recordingKey,
          recordedLookupText: utterance.recordedLookupText,
          sentence: utterance.sentence,
          accessibilityLabel: utterance.accessibilityLabel,
        });
      }
    }
  }
  return requirements;
}

export function storyThatWaitsSentenceWithinBounds(sentence: string): boolean {
  return wordCount(sentence) <= STORY_THAT_WAITS_MAX_WORDS
    && sentence.length <= STORY_THAT_WAITS_MAX_CHARACTERS;
}
