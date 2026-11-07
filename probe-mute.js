// Focused probe: mute toggle + no console errors on the final build.
// Usage: node probe-mute.js
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
  await page.click('#startBtn');
  await page.waitForTimeout(400);
  console.log('state:', await page.evaluate(() => window.__game.state));
  await page.click('#muteBtn');
  await page.waitForTimeout(200);
  const muted = await page.evaluate(() => document.getElementById('muteBtn').textContent.includes('Muted'));
  console.log(muted ? 'PASS  mute button toggles label' : 'FAIL  mute button toggles label');
  await page.click('#muteBtn');
  await page.waitForTimeout(200);
  const unmuted = await page.evaluate(() => document.getElementById('muteBtn').textContent.includes('Sound'));
  console.log(unmuted ? 'PASS  mute toggles back' : 'FAIL  mute toggles back');
  await page.waitForTimeout(1000);
  console.log(errors.length === 0 ? 'PASS  no console/page errors' : 'FAIL  errors: ' + errors.join(' | '));
  await browser.close();
  console.log('PROBE DONE');
})().catch(e => { console.error('PROBE CRASH:', e.message.split('\n')[0]); process.exit(1); });
