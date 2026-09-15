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
| `SmithChartClock.ts` | The clock face implementation — chart geometry, hands, and the radially scaled parameter strip. |
| `index.ts` | Barrel export. |
| `smith_chart_clock.html` | Standalone prototype / preview page. |
| `URGENT SMITH CHART.md` | Design notes and outstanding work. |

---

## 🚀 Usage & Integration
* **Web Portal Entry**: `APK:Softapps/TIME.clockFaces/Smith Chart/smith_chart_clock.html`
* **Remote Repository**: https://github.com/LikeDotAudio/APK.softapp.TIME.SmithChart
