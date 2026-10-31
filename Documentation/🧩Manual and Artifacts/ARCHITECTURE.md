# Architecture — TIME.SmithChart

← [Wiki home](../README.md)

## Files

| Path | Role |
|---|---|
| `smith_chart_clock.html` | The page the OS runs (desktop tile via `display.json`; the Clock window's Smith Chart tab, `OS.SMITH_CLOCK_PAGE` in `PODS/POD.THIN/OS/Clock/mount-clock/mount-clock.js`). One inline script: palette, wheels, grid, rulers, layers, panel. |
| `SmithChartClock/` | The same clock as a TypeScript module: `types.ts`, `math/`, `time/`, `colour/`, `scales/`, `render/` (one file per canvas layer), `readouts.ts`, `options.ts`, `SmithChartClock.ts` (canvas, clock source, frame loop), `index.ts` (public surface). Imported by nothing today. |
| `index.ts` | Barrel: `export * from './SmithChartClock'`. |
| `display.json` | OS launcher entry (`entry: smith_chart_clock.html`, `topic: APK.audio/Gui/Display/SmithChartClock`). |
| `package.json`, `tsconfig.json`, `test/smith.test.mjs` | `npm test`: strict tsc → `.test-build/` (CommonJS), then the RF maths tests and the page/module parity test. |

## The parity test

`test/smith.test.mjs` reads the page's `<script>` and runs it in a `node:vm` context whose
`document`/`window` are stubs that accept any call. The page's top-level `const`s then live in
that context's global scope, and the test compares `RADIAL_SCALES`, `formatScaleValue`,
`rhoFromSwr`/`swrFromRho`, `GRID_MAJOR`/`GRID_MINOR`, `HAND_MAGS` and `PLOT_PAIRS` with the
compiled module's exports.

## Checking

```sh
npm ci && npm test
```

## Relationship to TIME.clockFaces

This repo is the `Smith Chart/` submodule of TIME.clockFaces. The small `smith` face in
TIME.clockFaces (`src/smith.ts`) is its own code; it does not import this repo.
