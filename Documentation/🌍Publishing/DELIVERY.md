# TIME.SmithChart delivery

A page and a TypeScript module; nothing is built here.

- **Repository:** https://github.com/LikeDotAudio/APK.softapp.TIME.SmithChart, the `Smith Chart/`
  submodule of TIME.clockFaces.
- **Where it runs:** the OS serves `smith_chart_clock.html` from the Softapps tree
  (`APK:Softapps/TIME/TIME.clockFaces/Smith Chart/`); the Clock window's Smith Chart tab and the
  desktop tile (`display.json`) frame it. It ships inside the WEB.Frontend-Assets image with the
  rest of Softapps.
- **Check:** `npm ci && npm test`, by hand before a push.

## Delivered from the 2026-10-30 audit

- **Build and test harness** — `package.json` (typescript devDependency, npm 10 lock), `tsconfig.json`
  (strict) and `test/smith.test.mjs`: impedance ↔ Γ round trips and SWR ↔ |Γ|. Verified: `npm test`.
- **Page/module parity contract** — the same test runs the page's inline script in a `node:vm`
  sandbox with a stub DOM and checks its `RADIAL_SCALES` (ids, rows, sides, labels, precision,
  ticks, `valueOf` at seven radii), `formatScaleValue`, `rhoFromSwr`/`swrFromRho`,
  `GRID_MAJOR`/`GRID_MINOR`, `HAND_MAGS` and `PLOT_PAIRS` against `SmithChartClock/`, so the two
  implementations cannot drift unnoticed while both exist. Verified: `npm test` (4/4 pass).
- **Grid drift fixed** — the parity test found `SmithChartClock/render/grid.ts` `GRID_MINOR` still
  carried the major values, so the module drew (and labelled) those circles twice; it now drops
  them as the page does.
- **Stale entry path** — README's Web Portal Entry is `APK:Softapps/TIME/TIME.clockFaces/Smith Chart/…`
  (the path the OS opens), not the pre-rename `APK:Softapps/TIME.clockFaces/…`.
