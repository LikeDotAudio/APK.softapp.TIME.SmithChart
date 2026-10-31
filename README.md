# TIME.SmithChart

> 📉 **Smith Chart Clock** — an RF impedance clock face for the APK.audio ecosystem.

---

## 🧩 Architectural Role
* **Family**: TIME
* **Category**: Clock Faces
* **Pipeline Stage**: Display

---

## ⚙️ Repository Overview
This repository is a modular, standalone component of the APK.audio Softapps suite. It operates as an independent Git repository, integrated as a submodule of [`APK.softapp.TIME.clockFaces`](https://github.com/LikeDotAudio/APK.softapp.TIME.clockFaces) under `Smith Chart/`.

| File | Purpose |
| --- | --- |
| `SmithChartClock/` | The clock face implementation, one job per file: `types.ts` (type vocabulary), `math/` (Γ ↔ z ↔ y, \|Γ\|-derived metrics, the `SmithChartRFMath` façade), `time/` (clock wheels, 24-hour day path), `colour/` (date-derived colours), `scales/` (the radially scaled parameters ruler table), `render/` (geometry, zoom/pan input, theme, and one file per canvas layer), `readouts.ts` (panel numbers and formula text), `options.ts` (defaults), `SmithChartClock.ts` (the class: canvas, clock source, frame loop) and `index.ts` (public surface). |
| `index.ts` | Barrel export. |
| `smith_chart_clock.html` | The page the OS runs: the desktop tile (`display.json`) and the Clock window's Smith Chart tab (`OS/Clock/mount-clock/mount-clock.js`, `OS.SMITH_CLOCK_PAGE`) frame it. It carries its own inline script, a second implementation of the same clock. |
| `package.json`, `tsconfig.json`, `test/smith.test.mjs` | `npm test`: strict tsc over the module, the RF math, and a parity test that runs the page's script in a sandbox and checks its tables and formulas against the module's. |
| `URGENT SMITH CHART.md` | Design notes and outstanding work. |

---

## 🚀 Usage & Integration
* **Web Portal Entry**: `APK:Softapps/TIME/TIME.clockFaces/Smith Chart/smith_chart_clock.html`
* **Check**: `npm ci && npm test` (by hand, before a push)
* **Remote Repository**: https://github.com/LikeDotAudio/APK.softapp.TIME.SmithChart

<!-- wiki:smoke -->
**Smoke test** — ❌ FAIL 1/2 since 2026-10-30 22:22 EDT — [results](Documentation/%F0%9F%A7%A9Manual%20and%20Artifacts/SMOKE.md)
<!-- /wiki:smoke -->
