# Architecture — TIME.SmithChart

← [Wiki home](../README.md)

## Files

| Path | Role |
|---|---|
| `smith_chart_clock.html` | The clock, and its only implementation. The OS runs it (desktop tile via `display.json`; the Clock window's Smith Chart tab, `OS.SMITH_CLOCK_PAGE` in `PODS/POD.THIN/OS/Clock/mount-clock/mount-clock.js`). One inline script: palette, wheels, grid, rulers, layers, panel. |
| `display.json` | OS launcher entry (`entry: smith_chart_clock.html`, `topic: APK.audio/Gui/Display/SmithChartClock`). |
| `package.json`, `test/smith.test.mjs` | `npm test` (no dependencies): the page's maths and tables. |

## The page test

`test/smith.test.mjs` reads the page's `<script>` and runs it in a `node:vm` context whose
`document`/`window` are stubs that accept any call. The page's top-level `const`s then live in
that context's global scope, and the test checks `swrFromRho`/`rhoFromSwr` and every
`RADIAL_SCALES` ruler against the RF definitions (and that each ruler inverts), `GRID_MINOR`
never repeats a `GRID_MAJOR` value, and `PLOT_PAIRS` name real `HAND_MAGS` hands.

## Retired: the TypeScript port

`SmithChartClock/` (a 25-file TypeScript port of the page, imported by nothing) was removed on
2026-10-30: the owner ruled the page canonical. It is in history at `e6337cb`
(`git checkout e6337cb -- SmithChartClock index.ts tsconfig.json`).

## Checking

```sh
npm test
```

## Relationship to TIME.clockFaces

This repo is the `Smith Chart/` submodule of TIME.clockFaces. The small `smith` face in
TIME.clockFaces (`src/smith.ts`) is its own code; it does not import this repo.
