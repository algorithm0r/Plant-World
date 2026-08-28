# Plant World — DEVLOG
Newest entry on top. **Append only — never edit past entries.**

<!-- append new entries above this line -->

## 2026-08-27 — Stage 1: environment CA built and verified, no plants
**Done:** built the Stage 1 environment — heterogeneous terrain, soil moisture with two
sources (a Dirichlet water table diffusing upward, episodic patchy rain wetting the surface),
field-capacity drainage, light-scaled surface evaporation, graded top-down light, and root
uptake as a diagnostic sink. Rewrote `smoketest.mjs` as a 9-assertion suite. Two failures
found and fixed rather than assertions loosened: (1) `maxDelta` was measuring only the
diffusion half of a diffusion↔drainage balance, so it never reached zero at steady state —
now measures net change across a whole tick; (2) the smoketest's `run()` built a fresh engine
per call, restarting `tick` at 1, so rain never fired. Added **field capacity**, which was
not in the plan: without it every cell drains into the table and the profile goes dry above
~7 rows, deleting the deep layer and half of Walter's two-layer mechanism.
**Changed:** `params.js` (drifters params → grid/water/light), `world.js` (rewritten as the
lattice + CA), `observer.js` (3 field views, quantised palettes), `datamanager.js`/`runner.mjs`
(metrics vector instead of meanX), `util.js` (+ seeded mulberry32), `smoketest.mjs`
(rewritten), `main.js`/`index.html`. `agent.js` → `tip.js` (placeholder for Stage 2).
**State:** runs in-browser and headless. `node smoketest.mjs` → **9/9 PASS**. Field converges
to net Δ1.91e-6/tick after 4000 ticks; depth profile monotone 0.121→0.330 over depths 0–32;
light τ^k accurate to 5.96e-9 with 0.00525 still arriving under 5 leaves; rain 0.201→0.347
then decaying to 0.219 over 120 ticks with deep at 0.327; two same-seed worlds bit-identical.
Performance 0.271 ms/tick (~3700 ticks/s) at 200×150. No genome code exists.
**Next:** Stage 2 — `Tip` as a local accumulator, the instruction set (`G R S L B F ! @ *`),
`B` failing when a node has no free face, and the genome zoo asserting the counted-loop
identities.

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
