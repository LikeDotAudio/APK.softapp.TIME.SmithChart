# Principles — TIME.SmithChart

What the Smith Chart Clock keeps, each with the code that keeps it.

← [Wiki home](../README.md)

| Principle | Kept by |
|---|---|
| **The chart is real RF maths, read as a clock.** Hours, minutes and seconds are reflection coefficients; every readout (SWR, return loss, admittance) is computed from Γ, never drawn by eye. | `SmithChartClock/math/complex.ts`, `math/metrics.ts`; page script `RADIAL_SCALES`, `swrFromRho` |
| **The radially scaled parameter strip is one table.** Each ruler is a row with `rhoOf`/`valueOf`, so the strip and the probe read the same numbers. | `SmithChartClock/scales/radialScales.ts`; page script `RADIAL_SCALES` |
| **Pure numbers apart from pixels.** Math, time and colour are free functions; render layers take a `Layer` and draw. | `SmithChartClock/math/`, `time/`, `colour/` vs `render/` |
| **Two copies, held equal until one goes.** The page and the module carry the same tables and formulas; a test fails the moment they differ. | `test/smith.test.mjs` |

## Where the code bends a rule

- **The clock is written twice** (the page's inline script and `SmithChartClock/`) — see
  [IMPROVEMENTS](../%F0%9F%9B%A3Roadmap/IMPROVEMENTS.md); choosing the source is the owner's.
