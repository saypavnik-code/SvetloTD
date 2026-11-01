// Browser smoke test of the BUILT game (v0.27.0): headless Chromium, no display needed. It is not one of the gates.
//
//   npm run build                                     (the game, into dist/)
//   (cd scripts/browser_smoke && npm ci)              (once: puppeteer-core and a bundled Chromium, ~110 MB, ignored by git)
//   node scripts/browser_smoke/smoke.mjs              all scenarios      (run from the repository root)
//   node scripts/browser_smoke/smoke.mjs cycle full   chosen scenarios
//   node scripts/browser_smoke/smoke.mjs --shots out  also save screenshots into the folder `out`
//
// Every scenario fails on any console error, page error, failed request or HTTP status >= 400, and on its own expectations.
// The scenes are driven through `window.game` and a few private fields (`_economy`, `_waveManager`, `_buildSystem`, `_gameOver`,
// `_tutorialActive`): when a scene is renamed, change them here. While a scenario simulates, drawing is switched off (the software
// renderer of a headless browser runs the game at 4 frames per second, simulation alone at 57); screenshots switch it back on.
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

const DIST = resolve(process.env.SMOKE_DIST ?? 'dist');   // SMOKE_DIST: test another build, e.g. to prove the smoke catches a known bug
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const args = process.argv.slice(2);
const shotsAt = args.includes('--shots') ? args[args.indexOf('--shots') + 1] : null;
const names = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--shots');

function serve() {
  const server = createServer((req, res) => {
    const file = normalize(join(DIST, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
    const target = file.endsWith(sep) ? join(file, 'index.html') : file;
    if (!target.startsWith(DIST) || !existsSync(target)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[extname(target)] ?? 'application/octet-stream' });
    res.end(readFileSync(target));
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok({ server, base: `http://127.0.0.1:${server.address().port}/` })));
}

async function session(base, query) {
  const problems = [];
  const browser = await puppeteer.launch({
    executablePath: await chromium.executablePath(), headless: 'shell',
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'], defaultViewport: { width: 1280, height: 720 },
  });
  const page = await browser.newPage();
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) problems.push(`console.${m.type()}: ${m.text().slice(0, 240)}`); });
  page.on('pageerror', (e) => problems.push(`page error: ${String(e.stack ?? e).slice(0, 400)}`));
  page.on('requestfailed', (r) => problems.push(`request failed: ${r.url()}`));
  page.on('response', (r) => { if (r.status() >= 400) problems.push(`HTTP ${r.status()}: ${r.url()}`); });
  await page.goto(base + query, { waitUntil: 'load' });
  // How many times GameScene.create ran: a restart is another run of the same scene object (scene events and fields do not tell runs apart).
  await page.evaluate(() => { window.__runs = 0; const g = window.game.scene.getScene('GameScene'); const create = g.create; g.create = function (...a) { window.__runs++; return create.apply(this, a); }; });
  const api = {
    page, problems,
    until: async (fn, ms, step = 500) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await page.evaluate(fn)) return true; await sleep(step); } return false; },
    game: (fn) => page.evaluate(`(() => { const g = window.game.scene.getScene('GameScene'); return (${fn})(g); })()`),
    scenes: () => page.evaluate(() => window.game.scene.getScenes(true).map((s) => s.scene.key)),
    draw: (on) => page.evaluate((on) => { const r = window.game.renderer; if (!window.__draw) window.__draw = r.render.bind(r); r.render = on ? window.__draw : () => {}; }, on),
    shot: async (name) => { if (!shotsAt) return; mkdirSync(shotsAt, { recursive: true }); await api.draw(true); await sleep(1500); await page.screenshot({ path: join(shotsAt, `${name}.png`) }); await api.draw(false); },
    runId: () => page.evaluate(() => window.__runs),
    snap: () => api.game('(g) => ({ lives: g._economy.lives, gold: g._economy.gold, idx: g._waveManager._waveIndex, state: g._waveManager.state, over: g._gameOver, towers: g._buildSystem.towers.map((t) => [t.towerId, t.gridCol, t.gridRow, t.ownerSeat]) })'),
    // Menu -> Play -> tutorial closed. A scene object outlives its run, so wait for a fresh, running game rather than for the fields.
    start: async () => {
      await api.until(() => { const m = window.game.scene.getScene('MenuScene'); return Boolean(m && m.scene.isActive() && m.children.list.some((o) => o.type === 'Zone' && o.input && o.input.enabled)); }, 60000, 1000);
      await page.evaluate(() => window.game.scene.getScene('MenuScene').children.list.filter((o) => o.type === 'Zone' && o.input && o.input.enabled).sort((a, b) => b.y - a.y)[0].emit('pointerdown'));
      await api.until(() => { const g = window.game.scene.getScene('GameScene'); return window.game.scene.isActive('GameScene') && Boolean(g._waveManager) && !g._gameOver; }, 90000, 1000);
      await sleep(2500);
      for (let i = 0; i < 4 && (await api.game('(g) => g._tutorialActive')); i++) { await page.mouse.click(640, 434); await sleep(1500); }
      await api.draw(false);
      await page.evaluate(() => window.GameSpeed.set(3));
    },
    startWave: () => page.mouse.click(1198, 694),
    toOver: async (ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const s = await api.snap(); if (s.over) return s; if (s.state === 'countdown') await api.startWave(); await sleep(400); } return api.snap(); },
    close: () => browser.close(),
  };
  return api;
}

const KEYS = { arrow: '1', cannon: '2', magic: '3', slow: '4', acid: '5', watchtower: '6' };
const center = (c, r) => [c * 40 + 20, r * 40 + 20];
async function place(s, family, c, r) { await s.page.keyboard.press(KEYS[family]); await sleep(80); await s.page.mouse.click(...center(c, r)); await sleep(150); }

const SCENARIOS = {
  // Menu, a game, two towers, the first wave kills something.
  async basic(s, check) {
    await s.start();
    await place(s, 'arrow', 4, 3); await place(s, 'arrow', 6, 3);
    const built = await s.snap();
    check(built.towers.length === 2 && built.gold < 300, `two towers stand and cost gold (towers ${built.towers.length}, gold ${built.gold})`);
    await s.shot('basic_built');
    await s.startWave(); await sleep(25000);
    const after = await s.snap();
    check(after.gold > built.gold && after.lives === 25, `the first wave pays bounties and costs no life (gold ${built.gold} to ${after.gold}, lives ${after.lives})`);
    await s.shot('basic_wave');
  },
  // Defeat, retry, defeat, back to the menu, play again: the game over flow and the second run of every scene.
  async cycle(s, check) {
    await s.start();
    check((await s.runId()) === 1, 'the first game is run 1');
    const first = await s.toOver(120000);
    check(first.over, 'a one-life game without towers ends in a defeat');
    await sleep(3000);                                               // the modal fades in on game time: let it finish before the click
    await s.shot('cycle_defeat');
    await s.page.mouse.click(566, 519);                              // "Играть снова" (input does not need drawing)
    check(await s.until(() => window.__runs >= 2, 60000, 500) && (await s.runId()) === 2, 'retry starts run 2');
    await sleep(2500);
    for (let i = 0; i < 4 && (await s.game('(g) => g._tutorialActive')); i++) { await s.page.mouse.click(640, 434); await sleep(1500); }
    const second = await s.toOver(120000);
    check(second.over, 'the second run ends in a defeat as well');
    await sleep(3000);
    await s.page.mouse.click(712, 519);                              // "В меню"
    check(await s.until(() => window.game.scene.isActive('MenuScene'), 60000, 1000), 'the menu comes back after a defeat');
    await s.start();
    const third = await s.snap();
    check(!third.over && third.lives === 1 && third.state === 'countdown' && (await s.runId()) === 3, 'a game started from the second menu is a third, fresh run');
  },
  // Four seats: one tower per seat (Z X C V pick the seat), then waves until the shared lives are gone.
  async seats(s, check) {
    await s.start();
    for (const [key, spot] of [['z', [4, 3]], ['x', [13, 3]], ['c', [13, 14]], ['v', [4, 14]]]) { await s.page.keyboard.press(key); await sleep(150); await place(s, 'arrow', ...spot); }
    const built = await s.snap();
    check(built.towers.length === 4 && new Set(built.towers.map((t) => t[3])).size === 4, `one tower per seat (owners ${built.towers.map((t) => t[3]).join(',')})`);
    await s.shot('seats_built');
    const end = await s.toOver(120000);
    check(end.over || end.idx >= 4, `a four-seat game plays on (wave ${end.idx + 1}, lives ${end.lives}${end.over ? ', ended' : ''})`);
    await s.shot('seats_end');
  },
  // Expert: one life, the seeded shuffle of the waves.
  async expert(s, check) {
    await s.start();
    check((await s.game('(g) => g._waveSeed')) === 5, 'the seed of the URL is the seed of the shuffle');
    const end = await s.toOver(150000);
    check(end.over, 'an expert game without towers ends in a defeat');
  },
  // A whole game with the best catalogued opening of the simulation (docs/SEAT_REPORT.md), through the real keyboard and mouse.
  async full(s, check) {
    const { BUILDS, simulate, game } = await import(resolve('tests/support/simulate.mjs'));
    const rules = BUILDS.magic_slow;
    const cells = simulate({ build: 'magic_slow', seats: 1, placement: 'zones', extraGold: 20000, maxWave: 1 }).towerCells.map((c) => [c.col, c.row]);
    const cost = Object.fromEntries(Object.entries(game.TOWER_DEFS).map(([id, def]) => [id, def.cost]));
    const next = (st) => {
      for (const r of rules) {
        if (r.kind === 'place') {
          const have = st.towers.filter((t) => t[0].startsWith(`${r.family}_`)).length;
          const cell = cells.find(([c, rw]) => !st.towers.some((t) => t[1] === c && t[2] === rw));
          if (have < r.max && cell) return { place: [r.family, cell], price: cost[r.id] };
        } else {
          const tower = st.towers.find((t) => t[0] === `${r.family}_t1`);
          if (tower) return { upgrade: tower, price: cost[`${r.family}_t2`] };
        }
      }
      return null;
    };
    await s.start();
    let st = await s.snap(), last = -1, deepest = 0;
    const t0 = Date.now();
    while (!st.over && Date.now() - t0 < 900000) {
      if (st.state === 'countdown') {
        for (let i = 0; i < 40; i++) {
          st = await s.snap(); const a = next(st);
          if (!a || st.gold < a.price) break;
          if (a.place) await place(s, a.place[0], ...a.place[1]);
          else { await s.page.mouse.click(...center(a.upgrade[1], a.upgrade[2])); await sleep(120); await s.page.keyboard.press('u'); await sleep(120); }
        }
        await s.startWave(); await sleep(300);
      }
      if (Math.random() < 0.3) { await s.page.keyboard.press('q'); await s.page.keyboard.press('w'); }
      await sleep(350);
      st = await s.snap();
      deepest = Math.max(deepest, st.idx + 1);
      if (st.idx !== last) { last = st.idx; if ([10, 20, 30, 39].includes(st.idx + 1)) await s.shot(`full_wave${st.idx + 1}`); }
    }
    check(st.over && deepest >= 30, `the game was played to wave ${deepest} (the simulation says a defeat in wave 40; bar: at least wave 30)`);
    await s.shot('full_end');
  },
};
const QUERY = { basic: '?difficulty=normal', cycle: '?difficulty=hard', seats: '?seats=4&difficulty=normal', expert: '?difficulty=insane&seed=5', full: '?difficulty=normal' };

const { server, base } = await serve();
let failed = 0;
for (const name of names.length ? names : Object.keys(SCENARIOS)) {
  if (!SCENARIOS[name]) { console.log(`unknown scenario ${name}; known: ${Object.keys(SCENARIOS).join(', ')}`); failed++; continue; }
  const s = await session(base, QUERY[name]);
  const results = [];
  const check = (ok, text) => { results.push([ok, text]); };
  const t0 = Date.now();
  try { await SCENARIOS[name](s, check); } catch (e) { results.push([false, `scenario threw: ${String(e.stack ?? e).slice(0, 400)}`]); }
  check(s.problems.length === 0, s.problems.length === 0 ? 'no console error, page error, failed request or HTTP error' : `${s.problems.length} problem(s): ${s.problems.slice(0, 3).join(' | ')}`);
  await s.close();
  const bad = results.filter(([ok]) => !ok).length;
  failed += bad ? 1 : 0;
  console.log(`${bad ? 'FAIL' : 'PASS'} ${name} (${Math.round((Date.now() - t0) / 1000)}s)`);
  for (const [ok, text] of results) console.log(`   ${ok ? 'ok  ' : 'FAIL'} ${text}`);
}
server.close();
process.exit(failed ? 1 : 0);
