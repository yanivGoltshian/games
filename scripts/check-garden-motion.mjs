import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// Same separately installed Playwright / branded Chrome arrangement as check-pair-layout.
const [origin, output, mode] = process.argv.slice(2);
const url = new URL(origin);
assert(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname) && output);
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const baseline = mode === 'baseline';
const visualOnly = mode === 'visual';
const fixtures = [
  ['phone', 390, 844, 'he', 'normal'],
  ['phone-landscape', 844, 390, 'en', 'app'],
  ['ipad', 820, 1180, 'en', 'normal'],
  ['ipad-landscape', 1180, 820, 'he', 'system'],
];
const results = [];
const errors = [];
const check = (condition, name) => { if (!condition) errors.push(name); };
const waitForPaint = (page, symbol) => page.waitForFunction((id) =>
  document.querySelector(`.sentence-train__theater use[href$="#${id}"]`)?.getBBox().width > 0,
symbol, { timeout: 1_000 });
// Deliberately mechanical stand-in at the same grasp anchor. No personal media in test screenshots.
const synthetic = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 456 936">
  <rect x="89" y="129" width="237" height="232" rx="30" fill="#9499bc"/>
  <path d="M144 240h31m49 0h31m-53 72h40" stroke="#27445a" stroke-width="15"/>
  <path d="M137 722v155m107-155v155M116 415l-46 52" stroke="#536e86" stroke-width="52" stroke-linecap="round"/>
  <path d="M274 397l86 43 30-22" fill="none" stroke="#536e86" stroke-width="33" stroke-linecap="round"/>
  <rect x="100" y="362" width="194" height="393" rx="32" fill="#536e86"/>
  <path d="M374 417l18-50 26-16m-24 55 39-25" fill="none" stroke="#828da7" stroke-width="20" stroke-linecap="round"/>
</svg>`;
try {
  await mkdir(output, { recursive: true });
  for (const [name, width, height, languageMode, motion] of baseline || visualOnly ? fixtures.filter((f) => f[4] === 'normal') : fixtures) {
    const context = await browser.newContext({
      viewport: { width, height }, isMobile: true, hasTouch: true, serviceWorkers: 'block',
      reducedMotion: motion === 'system' ? 'reduce' : 'no-preference',
    });
    try {
      await context.route('**/*', (route) => {
        const request = new URL(route.request().url());
        if (request.origin !== url.origin) return route.abort();
        if (request.pathname.endsWith('sean-avatar.webp')) return route.fulfill({ contentType: 'image/svg+xml', body: synthetic });
        return route.continue();
      });
      await context.addInitScript(({ languageMode, motion }) => {
        // Same opening banana for the before/after comparison, no test flags in the app.
        Math.random = () => 2 / 0x100000000;
        localStorage.setItem('sean-learning-adventure-progress', JSON.stringify({
          version: 6, settings: { languageMode, quietMode: true, reducedMotion: motion === 'app' },
        }));
      }, { languageMode, motion });
      const page = await context.newPage();
      page.setDefaultTimeout(4_500);
      page.on('pageerror', (err) => errors.push(`${name}: ${err.message}`));
      await page.goto(`${url.origin}/#/games/wordGarden`);
      const board = page.locator('.sentence-train');
      const target = board.locator('.is-target');
      const next = board.locator('.sentence-train__next');
      await target.waitFor();
      const brands = await page.evaluate(() => navigator.userAgentData.brands);
      assert(brands.some(({ brand }) => brand === 'Google Chrome'));
      const box = await target.boundingBox();
      check(box.width >= 48 && box.height >= 48 && box.x >= 0 && box.y >= 0 && box.y + box.height <= height, `${name}: touch area`);
      const idle = await target.evaluate((button) => button.getAnimations({ subtree: true }).map((a) => a.animationName));
      check(idle.includes('garden-invite') === (motion === 'normal'), `${name}: target invitation`);
      check(await board.locator('.sentence-train__card:not(.is-target)').evaluateAll((cards) =>
        cards.every((c) => !c.getAnimations({ subtree: true }).length)), `${name}: inactive cards still`);
      await page.waitForTimeout(180);
      assert.deepEqual(await target.boundingBox(), box, `${name}: stationary hit area`);
      const x = Math.round(box.x + 4), y = Math.round(box.y + box.height / 2);
      assert(await target.evaluate((el, [x, y]) => el.contains(document.elementFromPoint(x, y)), [x, y]));
      const touch = await context.newCDPSession(page);
      const contact = (type, at) => touch.send('Input.dispatchTouchEvent', {
        type, touchPoints: at ? [{ x: at, y, id: 1, radiusX: 2, radiusY: 2 }] : [],
      });
      await contact('touchStart', x);
      await page.waitForTimeout(100);
      const pressed = await target.evaluate((el) => getComputedStyle(el.querySelector('.sentence-train__face') || el).backgroundColor);
      check(pressed === 'rgb(255, 208, 100)', `${name}: immediate press feedback`);
      await page.waitForTimeout(450);
      await contact('touchMove', x - 18);
      await contact('touchEnd');
      await page.waitForTimeout(80);
      const held = await target.getAttribute('data-garden-part');
      check(held === 'action', `${name}: 550ms hold + 18px slip advances exactly one card`);
      if (held === 'actor') await target.tap(); // Independent auto-advance check even on the released build.
      await target.tap();
      assert.equal(await board.getAttribute('data-sentence'), 'banana');
      const scene = board.locator(baseline ? '[data-garden-part="action"] .garden-scene' : '.sentence-train__theater .garden-scene');
      const sceneBox = await scene.boundingBox();
      const actorScale = await scene.locator('.sentence-train__actor').evaluate(el => el.getScreenCTM().a);
      if (motion === 'normal') {
        await page.waitForTimeout(550);
        await page.screenshot({ path: join(output, `${name}-bite-synthetic.png`) });
      }
      if (!baseline) {
        const cardScale = await board.locator('[data-garden-part="action"] .sentence-train__actor').evaluate(el => el.getScreenCTM().a);
        if (motion === 'normal') {
          check(sceneBox.width > width * .58 && actorScale > cardScale * 1.6, `${name}: substantial enlargement of the actual actor`);
        }
        check(await target.evaluate(el => {
          const b = el.getBoundingClientRect();
          return el.contains(document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2));
        }), `${name}: object still exposed throughout playback`);
      }
      const startX = (await board.locator('.sentence-train__engine').boundingBox()).x;
      await target.tap(); await next.waitFor();
      const started = Date.now();
      await page.waitForTimeout(1_100);
      const midX = (await board.locator('.sentence-train__engine').boundingBox()).x;
      await page.waitForTimeout(1_450);
      const end = await board.locator('.sentence-train__engine').boundingBox();
      const station = await board.locator('.sentence-train__station').count()
        ? await board.locator('.sentence-train__station').boundingBox() : null;
      const dir = languageMode === 'en' ? 1 : -1;
      const midway = (midX - startX) / (end.x - startX);
      check((end.x - startX) * dir > width * .25 && station && end.x < station.x + station.width &&
        station.x < end.x + end.width, `${name}: train reaches the station in reading direction`);
      check(motion === 'normal' ? midway > .1 && midway < .9 : Math.abs(midX - end.x) < 1, `${name}: travel timing/motion preference`);
      check(await board.getAttribute('data-journey') === 'station' && await next.isVisible(), `${name}: visible station dwell`);
      if (!baseline) await page.screenshot({ path: join(output, `${name}-station-synthetic.png`) });
      await page.waitForTimeout(1_000);
      const restingSentence = await board.getAttribute('data-sentence');
      check(restingSentence === (baseline ? 'dates' : 'banana'), `${name}: station holds until Next`);
      results.push({ name, width, height, languageMode, motion, brands, idle, held, startX, midX, endX: end.x,
        sceneBox, actorScale, restingSentence, observedAfterMs: Date.now() - started });
      if (!baseline && motion === 'normal') {
        assert(await scene.isVisible());
        await next.tap();
        assert.equal(await board.getAttribute('data-sentence'), 'banana-peel');
        await target.tap(); await target.tap();
        const plant = board.locator('.sentence-train__theater');
        assert.equal(await plant.locator('.sentence-train__actor').count(), 0);
        await waitForPaint(page, 'peel');
        await page.waitForTimeout(550);
        await page.screenshot({ path: join(output, `${name}-peel-synthetic.png`) });
        assert.equal(await target.getAttribute('data-garden-part'), 'object');
        await target.tap();
        assert(await plant.isVisible());
        await next.tap();
        await plant.waitFor({ state: 'detached' });
      }
    } finally { await context.close(); }
  }
  if (!baseline && !visualOnly) {
    // Clean installed profiles. The only offline screenshot is a non-person
    // plant scene; the bundled portrait is checked by digest, never captured.
    for (const [name, width, height] of fixtures.filter(f => f[4] === 'normal')) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: true });
    try {
      const page = await context.newPage();
      page.setDefaultTimeout(6_000);
      await context.addInitScript(({ name }) => {
        Math.random = () => 3 / 0x100000000;
        const checkVoice = location.search === '?voice-proof';
        localStorage.setItem('sean-learning-adventure-progress', JSON.stringify({
          version: 6, settings: { languageMode: checkVoice && name === 'ipad' ? 'en' : 'he',
            englishVoiceLocale: 'en-US', quietMode: !checkVoice },
        }));
        // Observe the real player's decoded-buffer slices, without replacing sound or advancing its clock.
        window.gardenPlayback = [];
        const start = AudioBufferSourceNode.prototype.start;
        AudioBufferSourceNode.prototype.start = function (...args) {
          const began = this.context.currentTime;
          const receipt = { offset: args[1], duration: args[2], elapsed: 0, state: this.context.state };
          this.addEventListener('ended', () => { receipt.elapsed = this.context.currentTime - began; });
          const result = start.apply(this, args);
          window.gardenPlayback.push(receipt);
          return result;
        };
      }, { name });
      await page.goto(`${url.origin}/#/games/wordGarden`);
      await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
      await context.setOffline(true);
      await page.reload();
      const receipt = await page.evaluate(async () => {
        const hashes = {};
        const assets = ['sean-avatar', 'station'];
        const alpha = [];
        for (const name of assets) {
          const blob = await (await fetch(`/assets/garden/${name}.webp`)).blob();
          hashes[name] = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())),
            (byte) => byte.toString(16).padStart(2, '0')).join('');
          if (name === 'sean-avatar') {
            const image = await createImageBitmap(blob);
            const canvas = new OffscreenCanvas(image.width, image.height);
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(image, 0, 0);
            for (const [x, y] of [[0,0], [455,0], [0,935], [455,935], [425,340], [67,641], [222,326], [408,383]]) {
              alpha.push(ctx.getImageData(x, y, 1, 1).data[3]);
            }
            image.close();
          }
        }
        const manifest = await (await fetch('/speech/manifest.json?rev=garden-stories-v2')).json();
        const clips = {};
        for (const key of ['he-IL\u0000שון אוכל אבוקדו', 'en-US\u0000Sean eats an avocado',
          'en-GB\u0000Sean eats an avocado', 'he-IL\u0000אפשר להגיד את כל המשפט?']) {
          const entry = manifest.entries[key];
          const buffer = await (await fetch(entry.src)).arrayBuffer();
          if (!entry.duration || buffer.byteLength < 1000) throw Error(`Missing offline clip: ${key}`);
          clips[key] = { ...entry, bytes: buffer.byteLength };
        }
        return { caches: await caches.keys(), hashes, alpha, clips };
      });
      assert(receipt.caches.includes('sean-learning-adventure-v34'));
      assert.deepEqual(receipt.alpha, [0, 0, 0, 0, 0, 0, 255, 255]);
      assert.equal(receipt.hashes.station, '9a454e7148fe17f82a5798c214f4a932239af503e208b63dc460c9ac5eac10a6');
      assert.equal(receipt.hashes['sean-avatar'], '628e5081c1098ab6aa9a7f28c8a4fdf09aaababf31a95014f3068a4ce86a68b8');
      await writeFile(join(output, `${name}-offline-assets.json`), JSON.stringify(receipt, null, 2));
      const target = page.locator('.sentence-train__card.is-target');
      for (const id of ['avocado-eat', 'avocado-water', 'avocado-shoot', 'avocado-soil']) {
        assert.equal(await page.locator('.sentence-train').getAttribute('data-sentence'), id);
        await target.tap(); await target.tap();
        if (id === 'avocado-eat') {
          await waitForPaint(page, 'avocado-flesh');
          assert.equal(await page.locator('.sentence-train__theater use[href$="#pit"]').count(), 0);
        }
        if (id === 'avocado-shoot') {
          const preview = page.locator('.sentence-train__theater');
          assert.equal(await preview.locator('foreignObject').count(), 0);
          await waitForPaint(page, 'shoot');
          await page.waitForTimeout(760);
          await page.screenshot({ path: join(output, `${name}-offline-shoot.png`) });
        }
        await target.tap(); await page.locator('.sentence-train__next').tap();
      }
      await page.goto(`${url.origin}/?voice-proof#/games/wordGarden`);
      const checks = await page.evaluate(async (english) => {
        const manifest = await (await fetch('/speech/manifest.json?rev=garden-stories-v2')).json();
        const keys = english ? ['en-US\u0000Can you say the whole sentence?', 'en-US\u0000Sean eats an avocado']
          : ['he-IL\u0000אפשר להגיד את כל המשפט?', 'he-IL\u0000שון אוכל אבוקדו'];
        return keys.map(key => ({ key, ...manifest.entries[key] }));
      }, name === 'ipad');
      await target.tap(); await target.tap(); await target.tap();
      await page.locator('.sentence-train__next').waitFor({ timeout: 20_000 });
      await page.locator('.sentence-train[data-departed="true"]').waitFor({ timeout: 20_000 });
      const playback = await page.evaluate(() => window.gardenPlayback);
      for (const clip of checks) {
        assert(playback.some(item => item.elapsed >= clip.duration - .05 && item.state === 'running'
          && item.offset === clip.offset && item.duration === clip.duration), `${name}: offline app plays ${clip.key}`);
      }
      await writeFile(join(output, `${name}-offline-playback.json`), JSON.stringify({ checks, playback }, null, 2));
      if (name === 'phone') {
        const turns = [];
        for (let i = 0; i < 22; i++) {
          if (i > 0) {
            await target.tap(); await target.tap(); await target.tap();
            await page.locator('.rail-button--replay').tap();
            await page.locator('.sentence-train[data-departed="true"]').waitFor({ timeout: 15_000 });
          }
          const turn = await page.evaluate(async () => {
            const board = document.querySelector('.sentence-train');
            const pointed = board.querySelector('h1').textContent;
            const text = pointed.normalize('NFC').replace(/[\u0591-\u05bd\u05bf-\u05c7]/gu, '');
            const manifest = await (await fetch('/speech/manifest.json?rev=garden-stories-v2')).json();
            const clip = manifest.entries[`he-IL\u0000${text}`];
            return { id: board.dataset.sentence, pointed, text, clip, played: clip && window.gardenPlayback.some(
              r => r.offset === clip.offset && r.duration === clip.duration && r.elapsed >= clip.duration - .05),
            };
          });
          assert(turn.pointed !== turn.text && turn.played, `${name}: pointed caption and offline full model for ${turn.id}`);
          turns.push(turn);
          await page.locator('.sentence-train__next').tap();
        }
        assert.equal(new Set(turns.map(t => t.id)).size, 22);
        await writeFile(join(output, 'all-hebrew-models-offline.json'), JSON.stringify(turns, null, 2));
      }
    } finally { await context.close(); }
    }
  }
} finally {
  await browser.close();
  await writeFile(join(output, 'garden-chrome.json'), JSON.stringify({ results, errors }, null, 2));
}
assert.deepEqual(errors, []);
