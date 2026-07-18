import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { gameMeta } from '../content/games';
import { TOY_PHONE_INTEGRATION } from './toyPhoneIntegration';

describe('Toy Phone private integration surface', () => {
  it('exports the complete private integration without entering the public game shelf', () => {
    expect(TOY_PHONE_INTEGRATION).toMatchObject({
      gameId: 'toy-phone',
      visibility: 'private',
      readiness: 'requires-all-recordings',
      mediaPolicy: 'recorded-only',
      contentVersion: 'toy-phone-v1',
      shelfMeta: {
        titleHe: 'טֵלֵפוֹן צַעֲצוּעַ',
        subtitleHe: 'עוֹנִים לַטֵּלֵפוֹן וּמַרְאִים מָה שֶׁהַחָבֵר מְבַקֵּשׁ',
      },
    });
    expect(TOY_PHONE_INTEGRATION.requiredRecordingKeys).toHaveLength(54);
    expect(gameMeta).not.toHaveProperty('toyPhone');
  });

  it('contains no runtime audio or speech synthesis path', () => {
    const mediaSource = readFileSync(resolve('src/services/toyPhoneMedia.ts'), 'utf8');
    expect(mediaSource).not.toMatch(
      /createOscillator|speechSynthesis|getSharedAudioContext|soundService/u,
    );
    expect(mediaSource).toContain("TOY_PHONE_MEDIA_POLICY = 'recorded-only'");
  });
});
