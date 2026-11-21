import assert from 'node:assert/strict';

const url = new URL(process.argv[2]);
assert(['http:', 'https:'].includes(url.protocol) && ['localhost', '127.0.0.1'].includes(url.hostname),
  'Run against an isolated loopback build.');
const { chromium, devices } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: 'chrome' });

function finger(cdp, type, point) {
  return cdp.send('Input.dispatchTouchEvent', { type, touchPoints: point ? [{ ...point, id: 1 }] : [] });
}

async function stroke(cdp, from, to, beforeLift) {
  await finger(cdp, 'touchStart', from);
  for (let i = 1; i <= 6; i++) {
    await finger(cdp, 'touchMove', {
      x: from.x + (to.x - from.x) * i / 6,
      y: from.y + (to.y - from.y) * i / 6,
    });
  }
  if (beforeLift) await beforeLift();
  await finger(cdp, 'touchEnd');
}

async function checkSwipes(page, cdp, area) {
  const box = await page.locator(area).boundingBox();
  assert(box, `Missing ${area}`);
  const points = [0.25, 0.75].map(frac => ({ x: box.x + frac * box.width, y: box.y + 4 }));
  const geometry = () => page.evaluate(() => ({
    route: location.hash, root: scrollX, visual: visualViewport.pageLeft,
    overflow: document.scrollingElement.scrollWidth - document.documentElement.clientWidth,
    page: document.querySelector('.page').getBoundingClientRect().left,
    inner: document.querySelector('.pair-playfield')?.scrollLeft ?? 0,
  }));
  const start = await geometry();
  assert.equal(start.overflow, 0, `Horizontal overflow on ${start.route}`);
  for (const [from, to] of [points, [...points].reverse()]) {
    await stroke(cdp, from, to, async () => assert.deepEqual(await geometry(), start));
    assert.deepEqual(await geometry(), start);
    assert.equal(await page.evaluate(() => window.lastTouchPointer), 'pointerup',
      `${start.route} ${area}: Chrome took over the horizontal gesture`);
  }
}

async function center(locator) {
  const box = await locator.boundingBox();
  assert(box, `Missing ${locator}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function placePiece(page, cdp, game) {
  const puzzle = game === 'puzzle';
  const item = page.locator(puzzle ? '.puzzle-piece' : '.draggable-chip').first();
  await item.waitFor();
  let target;
  if (puzzle) {
    const image = item.locator('image');
    const x = await image.getAttribute('x');
    const y = await image.getAttribute('y');
    target = page.locator('.puzzle-slot').filter({ has: page.locator(`image[x="${x}"][y="${y}"]`) });
  } else {
    // First-round sorting matches the item's colour, not its shape or DOM order.
    const [, color] = (await item.locator('svg').getAttribute('data-art-id')).split('-');
    target = page.locator('.sort-zone').filter({ has: page.locator(`[data-art-id^="shape-${color}-"]`) });
  }
  await stroke(cdp, await center(item), await center(target), async () => {
    assert.match(await item.getAttribute('class'), /\bis-dragging\b/);
  });
  assert.match(await item.getAttribute('class'), /\bis-placed\b/);
}

try {
  console.log(`Google Chrome ${browser.version()}`);
  for (const model of ['Pixel 7', 'Pixel 7 landscape', 'iPad Pro 11', 'iPad Pro 11 landscape']) {
    const page = await browser.newPage({ ...devices[model], serviceWorkers: 'block' });
    page.setDefaultTimeout(5000);
    const cdp = await page.context().newCDPSession(page);
    await page.addInitScript(() => {
      for (const type of ['pointerdown', 'pointerup', 'pointercancel']) {
        addEventListener(type, e => {
          if (e.isTrusted && e.pointerType === 'touch') window.lastTouchPointer = type;
        }, true);
      }
    });
    await page.goto(url.href);
    await page.locator('.home-welcome').waitFor();
    await checkSwipes(page, cdp, '.home-welcome');
    const games = await page.locator('.portal-grid__item').evaluateAll(items => items.map(i => i.dataset.domain));
    assert(games.includes('puzzle') && games.includes('sorting'));
    for (const game of games) {
      await page.locator(`[data-domain="${game}"] button`).tap();
      await page.waitForURL(`**/#/games/${game}`);
      await page.locator('.game-stage').waitFor();
      await checkSwipes(page, cdp, '.game-top-rail');
      await checkSwipes(page, cdp, await page.locator('.pair-playfield').count() ? '.pair-playfield' : '.game-stage');
      if (game === 'sorting' || game === 'puzzle') await placePiece(page, cdp, game);
      await page.locator('.rail-button--home').tap();
      await page.waitForURL('**/#/');
    }
    await finger(cdp, 'touchStart', await center(page.locator('.floating-gear')));
    await page.locator('.caregiver-page').waitFor();
    await finger(cdp, 'touchEnd');
    const { width, height } = page.viewportSize();
    await stroke(cdp, { x: width / 2, y: height * 0.75 }, { x: width / 2, y: height * 0.25 });
    await page.waitForFunction(() => document.querySelector('.caregiver-page').scrollTop > 0);
    await page.close();
    console.log(`${model}: Home, ${games.join(', ')}, both drops and vertical caregiver scroll passed`);
  }
} finally {
  await browser.close();
}
