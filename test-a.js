// Headless test A — load, start, collect, keyboard, pause, mute.
// Usage: node test-a.js
const { chromium } = require('/home/hatch/workspace/tools/pw-shot/node_modules/playwright-core');
const fs = require('fs');
const path = require('path');

const RESULTS = path.join(__dirname, 'test-results-a.txt');
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
  const page = await browser.newPage({ viewport: { width: 480, height: 800 } });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text().slice(0, 200)); });
  page.on('crash', () => errors.push('PAGE CRASHED'));

  await page.goto('file://' + path.resolve(__dirname, 'index.html'), { waitUntil: 'load' });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(__dirname, 'test-menu.png') });
  check('page loads, menu state', await page.evaluate(() => window.__game && window.__game.state === 'menu'));

  await page.click('#startBtn');
  await page.waitForTimeout(400);
  check('click START -> playing', await page.evaluate(() => window.__game.state === 'playing'));
  check('level 1, 3 lives, need=3', await page.evaluate(() => window.__game.level === 1 && window.__game.lives === 3 && window.__game.need === 3));

  const toScreen = async (gx, gy) => page.evaluate(([gx, gy]) => {
    const r = document.querySelector('canvas').getBoundingClientRect();
    return { x: r.left + gx * (r.width / 480), y: r.top + gy * (r.height / 720) };
  }, [gx, gy]);
  const dragTo = async (gx, gy, condFn, timeoutMs) => {
    const start = await page.evaluate(() => ({ x: window.__game.player.x, y: window.__game.player.y }));
    const s0 = await toScreen(start.x, start.y);
    const s1 = await toScreen(gx, gy);
    await page.mouse.move(s0.x, s0.y);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) {
      await page.mouse.move(s0.x + (s1.x - s0.x) * i / 8, s0.y + (s1.y - s0.y) * i / 8);
      await page.waitForTimeout(40);
    }
    const deadline = Date.now() + (timeoutMs || 5000);
    let ok = false;
    while (Date.now() < deadline) {
      if (await condFn()) { ok = true; break; }
      await page.waitForTimeout(150);
    }
    await page.mouse.up();
    return ok;
  };

  for (let attempt = 0; attempt < 8; attempt++) {
    const stack = await page.evaluate(() => window.__game.player.stack);
    const need = await page.evaluate(() => window.__game.need);
    if (stack >= need) break;
    const brick = await page.evaluate(() => {
      const p = window.__game.player;
      let best = null, bd = 1e9;
      for (const b of window.__game.bricks) {
        if (b.color !== 'blue') continue;
        const d = Math.hypot(b.x - p.x, b.y - p.y);
        if (d < bd) { bd = d; best = { x: b.x, y: b.y }; }
      }
      return best;
    });
    if (!brick) break;
    const before = await page.evaluate(() => window.__game.player.stack);
    await dragTo(brick.x, brick.y, async () => (await page.evaluate(() => window.__game.player.stack)) > before, 5000);
  }
  const stackNow = await page.evaluate(() => window.__game.player.stack);
  check('core action: mouse-drag collects blue bricks to need', stackNow >= 3, `stack=${stackNow} need=3`);
  await page.screenshot({ path: path.join(__dirname, 'test-gameplay.png') });

  // Keyboard test from a clear spot (rivals wander, so teleport first).
  await page.evaluate(() => window.__game.teleport(240, 650));
  await page.waitForTimeout(300);
  const yBefore = await page.evaluate(() => window.__game.player.y);
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(1500);
  await page.keyboard.up('ArrowUp');
  const yAfter = await page.evaluate(() => window.__game.player.y);
  check('keyboard ArrowUp moves player', yAfter < yBefore, `y ${Math.round(yBefore)} -> ${Math.round(yAfter)}`);

  await page.click('#pauseBtn');
  await page.waitForTimeout(300);
  check('pause button -> paused', await page.evaluate(() => window.__game.state === 'paused'));
  await page.click('#resumeBtn');
  await page.waitForTimeout(300);
  check('resume -> playing', await page.evaluate(() => window.__game.state === 'playing'));

  await page.click('#muteBtn');
  await page.waitForTimeout(200);
  check('mute button toggles label', await page.evaluate(() => document.getElementById('muteBtn').textContent.includes('Muted')));

  check('no console/page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  console.log('TEST A DONE');
  if (results.some(r => r.startsWith('FAIL'))) process.exitCode = 1;
})().catch(e => { console.error('TEST A CRASH:', e.message.split('\n')[0]); process.exit(1); });
