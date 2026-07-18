import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Toy Phone visual safety contract', () => {
  const css = readFileSync(resolve('src/games/ToyPhoneGame.css'), 'utf8');

  it('keeps the handset and response targets at the required coarse sizes', () => {
    expect(css).toMatch(/toy-phone-handset-target[\s\S]*min-width:\s*240px;/u);
    expect(css).toMatch(/toy-phone-handset-target[\s\S]*min-height:\s*120px;/u);
    expect(css).toMatch(/toy-phone-caller-target,[\s\S]*min-width:\s*160px;/u);
    expect(css).toMatch(/toy-phone-caller-target,[\s\S]*min-height:\s*160px;/u);
    expect(css).toMatch(/accent-toy-phone \.rail-button[\s\S]*min-width:\s*88px;/u);
    expect(css).toMatch(/accent-toy-phone \.rail-button[\s\S]*min-height:\s*64px;/u);
  });

  it('reduces ringing to one glow and removes bounce, wave, speech, and paw motion', () => {
    expect(css).toContain('.reduced-motion .toy-phone-device.is-ringing .toy-phone-device__handset');
    expect(css).toContain('.reduced-motion .toy-phone-caller-target.is-waving');
    expect(css).toContain('.reduced-motion .toy-phone-tutorial-mascot__paw');
    expect(css).toMatch(/reduced-motion \.toy-phone-device\.is-ringing \.toy-phone-device__glow[\s\S]*toy-phone-reduced-glow/u);
  });

  it('contains no dial pad or number controls', () => {
    expect(css).not.toMatch(/\b(?:dial|keypad|number-button)\b/u);
  });
});
