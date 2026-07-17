import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createInitialSettings } from '../domain/progression';
import { HomeScreen } from './HomeScreen';

describe('HomeScreen greeting', () => {
  it('renders the configured name in Hebrew and English modes', () => {
    const base = createInitialSettings();
    const hebrew = renderToStaticMarkup(
      <HomeScreen
        onOpenGame={() => undefined}
        settings={{ ...base, childName: 'נוֹעָה', languageMode: 'he' }}
      />,
    );
    const english = renderToStaticMarkup(
      <HomeScreen
        onOpenGame={() => undefined}
        settings={{ ...base, childName: 'נוֹעָה', languageMode: 'en' }}
      />,
    );

    expect(hebrew).toContain('שלום נוֹעָה');
    expect(english).toContain('Hello נוֹעָה');
    expect(`${hebrew}${english}`).not.toContain('שון');
    expect(`${hebrew}${english}`).not.toContain('Sean');
  });
});
