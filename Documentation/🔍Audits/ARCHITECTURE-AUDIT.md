# 🔍 Architecture audit — TIME.SmithChart (2026-10-30)

Audited against the APK.audio multi-repo architecture standard: coupling, boundaries, duplication, contracts.
← [Audits](INDEX.md) · Improvements: [🛣Roadmap/IMPROVEMENTS.md](../%F0%9F%9B%A3Roadmap/IMPROVEMENTS.md)

## Bounded context
The Smith Chart Clock: an RF impedance chart read as a clock (hours on the resistance circles, minutes/seconds on the reactance arcs, the radially scaled parameter strip below). One implementation: `smith_chart_clock.html` (4,318 lines, one inline script — the page the OS runs). The unused `SmithChartClock/` TypeScript port was retired on 2026-10-30 (owner decision). Nested submodule of TIME.clockFaces (`Smith Chart/`).

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
| Boundary Integrity | 3 | No vendor libraries; the public surface is the page path and `display.json`. |
| Duplication Control | 3 | One implementation; the TypeScript port was retired. |
| Testing & Contracts | 3 | `npm test` runs the page's script headless and checks its RF maths and tables. Run by hand, per the house rule. |
| Change management | 2 | `display.json` + the page path are the contract; nothing versions the page, and the OS hard-codes the path. |
Score key: 3 meets the standard · 2 minor gaps · 1 significant gaps · 0 absent / violated.

## Findings
1. **Good — one implementation, tested headless.** The page is the clock; `test/smith.test.mjs` runs its script in `node:vm` and checks the formulas and tables. The unused TypeScript port was retired (restorable from `e6337cb`).
2. **Good — launcher manifest follows the convention.** `display.json` names its entry and the `APK.audio/Gui/Display/<id>` topic the desktop uses.

Delivered items from this audit are recorded in [🌍Publishing/DELIVERY.md](../%F0%9F%8C%8DPublishing/DELIVERY.md).
