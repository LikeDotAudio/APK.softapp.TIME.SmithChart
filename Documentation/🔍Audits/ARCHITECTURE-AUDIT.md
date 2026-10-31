# 🔍 Architecture audit — TIME.SmithChart (2026-10-30)

Audited against the APK.audio multi-repo architecture standard: coupling, boundaries, duplication, contracts.
← [Audits](INDEX.md) · Improvements: [🛣Roadmap/IMPROVEMENTS.md](../%F0%9F%9B%A3Roadmap/IMPROVEMENTS.md)

## Bounded context
The Smith Chart Clock: an RF impedance chart read as a clock (hours on the resistance circles, minutes/seconds on the reactance arcs, the radially scaled parameter strip below). Two implementations of it live here: `smith_chart_clock.html` (4,318 lines, one inline script — the page the OS runs) and `SmithChartClock/` (25 TypeScript files, ~2,900 lines, the same clock as a module, imported by nothing). Nested submodule of TIME.clockFaces (`Smith Chart/`).

Sampled: every tracked file list, `README.md`, `display.json`, `index.ts`, `SmithChartClock/index.ts`, `SmithChartClock.ts`, `math/*`, `scales/radialScales.ts`, `render/grid.ts`, `time/wheels.ts`, the page's script head (palette, wheels, grid, scales), and the OS consumer `PODS/POD.THIN/OS/Clock/mount-clock/mount-clock.js`.

## Context map
| Talks to | How (topic / endpoint / file / import) | Relationship |
|---|---|---|
| OS shell — Clock window | iframes `APK:Softapps/TIME/TIME.clockFaces/Smith Chart/smith_chart_clock.html` (`OS.SMITH_CLOCK_PAGE`, `mount-clock.js:26`) | Supplier; the OS is Conformist to the page path |
| OS shell — desktop | `display.json` (`kind: web`, `entry: smith_chart_clock.html`, `topic: APK.audio/Gui/Display/SmithChartClock` — the launcher's display-topic convention) | Published Language (launcher manifest) |
| TIME.clockFaces (`src/smith.ts`) | none — the small "Smith" face is its own code in the parent repo | Sibling |

No bus, no HTTP, no third-party libraries; the only external surface is the Canvas 2D API.

## Scorecard
| Category | Score (0–3) | Finding |
|---|---|---|
| Coupling & Cohesion | 3 | No imports or paths outside the repo; the OS reaches it by its published page path. |
| Boundary Integrity | 3 | No vendor libraries; the module's public surface is `SmithChartClock/index.ts`. |
| Duplication Control | 1 | The clock exists twice, as the page's inline script and as `SmithChartClock/`. A parity test now holds the shared tables and formulas together, but the drawing code is still written twice. |
| Testing & Contracts | 3 | `npm test`: strict tsc, RF math tests, and the page/module parity test. Run by hand, per the house rule. |
| Change management | 2 | `display.json` + the page path are the contract; nothing versions the page, and the OS hard-codes the path. |
Score key: 3 meets the standard · 2 minor gaps · 1 significant gaps · 0 absent / violated.

## Findings
1. **Two implementations of one clock.** `smith_chart_clock.html` declares its own `PALETTE`, `HAND_MAGS`, `PLOT_PAIRS`, `GRID_MAJOR`/`GRID_MINOR`, `RADIAL_SCALES`, `rhoFromSwr`/`swrFromRho`, `formatScaleValue` and every `draw*` layer (≈20 names shared with `SmithChartClock/`). Only the page is used (`mount-clock.js:26`, `display.json`); `SmithChartClock/` is imported by nothing. Which one is the source is an owner decision (see IMPROVEMENTS #1).
2. **Good — the module is well cut.** `SmithChartClock/` splits types, math, time, colour, scales and one file per render layer (PLAN-3354.01); `SmithChartRFMath` is a thin façade over pure functions.
3. **Good — launcher manifest follows the convention.** `display.json` names its entry and the `APK.audio/Gui/Display/<id>` topic the desktop uses.

Delivered items from this audit are recorded in [🌍Publishing/DELIVERY.md](../%F0%9F%8C%8DPublishing/DELIVERY.md).
