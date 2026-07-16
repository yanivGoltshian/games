import { describe, expect, it } from 'vitest';
import {
  getHebrewPronunciation,
  stripNiqqud,
} from '../src/content/hebrewPronunciation.js';
import {
  buildSpeechSsml,
  NEURAL_VOICES,
  readSpeechEnvironment,
} from './speechSsml.js';

describe('Azure neural speech SSML', () => {
  it('uses the requested child-friendly neural voices and prosody', () => {
    expect(NEURAL_VOICES).toEqual({
      'he-IL': { name: 'he-IL-HilaNeural', rate: '-8%', pitch: '+3%' },
      'en-US': { name: 'en-US-AnaNeural', rate: '-8%', pitch: '+3%' },
      'en-GB': { name: 'en-GB-MaisieNeural', rate: '-8%', pitch: '+3%' },
    });

    const ssml = buildSpeechSsml('he-IL', 'שָׁלוֹם, שׁוֹן!');
    expect(ssml).toContain('<voice name="he-IL-HilaNeural">');
    expect(ssml).toContain('<prosody rate="-8%" pitch="+3%">');
    expect(ssml).toContain(',<break time="120ms"/>');
    expect(ssml).toContain('!<break time="240ms"/>');
    expect(ssml).toContain('<break time="100ms"/></prosody>');
  });

  it('escapes all caller text before placing it inside SSML', () => {
    const ssml = buildSpeechSsml('en-US', 'Sean & <break time="9s"> "wait"');

    expect(ssml).toContain(
      'Sean &amp; &lt;break time=&quot;9s&quot;&gt; &quot;wait&quot;',
    );
    expect(ssml).not.toContain('<break time="9s">');
  });

  it('separates Sean from the level-up verb without changing source text', () => {
    const sourceText = 'איזה כיף, שון עולה שלב!';
    const spokenText = getHebrewPronunciation(sourceText);
    const ssml = buildSpeechSsml('he-IL', spokenText).normalize('NFC');

    expect(stripNiqqud(spokenText)).toBe(sourceText);
    expect(ssml).toContain(
      'שׁוֹן<break time="160ms"/> עוֹלֶה'.normalize('NFC'),
    );
    expect(ssml).toContain(',<break time="120ms"/>');
    expect(ssml).toContain('!<break time="240ms"/>');
  });

  it.each([
    'בוא נמיין לפי צבע',
    'בוא נמיין לפי צורה',
  ])('uses a focused IPA override for the sorting verb in "%s"', (sourceText) => {
    const spokenText = getHebrewPronunciation(sourceText);
    const ssml = buildSpeechSsml('he-IL', spokenText).normalize('NFC');
    const fullSpelling = 'נְמַיֵּין'.normalize('NFC');

    expect(stripNiqqud(spokenText)).toBe(sourceText);
    expect(ssml).toContain(
      `<phoneme alphabet="ipa" ph="nemaiˈen">${fullSpelling}</phoneme>`,
    );
    expect(ssml).toContain('בּוֹא<break time="160ms"/> ');
  });
});

describe('Azure speech environment', () => {
  it('accepts a Cognitive Services resource ID and normalizes the region', () => {
    expect(readSpeechEnvironment({
      AZURE_SPEECH_RESOURCE_ID:
        '/subscriptions/sub/resourceGroups/rg/providers/Microsoft.CognitiveServices/accounts/speech/',
      AZURE_SPEECH_REGION: 'SwedenCentral',
    })).toEqual({
      resourceId:
        '/subscriptions/sub/resourceGroups/rg/providers/Microsoft.CognitiveServices/accounts/speech',
      region: 'swedencentral',
    });
  });

  it('rejects missing or unrelated resource configuration', () => {
    expect(() => readSpeechEnvironment({})).toThrow('AZURE_SPEECH_RESOURCE_ID');
    expect(() => readSpeechEnvironment({
      AZURE_SPEECH_RESOURCE_ID:
        '/subscriptions/sub/resourceGroups/rg/providers/Microsoft.Storage/storageAccounts/files',
      AZURE_SPEECH_REGION: 'swedencentral',
    })).toThrow('AZURE_SPEECH_RESOURCE_ID');
  });
});
