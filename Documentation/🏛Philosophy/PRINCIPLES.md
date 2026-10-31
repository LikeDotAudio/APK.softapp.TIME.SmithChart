# Principles — TIME.SmithChart

What the Smith Chart Clock keeps, each with the code that keeps it.

← [Wiki home](../README.md)

| Principle | Kept by |
|---|---|
| **The chart is real RF maths, read as a clock.** Hours, minutes and seconds are reflection coefficients; every readout (SWR, return loss, admittance) is computed from Γ, never drawn by eye. | page script `swrFromRho`, `rhoFromSwr`, `RADIAL_SCALES`; `test/smith.test.mjs` |
| **The radially scaled parameter strip is one table.** Each ruler is a row with `rhoOf`/`valueOf`, so the strip and the probe read the same numbers. | page script `RADIAL_SCALES`; the test checks every ruler inverts |
| **One implementation.** The page is the clock; the TypeScript port was retired rather than kept in step. | `smith_chart_clock.html`; README "Retired" |

## Where the code bends a rule

- **One 4,300-line page.** The clock is a single inline script; it is tested headless (`test/smith.test.mjs`) rather than split.
