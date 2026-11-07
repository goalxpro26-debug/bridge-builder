# Brick Bridge Race

An original HTML5 canvas game. Mechanics only *inspired by* the general idea of
collecting bricks in your colour and building a bridge while rivals knock you
over — no copied art, code, names, characters, or assets from Bridge Race or
any other game. Every title, character, piece of art, and sound is original.

## How to play

- **Move:** drag / hold mouse or finger, or use WASD / arrow keys.
- **Collect:** run over **blue bricks** to stack them on your head. A bigger
  stack makes you slower.
- **Build:** walk up the glowing bridge lane in the middle of the gorge. Each
  step lays one brick down as a plank.
- **Watch out:** rivals bump into you and scatter your stack. Run out of
  bricks mid-gorge — or let a rival reach the flag first — and you lose a
  heart (3 hearts per race).
- **Win a race:** reach the chequered flag at the top.
- **Goal:** win all **20 races**. Later races have more rivals (1 in Race 1,
  up to 4) and longer bridges (3 planks in Race 1, up to 10 in Race 20).

Other features: start menu with how-to-play, pause (button / `P` / `Esc`),
mute (button / `M`), score with time + spare-brick bonuses, level-complete,
game-over/retry, and a champion screen after Race 20.

## Tech

- Single self-contained `index.html` — plain HTML5 + vanilla JS + Canvas.
  No engine, no external assets, no network needed.
- All art is drawn procedurally on canvas (racers, bricks, gorge, flag).
- All audio is synthesized with WebAudio (pickup/place/knock/fall/win/lose
  SFX + an original 8-note music loop). No copyrighted music.
- Portrait-friendly (480×720 logical canvas, scales to fit), works with
  touch and mouse on desktop and mobile.

## How to run

Open `index.html` in any modern browser (double-click it, or serve the
folder, e.g. `python3 -m http.server` and visit the page). No build step.

## Files

- `index.html` — the whole game.
- `test-a.js` / `test-b.js` — headless Playwright tests (real mouse
  clicks/drags + keyboard). `probe-mute.js` / `probe-gameover.js` — focused
  probes for mute and the game-over path.
- `test-results.txt` — combined output of the last test runs (per-run files
  `test-results-a.txt` / `test-results-b.txt` kept alongside).
- `test-*.png` — screenshots captured during the tests.

## Test results

Headless Chromium (Playwright) with real mouse clicks, drags and keyboard,
against the final build. All checks passed; full output in
`test-results.txt`.

- **Load/start:** page loads, start menu renders, no console/page errors;
  real click on START starts Race 1 with 3 lives, bridge needs 3 bricks.
- **Core action:** real mouse drags collect blue bricks until the stack
  reaches the required 3 (stack 0 → 3 observed).
- **Keyboard:** ArrowUp moves the player (y 650 → 635 in the slow headless
  run — see environment note).
- **Pause/mute:** pause button pauses, Resume returns to play; mute toggles
  the label both ways.
- **Bridge + level advance:** dragging up the bridge lane lays all 3 planks
  and reaching the flag completes the race; NEXT RACE starts Race 2.
- **Knock mechanic:** a rival placed next to the player scatters the whole
  stack (stack 2 → 0, lives unchanged).
- **Difficulty scaling (config-verified):** Race 1 = 3 bricks / 1 rival;
  Race 20 = 10 bricks / 4 rivals, gorge 240px.
- **Game over:** repeated falls into the gorge cost lives 3 → 2 → 1 → 0 and
  show the game-over screen; Retry restarts the race with 3 lives.
- **How-to-play:** overlay opens and closes.

Honest test notes (what the runs did NOT do):
- In test B the stack was set and the player lined up on the bridge lane
  via the `window.__game` debug hook, and rivals were frozen for the
  crossing check — the plank-laying, crossing and win logic themselves ran
  for real under a mouse drag. The knock check ran with live rivals.
- Winning all 20 races end-to-end (and the champion screen) was NOT played
  through headlessly; level advance and the Race 20 config were verified
  instead. No untested claim is made about it.
- Environment: this VM was heavily loaded during testing (load ~31 on 4
  cores); headless SwiftShader ran the game at ~1.3 fps, so the in-game
  clock ran ~15× slower than real time and runs took minutes. The browser
  process died 3 times mid-run from that pressure (never with a page error);
  the affected runs were re-run to green. No console or page errors were
  recorded in any run.

Headless test notes: the Chromium on this machine needs the Hatch WebGL
policy flags (`--hatch-webgl-allowed-domains-file` /
`--hatch-webgl-allowed-domains-sha256`) at launch — see `test.js`. The game
itself uses 2D canvas only, no WebGL.
