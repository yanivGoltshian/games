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
const fixtures = [
  ['phone', 390, 844, 'he', 'normal'],
  ['phone-landscape', 844, 390, 'en', 'app'],
  ['ipad', 820, 1180, 'en', 'normal'],
  ['ipad-landscape', 1180, 820, 'he', 'system'],
];
const results = [];
const errors = [];
const check = (condition, name) => { if (!condition) errors.push(name); };
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
  for (const [name, width, height, languageMode, motion] of baseline ? fixtures.slice(0, 1) : fixtures) {
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
      await context.addInitScript(({ languageMode, motion }) => localStorage.setItem('sean-learning-adventure-progress', JSON.stringify({
        version: 6, settings: { languageMode, quietMode: true, reducedMotion: motion === 'app' },
      })), { languageMode, motion });
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
      const automatic = await board.getAttribute('data-sentence');
      check(automatic === 'dates', `${name}: next sentence without input`);
      results.push({ name, width, height, languageMode, motion, brands, idle, held, startX, midX, endX: end.x,
        automatic, observedAfterMs: Date.now() - started });
      if (!baseline && name === 'ipad' && automatic === 'dates') {
        for (const id of ['dates', 'germinate', 'bury', 'water', 'palm', 'token', 'persimmon', 'banana']) {
          assert.equal(await board.getAttribute('data-sentence'), id);
          await target.tap(); await target.tap();
          await page.waitForTimeout(880);
          await board.locator('.sentence-train__action').screenshot({ path: join(output, `scene-${id}-synthetic.png`) });
          await target.tap(); await next.tap();
        }
      }
    } finally { await context.close(); }
  }
  if (!baseline) {
    // Separate fresh profile, installed build, no overrides. Only synthetic
    // screenshots above are shareable; local visual review below is opt-in.
    const context = await browser.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true });
    try {
      const page = await context.newPage();
      page.setDefaultTimeout(6_000);
      await context.addInitScript(() => localStorage.setItem('sean-learning-adventure-progress', JSON.stringify({
        version: 6, settings: { languageMode: 'he', quietMode: true },
      })));
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
        return { caches: await caches.keys(), hashes, alpha };
      });
      assert(receipt.caches.includes('sean-learning-adventure-v32'));
      assert.deepEqual(receipt.alpha, [0, 0, 0, 0, 0, 0, 255, 255]);
      assert.equal(receipt.hashes.station, '9a454e7148fe17f82a5798c214f4a932239af503e208b63dc460c9ac5eac10a6');
      assert.equal(receipt.hashes['sean-avatar'], '628e5081c1098ab6aa9a7f28c8a4fdf09aaababf31a95014f3068a4ce86a68b8');
      await writeFile(join(output, 'offline-assets.json'), JSON.stringify(receipt, null, 2));
      const target = page.locator('.sentence-train__card.is-target');
      for (const id of ['banana', 'dates', 'germinate', 'bury', 'water']) {
        assert.equal(await page.locator('.sentence-train').getAttribute('data-sentence'), id);
        await target.tap(); await target.tap();
        if (id === 'water' && process.env.GARDEN_LOCAL_REVIEW_PATH) {
          assert.equal(await page.locator('img[src^="blob:"]').count(), 0);
          await page.waitForTimeout(560);
          await page.screenshot({ path: process.env.GARDEN_LOCAL_REVIEW_PATH });
        }
        await target.tap(); await page.locator('.sentence-train__next').tap();
      }
    } finally { await context.close(); }
  }
} finally {
  await browser.close();
  await writeFile(join(output, 'garden-chrome.json'), JSON.stringify({ results, errors }, null, 2));
}
assert.deepEqual(errors, []);
