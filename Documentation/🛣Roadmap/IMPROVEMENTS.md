# 🛣 Improvements — TIME.SmithChart (from the 2026-10-30 architecture audit)

What this repo should change to meet the standard, most valuable first. Source: [🔍Audits/ARCHITECTURE-AUDIT.md](../%F0%9F%94%8DAudits/ARCHITECTURE-AUDIT.md).
← [Roadmap](INDEX.md)

| # | Improvement | Category | Effort (S/M/L) | Evidence |
|---|---|---|---|---|
| 1 | Needs owner: pick the source of the clock. Either the page loads a bundle built from `SmithChartClock/` (and its inline script goes), or `SmithChartClock/` is retired and the page is the source. Until then `test/smith.test.mjs` keeps the shared tables and formulas equal. | Duplication Control | L | `smith_chart_clock.html` inline script; `SmithChartClock/` imported by nothing |
