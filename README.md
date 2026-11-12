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
| `smith_chart_clock.html` | **The clock** — the one implementation. The OS runs it: the desktop tile (`display.json`) and the Clock window's Smith Chart tab (`OS/Clock/mount-clock/mount-clock.js`, `OS.SMITH_CLOCK_PAGE`) frame it. Markup only; its style is `style.css` and its script eight classic scripts in `js/` loaded in order (RF maths and rulers, state and controls, canvas view, chart, loci, pivot, lapse and corners, frame loop). |
| `package.json`, `test/smith.test.mjs` | `npm test`: runs the page's script headless (`node:vm`, stub DOM) and checks its RF maths and tables. |
| `URGENT SMITH CHART.md` | Design notes and outstanding work. |

---

## 🚀 Usage & Integration
* **Web Portal Entry**: `APK:Softapps/TIME/TIME.clockFaces/Smith Chart/smith_chart_clock.html`
* **Check**: `npm test` (by hand, before a push; no dependencies)
* **Retired**: the `SmithChartClock/` TypeScript port (imported by nothing) was removed on 2026-10-30 by owner decision — the page is canonical. Restore it with `git checkout e6337cb -- SmithChartClock index.ts tsconfig.json`.
* **Remote Repository**: https://github.com/LikeDotAudio/APK.softapp.TIME.SmithChart

<!-- wiki:smoke -->
**Smoke test** — ✅ PASS 2/2 since 2026-11-12 00:40 EST — [results](Documentation/%F0%9F%A7%A9Manual%20and%20Artifacts/SMOKE.md)
<!-- /wiki:smoke -->
