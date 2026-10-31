// test/smith.test.mjs — the Smith Chart Clock page's maths and tables.
//
// smith_chart_clock.html is the clock (its inline script is the one implementation; the
// SmithChartClock/ TypeScript port was retired, see README). This test runs that script in
// a node:vm sandbox whose document/window are stubs that accept any call, then checks the
// page's own top-level tables and formulas against the RF definitions.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

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
const close = (a, b, msg) => (a === b || Math.abs(a - b) < 1e-9 ? undefined : assert.fail(`${msg}: ${a} vs ${b}`));
const RHOS = [0, 0.05, 0.2, 0.5, 0.75, 0.9];

test('the page script runs headless', () => {
  assert.equal(page('typeof RADIAL_SCALES'), 'object');
});

test('SWR <-> |Γ|', () => {
  for (const r of RHOS) close(page(`swrFromRho(${r})`), (1 + r) / (1 - r), `swrFromRho(${r})`);
  for (const s of [1, 1.5, 2, 3, 10]) close(page(`rhoFromSwr(${s})`), (s - 1) / (s + 1), `rhoFromSwr(${s})`);
  assert.equal(page('swrFromRho(1)'), Infinity);
});

test('radially scaled parameter rulers', () => {
  const ids = JSON.parse(page('JSON.stringify(RADIAL_SCALES.map(s => s.id))'));
  assert.deepEqual(ids, ['swr', 'dbs', 'rtnLoss', 'rflCoeffE', 'rflCoeffP', 'atten', 'swLossCoeff', 'rflLoss', 'swPeak', 'transmP', 'transmE']);
  const at = (id, r) => page(`RADIAL_SCALES.find(s => s.id === '${id}').valueOf(${r})`);
  for (const r of RHOS.filter((x) => x > 0)) {
    close(at('swr', r), (1 + r) / (1 - r), `swr ${r}`);
    close(at('rtnLoss', r), -20 * Math.log10(r), `return loss ${r}`);
    close(at('rflCoeffP', r), r * r, `power coefficient ${r}`);
    close(at('transmP', r), 1 - r * r, `transmitted power ${r}`);
  }
  // every ruler is invertible where it is finite: rhoOf(valueOf(rho)) = rho
  const n = page('RADIAL_SCALES.length');
  for (let i = 0; i < n; i++) {
    for (const r of [0.2, 0.5, 0.75]) {
      const back = page(`(s => s.rhoOf(s.valueOf(${r})))(RADIAL_SCALES[${i}])`);
      close(back, r, `${page(`RADIAL_SCALES[${i}].id`)} rhoOf∘valueOf at ${r}`);
    }
  }
  assert.equal(page('formatScaleValue(Infinity, 2)'), '∞');
  assert.equal(page('formatScaleValue(1.23456, 3)'), '1.235');
});

test('chart grid: minors never repeat a major', () => {
  const major = JSON.parse(page('JSON.stringify(GRID_MAJOR)'));
  const minor = JSON.parse(page('JSON.stringify(GRID_MINOR)'));
  assert.ok(major.length && minor.length);
  assert.deepEqual(minor.filter((v) => major.includes(v)), []);
  assert.deepEqual(minor, [...minor].sort((a, b) => a - b));
});

test('hands and plot pairs', () => {
  const hands = JSON.parse(page('JSON.stringify(HAND_MAGS)'));
  for (const k of ['hour', 'minute', 'second']) assert.ok(hands[k] > 0 && hands[k] <= 1, `hand ${k}`);
  const pairs = JSON.parse(page('JSON.stringify(PLOT_PAIRS)'));
  for (const p of pairs) {
    assert.equal(p.id, `${p.a}+${p.b}`);
    assert.ok(p.a in hands && p.b in hands, `pair ${p.id} names known hands`);
  }
});
