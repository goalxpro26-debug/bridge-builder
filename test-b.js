// Headless test B — bridge crossing, level advance, next race.
// Usage: node test-b.js
// Setup shortcut: the stack is set via the debug hook (__game.player.stack)
// so the run stays short; the bridge-laying, crossing and win logic are then
// driven for real by a mouse drag up the bridge lane.
const { chromium } = require('/home/hatch/workspace/tools/pw-shot/node_modules/playwright-core');
const fs = require('fs');
const path = require('path');

const RESULTS = path.join(__dirname, 'test-results-b.txt');
const results = [];
const check = (name, ok, extra) => {
  const line = `${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`;
  results.push(line); console.log(line);
  fs.writeFileSync(RESULTS, results.join('\n') + '\n');
};

(async () => {
  const errors = [];
  const browser = await chromium.launch({
    executablePath: '/opt/meta-chromium/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files', '--use-angle=swiftshader',
      '--hatch-webgl-allowed-domains-file=/home/hatch/workspace/tools/pw-shot/webgl-policy.txt',
      '--hatch-webgl-allowed-domains-sha256=dc8a0e5eec744f6590a4c1889139c00568ffedc3eced6d0a1a5127e35f9ccd16'],
  });
  const page = await browser.newPage({ viewport: { width: 360, height: 600 } });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text().slice(0, 200)); });
  page.on('crash', () => errors.push('PAGE CRASHED'));

  await page.goto('file://' + path.resolve(__dirname, 'index.html'), { waitUntil: 'load' });
  await page.waitForTimeout(600);
  await page.click('#startBtn');
  await page.waitForTimeout(400);
  check('click START -> playing', await page.evaluate(() => window.__game.state === 'playing'));

  // Setup: give the player a full stack via the debug hook (test setup only).
  await page.evaluate(() => { window.__game.player.stack = window.__game.need; });
  check('setup: full stack', await page.evaluate(() => window.__game.player.stack) === await page.evaluate(() => window.__game.need));

  const toScreen = async (gx, gy) => page.evaluate(([gx, gy]) => {
    const r = document.querySelector('canvas').getBoundingClientRect();
    return { x: r.left + gx * (r.width / 480), y: r.top + gy * (r.height / 720) };
  }, [gx, gy]);

  // Difficulty scaling is verified from the level config (no 20-race playthrough needed).
  const scaling = await page.evaluate(() => ({
    l1need: window.__game.configFor(1).need, l1rivals: window.__game.configFor(1).rivals,
    l20need: window.__game.configFor(20).need, l20rivals: window.__game.configFor(20).rivals,
    l20gap: window.__game.configFor(20).gapH,
  }));
  check('difficulty scales: L1 need 3 / 1 rival -> L20 need 10 / 4 rivals',
    scaling.l1need === 3 && scaling.l1rivals === 1 && scaling.l20need === 10 && scaling.l20rivals === 4,
    JSON.stringify(scaling));

  // Freeze rivals for the crossing check (test setup): a rival knock
  // mid-climb would scatter the stack and make the bridge check flaky.
  // The knock mechanic itself is verified separately below.
  await page.evaluate(() => window.__game.rivals.forEach(r => { r.speed = 0; }));
  // Line the player up on the bridge lane first (teleport = test setup),
  // then a real mouse drag straight up the lane to the flag.
  const lane = await page.evaluate(() => ({ bx: window.__game.bridgeX, top: window.__game.gapTop }));
  await page.evaluate((bx) => window.__game.teleport(bx, 400), lane.bx);
  await page.waitForTimeout(300);
  const start = await page.evaluate(() => ({ x: window.__game.player.x, y: window.__game.player.y }));
  const s0 = await toScreen(start.x, start.y);
  const s1 = await toScreen(lane.bx, 40);
  await page.mouse.move(s0.x, s0.y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(s0.x + (s1.x - s0.x) * i / 10, s0.y + (s1.y - s0.y) * i / 10);
    await page.waitForTimeout(60);
  }
  let won = false;
  const deadline = Date.now() + 60000; // generous: headless SwiftShader runs the game clock slowly under load
  while (Date.now() < deadline) {
    await page.mouse.move(s1.x, s1.y);
    if (await page.evaluate(() => window.__game.state === 'levelDone')) { won = true; break; }
    await page.waitForTimeout(500);
  }
  await page.mouse.up();
  const planks = await page.evaluate(() => window.__game.planks.length);
  check('drag up bridge lane lays planks', planks >= 3, `planks=${planks}`);
  check('reach flag -> level complete', won, 'state=' + await page.evaluate(() => window.__game.state));
  await page.screenshot({ path: path.join(__dirname, 'test-leveldone.png') });

  if (won) {
    await page.click('#nextBtn');
    await page.waitForTimeout(400);
    check('NEXT RACE -> level 2 playing', await page.evaluate(() => window.__game.state === 'playing' && window.__game.level === 2));
    const need2 = await page.evaluate(() => window.__game.need);
    check('level 2 config loaded', need2 === 3, 'need L2=' + need2);
    await page.screenshot({ path: path.join(__dirname, 'test-level2.png') });

    // Knock mechanic (real gameplay): give the player bricks, put a rival
    // right next to them, and verify the stack scatters.
    await page.evaluate(() => {
      window.__game.player.stack = 2;
      window.__game.teleport(240, 600);
      const r = window.__game.rivals[0];
      r.x = 250; r.y = 600; r.speed = 90;
    });
    await page.waitForTimeout(1200);
    const knock = await page.evaluate(() => ({ stack: window.__game.player.stack, lives: window.__game.lives, state: window.__game.state }));
    check('rival knock scatters the stack', knock.stack === 0 && knock.lives === 3 && knock.state === 'playing',
      JSON.stringify(knock));
  }

  check('no console/page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  console.log('TEST B DONE');
  if (results.some(r => r.startsWith('FAIL'))) process.exitCode = 1;
})().catch(e => { console.error('TEST B CRASH:', e.message.split('\n')[0]); process.exit(1); });
