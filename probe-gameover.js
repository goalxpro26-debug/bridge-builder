// Focused probe: game-over path (fall into gorge on last life) + retry.
// Usage: node probe-gameover.js
const { chromium } = require('/home/hatch/workspace/tools/pw-shot/node_modules/playwright-core');
const path = require('path');
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
  await page.goto('file://' + path.resolve(__dirname, 'index.html'), { waitUntil: 'load' });
  await page.waitForTimeout(500);
  // How-to-play overlay opens and closes.
  await page.click('#howBtn');
  await page.waitForTimeout(300);
  console.log(await page.evaluate(() => !document.getElementById('how').classList.contains('hidden')) ? 'PASS  how-to-play opens' : 'FAIL  how-to-play opens');
  await page.click('#howCloseBtn');
  await page.waitForTimeout(300);
  await page.click('#startBtn');
  await page.waitForTimeout(400);
  // Drop the player into the gorge away from the bridge lane on the last life.
  await page.evaluate(() => { window.__game.teleport(60, 340); });
  // Force last life via the exposed state: lives is a let-binding, so use
  // repeated falls instead — set up by reading lives and falling that many times.
  let state = '';
  for (let i = 0; i < 5; i++) {
    await page.waitForTimeout(20000); // stun is 1s of game time; at ~1.3 headless fps that is ~15s real
    state = await page.evaluate(() => window.__game.state);
    const lives = await page.evaluate(() => window.__game.lives);
    console.log(`fall check ${i + 1}: state=${state} lives=${lives}`);
    if (state === 'gameOver') break;
    // Still alive: walk back into the gorge off-lane for another fall.
    await page.evaluate(() => window.__game.teleport(60, 340));
  }
  console.log(state === 'gameOver' ? 'PASS  last fall -> game over' : 'FAIL  last fall -> game over (state=' + state + ')');
  await page.screenshot({ path: path.join(__dirname, 'test-gameover.png') });
  if (state === 'gameOver') {
    await page.click('#retryBtn');
    await page.waitForTimeout(400);
    const s2 = await page.evaluate(() => ({ state: window.__game.state, lives: window.__game.lives, level: window.__game.level }));
    console.log(s2.state === 'playing' && s2.lives === 3 ? 'PASS  retry restarts race with 3 lives' : 'FAIL  retry: ' + JSON.stringify(s2));
  }
  console.log(errors.length === 0 ? 'PASS  no console/page errors' : 'FAIL  errors: ' + errors.join(' | '));
  await browser.close();
  console.log('PROBE DONE');
})().catch(e => { console.error('PROBE CRASH:', e.message.split('\n')[0]); process.exit(1); });
