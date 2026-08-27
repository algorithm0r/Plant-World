# Plant World — DEVLOG
Newest entry on top. **Append only — never edit past entries.**

<!-- append new entries above this line -->

## 2026-08-27 — scaffolded; model deliberately not implemented
**Done:** project scaffolded from engine v2 — vanilla-JS canvas microframework with
model/view split, the vendored standard DB client, a headless `runner.mjs`, and
`smoketest.mjs`. Vendored Chris's `plant-world-model-skeleton.md` into the sim repo as
`MODEL.md` (the amend-in-place design bible). Wrote a **rough** DEVPLAN whose Stage 0 is a
design conversation rather than code: it enumerates the decisions the skeleton leaves open
(model purpose; `@`/`!` semantics and termination; lattice-vs-continuous heading; one pool
vs. two; finite vs. infinite water; reproduction, which the skeleton omits entirely; and
the metric).
**Changed:** initial file tree at `Research/Plant World/sim/`. `params.js` DB set to
`plantworldDB` / run prefix `run`. DEVPLAN, STATUS, DEVLOG rewritten from stubs to say
"design stage" rather than the stub's "replace the demo model."
**State:** runs — demo drifters model only, in-browser and headless. `node smoketest.mjs`
PASS. **Zero Plant World model code exists, by intent.**
**Next:** DEVPLAN Stage 0.1 — decide with Chris what the model is *for*. Every other open
decision depends on that answer. Do not write model code before Stage 0 closes.
