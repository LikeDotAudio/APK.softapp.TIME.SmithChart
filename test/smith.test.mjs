// test/smith.test.mjs — the Smith Chart Clock's math, and the page/module contract.
//
// The page the OS frames (smith_chart_clock.html) carries its own inline script;
// SmithChartClock/ is the same clock as a TypeScript module. Until one of them is
// retired (see Documentation/🛣Roadmap/IMPROVEMENTS.md) this test is what keeps them
// from drifting: it runs the page's script in a sandbox with a stub DOM and checks
// that every table and formula both of them carry gives the same answer.
// `npm test` compiles the module to .test-build/ first (`pretest`).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);
const ts = require(join(root, '.test-build/index.js'));
const metrics = require(join(root, '.test-build/SmithChartClock/math/metrics.js'));
const complex = require(join(root, '.test-build/SmithChartClock/math/complex.js'));
const grid = require(join(root, '.test-build/SmithChartClock/render/grid.js'));

function stub() {
  const f = function () {};
  return new Proxy(f, {
    get: (_t, k) => (k === Symbol.toPrimitive ? () => 10 : k === 'then' ? undefined : stub()),
    apply: () => stub(), construct: () => stub(), set: () => true,
  });
}
function loadPage() {
  const html = readFileSync(join(root, 'smith_chart_clock.html'), 'utf8');
  const code = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n');
  const ctx = vm.createContext({
    document: stub(), window: stub(), localStorage: stub(), navigator: stub(),
    requestAnimationFrame: () => 0, cancelAnimationFrame() {}, setInterval: () => 0, setTimeout: () => 0,
    clearInterval() {}, clearTimeout() {}, ResizeObserver: function () { return stub(); },
    getComputedStyle: () => stub(), devicePixelRatio: 1, innerWidth: 800, innerHeight: 600,
    console: { log() {}, warn() {}, error() {} }, performance,
  });
  vm.runInContext(code, ctx, { timeout: 5000 });
  return (expr) => vm.runInContext(expr, ctx);
}
const page = loadPage();
const RHOS = [0, 0.05, 0.2, 0.5, 0.75, 0.9, 0.99];
const close = (a, b, msg) => (a === b || Math.abs(a - b) < 1e-9 ? undefined : assert.fail(`${msg}: ${a} vs ${b}`));

test('impedance math', () => {
  const g = complex.normalizedImpedanceToGamma({ re: 1, im: 0 });
  close(g.re, 0, 'z=1 matches'); close(g.im, 0, 'z=1 matches');
  const z = complex.gammaToNormalizedImpedance({ re: 0.2, im: -0.3 });
  const back = complex.normalizedImpedanceToGamma(z);
  close(back.re, 0.2, 'round trip re'); close(back.im, -0.3, 'round trip im');
  close(metrics.swrFromRho(0.5), 3, 'SWR at |Γ|=0.5');
  close(metrics.rhoFromSwr(3), 0.5, '|Γ| at SWR 3');
  assert.equal(metrics.swrFromRho(1), Infinity);
});

test('page and module: SWR <-> |Γ|', () => {
  for (const r of RHOS) close(page(`swrFromRho(${r})`), metrics.swrFromRho(r), `swrFromRho(${r})`);
  for (const s of [1, 1.5, 2, 3, 10]) close(page(`rhoFromSwr(${s})`), metrics.rhoFromSwr(s), `rhoFromSwr(${s})`);
});

test('page and module: the radially scaled parameter rulers', () => {
  const p = JSON.parse(page('JSON.stringify(RADIAL_SCALES.map(s => ({ id: s.id, row: s.row, side: s.side, label: s.label, precision: s.precision, ticks: s.ticks.map(String) })))'));
  const m = ts.RADIAL_SCALES.map((s) => ({ id: s.id, row: s.row, side: s.side, label: s.label, precision: s.precision, ticks: s.ticks.map(String) }));
  assert.deepEqual(p, m);
  for (const [i, s] of ts.RADIAL_SCALES.entries()) {
    for (const r of RHOS) close(page(`RADIAL_SCALES[${i}].valueOf(${r})`), s.valueOf(r), `${s.id}.valueOf(${r})`);
  }
  for (const v of [0, 1, 1.23456, 2.5, Infinity]) assert.equal(page(`formatScaleValue(${v}, 3)`), ts.formatScaleValue(v, 3));
});

test('page and module: chart grid, hands and plot pairs', () => {
  assert.deepEqual(JSON.parse(page('JSON.stringify(GRID_MAJOR)')), grid.GRID_MAJOR);
  assert.deepEqual(JSON.parse(page('JSON.stringify(GRID_MINOR)')), grid.GRID_MINOR);
  const pageHands = JSON.parse(page('JSON.stringify(HAND_MAGS)'));
  for (const [k, v] of Object.entries(ts.HAND_MAGNITUDES)) close(pageHands[k], v, `hand ${k}`);
  const pick = (l) => l.map(({ id, label, a, b }) => ({ id, label, a, b }));
  assert.deepEqual(pick(JSON.parse(page('JSON.stringify(PLOT_PAIRS)'))), pick(ts.PLOT_PAIRS));
});
