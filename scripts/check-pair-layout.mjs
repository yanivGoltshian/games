import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// Use a separately installed Playwright and an actual Chrome channel, never a shared profile.
const [origin, output] = process.argv.slice(2);
const url = new URL(origin);
assert(['http:', 'https:'].includes(url.protocol) && ['127.0.0.1', 'localhost'].includes(url.hostname),
  'Use a loopback build only: this check seeds synthetic progress and plays both games.');
assert(output, 'Usage: node scripts/check-pair-layout.mjs <loopback origin> <artifact directory>');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });

const viewports = [
  ['phone', 360, 740, true],
  ['phone-landscape', 740, 360, true],
  ['small-phone', 320, 568, true],
  ['short-landscape', 568, 320, true],
  ['tablet', 820, 1180, true],
  ['tablet-landscape', 1180, 820, true],
  ['desktop', 1440, 900, false],
  ['zoom-reflow', 256, 200, false],
];
const games = [
  { route: 'memory', card: '.memory-card', bands: '.memory-grid', levels: [4, 6, 8, 10, 12, 14, 16] },
  { route: 'numberPairs', card: '.number-pair-tile', bands: '.number-pairs-row', levels: [3, 4, 5, 6, 7, 8, 9, 10] },
];
const progressKey = 'sean-learning-adventure-progress';
const measures = [];
const failures = [];
const verify = (valid, label, description) => {
  if (!valid) failures.push(`${label}: ${description}`);
};

async function measure(page, game) {
  return page.evaluate(({ card, bands }) => {
    const shell = document.querySelector('.game-shell');
    const field = shell.querySelector('.pair-playfield') || shell.querySelector('.game-stage');
    const rail = shell.querySelector('.game-top-rail');
    const coach = shell.querySelector('.retry-coach');
    const dimensions = (element) => {
      const { x, y, width, height, bottom, right } = element.getBoundingClientRect();
      return { x, y, width, height, bottom, right };
    };
    const overlap = (a, b) => a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y;
    const groups = [...shell.querySelectorAll(bands)].map((band) => {
      const area = dimensions(band);
      const cards = [...band.querySelectorAll(card)];
      const direction = getComputedStyle(band).direction;
      const boxes = cards.map(dimensions);
      const rows = boxes.reduce((result, box) => {
        const row = result.at(-1);
        if (row && Math.abs(row[0].y - box.y) < 1) row.push(box);
        else result.push([box]);
        return result;
      }, []);
      const ten = cards.find((tile) => tile.textContent.trim() === '10')?.firstElementChild;
      const art = cards[0].querySelector('img');
      const artStyle = art && getComputedStyle(art);
      return {
        area,
        count: cards.length,
        minWidth: Math.min(...boxes.map((box) => box.width)),
        minHeight: Math.min(...boxes.map((box) => box.height)),
        rows: rows.map((row) => row.length),
        fillX: Math.max(...rows.map((row) => Math.max(...row.map((box) => box.right)) -
          Math.min(...row.map((box) => box.x)))) / area.width,
        centerDrift: Math.max(...rows.map((row) => Math.abs(
          (Math.max(...row.map((box) => box.right)) + Math.min(...row.map((box) => box.x))) / 2 -
          (area.x + area.width / 2),
        ))),
        ordered: rows.every((row) => row.every((box, i) => i === 0 ||
          (direction === 'rtl' ? box.right <= row[i - 1].x : box.x >= row[i - 1].right))),
        visible: boxes.every((box) => box.x >= 0 && box.right <= innerWidth &&
          box.y >= rail.getBoundingClientRect().bottom && box.bottom <= innerHeight),
        coachClear: boxes.every((box) => !overlap(box, dimensions(coach))),
        density: boxes.reduce((total, box) => total + box.width * box.height, 0) / (area.width * area.height),
        tenFont: ten ? parseFloat(getComputedStyle(ten).fontSize) : null,
        tenFits: !ten || (ten.offsetWidth <= ten.parentElement.clientWidth &&
          ten.offsetHeight <= ten.parentElement.clientHeight),
        artFit: artStyle?.objectFit,
        artWidth: art ? parseFloat(artStyle.width) : null,
      };
    });
    const controls = [...rail.querySelectorAll('button')];
    return {
      stage: dimensions(field), groups, controls: controls.map((button) => button.className),
      viewport: [innerWidth, innerHeight],
      homeOnRight: controls[0].getBoundingClientRect().x > controls[1].getBoundingClientRect().x,
      hScroll: Math.max(0, document.documentElement.scrollWidth - innerWidth, field.scrollWidth - field.clientWidth),
      vScroll: Math.max(0, document.documentElement.scrollHeight - innerHeight, field.scrollHeight - field.clientHeight),
      railSize: dimensions(controls[0]).width,
    };
  }, game);
}

async function playPair(page, game, label) {
  const cards = page.locator(game.card);
  const lastControl = page.locator('.rail-button--restart');
  await lastControl.focus();
  await page.keyboard.press('Tab');
  verify(await cards.first().evaluate((el) => el.matches(':focus-visible') &&
    document.activeElement === el && getComputedStyle(el).outlineStyle !== 'none'),
  label, 'Tab from restart reaches the first card with a visible focus ring');
  if (game.route === 'memory') {
    const pictures = await cards.evaluateAll((items) => items.map((item) => item.querySelector('img').src));
    const mate = pictures.indexOf(pictures[0], 1);
    assert(mate > 0, 'synthetic Memory seed must contain a pair');
    await page.keyboard.press('Enter');
    verify(await cards.first().getAttribute('aria-pressed') === 'true', label, 'keyboard flips the first card');
    await cards.nth(mate).click();
    assert.equal(await page.locator('.memory-card--celebrated:disabled').count(), 2);
    await page.locator('.memory-card--celebrated img').evaluateAll((images) =>
      Promise.all(images.map((image) => image.decode())));
  } else {
    const top = page.locator('.number-pairs-row--top button').first();
    const value = await top.textContent();
    const bottom = page.locator('.number-pairs-row--bottom button').filter({ hasText: new RegExp(`^${value}$`) });
    await page.keyboard.press('Enter');
    assert.equal(await top.getAttribute('aria-pressed'), 'true');
    assert.match(await top.getAttribute('class'), /is-selected/);
    await bottom.click();
    assert.equal(await page.locator('.number-pair-tile.is-matched:disabled').count(), 2);
  }
}

try {
  await mkdir(output, { recursive: true });
  let chromeIdentity;
  for (const [device, width, height, touch] of viewports) {
    const isZoom = device === 'zoom-reflow';
    const en = device === 'desktop';
    const context = await browser.newContext({
      viewport: { width, height }, hasTouch: touch, isMobile: touch,
      deviceScaleFactor: 1, reducedMotion: 'reduce', serviceWorkers: 'block',
    });
    await context.addInitScript(({ progressKey, en }) => {
      const [route, fixture] = (location.hash.split('?')[1] || '').split(':');
      if (!fixture) return;
      const level = Number(fixture);
      localStorage.setItem(progressKey, JSON.stringify({
        version: 6,
        settings: { childName: 'Demo', languageMode: en ? 'en' : 'he', quietMode: true, reducedMotion: true },
        domains: { [route]: { level, highestLevel: level, attempts: 11 } },
      }));
      localStorage.removeItem(`${progressKey}:pair-stages:v1`);
    }, { progressKey, en });
    try {
      const page = await context.newPage();
      page.setDefaultTimeout(4000);
      for (const game of games) {
        const isMemory = game.route === 'memory';
        for (const [index, count] of game.levels.entries()) {
          if (isZoom && count !== game.levels.at(-1)) continue;
          const label = `${device}/${game.route}/${count}`;
          const openThroughPortal = device === 'phone' && count === (isMemory ? 10 : 7);
          await page.goto(`${url.origin}/#${openThroughPortal ? '/' : `/games/${game.route}`}?${game.route}:${index + 1}`);
          await page.reload(); // Apply the fixture even for same-document hash navigation.
          if (openThroughPortal) {
            await page.locator(isMemory ? '.portal-card.accent-memory' : '.portal-card.accent-number-pairs').tap();
            await page.waitForURL(`**/#/games/${game.route}`);
          }
          await page.locator(game.card).first().waitFor();
          if (!chromeIdentity) {
            chromeIdentity = await page.evaluate(() => navigator.userAgentData.brands);
            assert(chromeIdentity.some(({ brand }) => brand === 'Google Chrome'), 'expected branded Google Chrome');
          }
          const result = await measure(page, game);
          measures.push({ device, width, height, route: game.route, count, ...result });
          verify(result.viewport[0] === width && result.viewport[1] === height, label, 'effective viewport matches fixture');
          verify(result.controls.length === 2 && result.controls[0].includes('--home') &&
            result.controls[1].includes('--restart') && result.homeOnRight, label, 'original control order and sides');
          verify(result.hScroll === 0, label, 'no horizontal overflow');
          verify(isZoom || result.vScroll === 0, label, 'no vertical scroll at standard viewport');
          verify(result.groups.length === (isMemory ? 1 : 2), label, 'original group structure');
          if (!isMemory && result.groups.length === 2) {
            verify(result.groups[0].area.bottom < result.groups[1].area.y, label, 'top and bottom bands do not overlap');
          }
          for (const group of result.groups) {
            verify(group.count === count, label, `expected ${count} buttons, got ${group.count}`);
            verify(group.ordered && group.centerDrift <= 1, label, `visual order and centered rows (drift ${group.centerDrift}px)`);
            verify(isZoom || (group.visible && group.coachClear), label, 'all cards on-screen and clear of the coach');
            verify(group.minWidth >= 48 && group.minHeight >= 48, label, 'practical minimum 48px target');
            verify(group.tenFits, label, 'two-digit label fits its card');
            if (isMemory) {
              verify(group.artFit === 'contain' && group.artWidth / group.minWidth >= 0.83, label,
                'art fills the card safely with no crop or distortion');
            }
            if (device === 'phone' && isMemory && count === 10) {
              verify(group.minWidth >= 98 && group.rows[0] === 3, label, '10 cards use wide three-column layout');
            } else if (device === 'phone' && !isMemory && count === 7) {
              verify(group.minWidth >= 64 && group.rows.join(',') === '4,3' &&
                group.density >= 0.55 && group.tenFont >= 46,
                label, '7 values use wide, balanced rows with a closely fitting band');
            } else if (device === 'phone' && !isMemory && count === 10) {
              verify(group.minWidth >= 54 && group.tenFont >= 36, label, '10 values have 54px targets with a large 10');
            } else if (device.startsWith('tablet') && !isMemory && count === 10) {
              verify(group.tenFont >= 64, label, '10 scales up on both tablet orientations');
            }
          }
          const representative = count === (isMemory ? 10 : 7) || count === game.levels.at(-1);
          if (representative && !isZoom) {
            const play = !['small-phone', 'short-landscape'].includes(device);
            if (play && isMemory) await playPair(page, game, label);
            await page.screenshot({ path: join(output, `${device}-${game.route}-${count}.png`), animations: 'disabled' });
            if (play && !isMemory) await playPair(page, game, label);
          }
          if (isZoom) {
            const last = page.locator(game.card).last();
            await last.focus();
            const box = await last.boundingBox();
            verify(box.y >= 0 && box.y + box.height <= height, label, 'last card is reachable through vertical reflow');
          }
        }
      }
    } finally {
      await context.close();
    }
  }
  await writeFile(join(output, 'metrics.json'), JSON.stringify({ chromeIdentity, measures, failures }, null, 2));
  for (const failure of failures) console.error(failure);
  console.log(`Google Chrome ${browser.version()}: ${measures.length} cases, ${failures.length} failed assertions`);
  process.exitCode = failures.length ? 1 : 0;
} finally {
  await browser.close();
}
