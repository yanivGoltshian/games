import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const styles = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
const trainStyles = styles.slice(styles.indexOf('/* Word Train:'));

describe('Word Train touch and reduced-motion styles', () => {
  it('keeps carriages, coupling area, and primary controls toddler sized', () => {
    expect(trainStyles).toMatch(/\.syllable-train-car\s*\{[\s\S]*?min-width:\s*140px/);
    expect(trainStyles).toMatch(/\.syllable-train-car\s*\{[\s\S]*?min-height:\s*110px/);
    expect(trainStyles).toMatch(/\.syllable-train-coupler-target\s*\{[\s\S]*?min-width:\s*120px/);
    expect(trainStyles).toMatch(/\.syllable-train-coupler-target\s*\{[\s\S]*?min-height:\s*120px/);
    expect(trainStyles).toMatch(/\.syllable-train-track\s*\{[\s\S]*?width:\s*100%/);
    expect(trainStyles).toMatch(/\.syllable-train-track\s*\{[\s\S]*?gap:\s*var\(--train-car-gap\)/);
    expect(trainStyles).toMatch(/\.syllable-train-voice,[\s\S]*?min-width:\s*96px/);
    expect(trainStyles).toMatch(/\.syllable-train-voice,[\s\S]*?min-height:\s*96px/);
  });

  it('uses clipped copies of one image and static reduced-motion reward styling', () => {
    expect(trainStyles).toContain('.syllable-train-car__image-clip');
    expect(trainStyles).toContain("[data-reduced-motion='true'][data-lit='true']");
    expect(trainStyles).toContain("[data-reduced-motion='true'] .syllable-train-track[data-riding='true']");
    expect(trainStyles).toMatch(
      /\[data-reduced-motion='true'\] \.syllable-train-track\[data-riding='true'\]\s*\{[\s\S]*?animation:\s*none/,
    );
    expect(trainStyles).toMatch(
      /\[data-reduced-motion='true'\] \.syllable-train-mascot,[\s\S]*?animation:\s*none/,
    );
  });
});
