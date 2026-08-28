# Plant World — DEVLOG
Newest entry on top. **Append only — never edit past entries.**

<!-- append new entries above this line -->

## 2026-08-28 — Stage 2: the genome tape, tips, and morphology
**Done:** built `Tip` (tape + read head + heading, per-tip working copy) and `Plant`
(germline genome, concurrent tips, owned cells, trait vector). Germination spawns TWO tips,
up and down — radicle and plumule — both reading the same genome from 0, so positional cell
fate alone produces shoot above and root below with no extra symbols. Implemented
`G R S L B F ! @ *`, delta as a lattice face-selection rule, and the two distinct failure
modes (can't FIT → no-op and advance; can't PAY → wait, Stage 3). `L` underground is
suppressed rather than converted — a leaf primordium in the dark is arrested pending light
(skotomorphogenesis) — and it fails on POSITION, never on light level, since reading light
would be sensing (Stage 6). Verified six morphologies by ASCII render: counted stalk, leafy
axis with alternating phyllotaxis, two-phase heteroblastic plant, recursive brancher, aerial
roots (`R` above ground), rhizome (`S` below ground).
**Two bugs found, both real:**
  1. **Method name collision.** `World` already had `build()` (terrain) and I added
     `build(x,y,type,plant)`. The later class member wins, so every tip "growing" was calling
     the *terrain constructor* and regenerating the whole world. Symptom was cells=0 while
     tips still moved. Renamed to `place()` / `buildTerrain()`.
  2. **Buds did not claim their face.** `B` checked only that a face was VACANT. `B*` builds
     no cells, so faces stayed vacant forever and tips grew exponentially — 71,675 and still
     doubling when the run was killed. The geometric cap bounds cells per node, not tips per
     node. A tip now occupies one (cell, heading) slot via a per-cell bud bitmask; `B*` now
     caps at 4 tips, 0 cells. This is the assertion that guards it.
**Changed:** `tip.js` (rewritten from placeholder), new `plant.js`, `world.js` (+`place`,
`plantSeed`, `budMask`, owner map, plant metrics), `params.js` (+genome, nSeeds, deltaIndex,
maxTipSteps), `observer.js` (plant tissue + tip markers), `main.js`, `index.html`,
`datamanager.js`/`runner.mjs` (allMetrics), `MODEL.md` (loop identities rewritten with real
symbols — A/B/C read as instructions now that `B` is one; `L` row expanded).
**State:** `node smoketest.mjs` → **23/23 PASS** (~100s; checks now stream as they run).
Stage 2 additions: three counted-loop identities exact, `*` unbounded, positional fate
(`G*` → 30 stem up / 30 root down from one program), `L` suppressed underground (20 leaves
above, 0 below, alongside 20 root cells), `R` aerial roots (8 cells above surface), `S`
rhizome (43 stem cells below surface), `B*` capped at 4 tips/0 cells, 6/6 zoo genomes
distinct and reproducible. Browser stack runs: 3 plants, 16471 cells, 9954 tips in 217ms
over 200 ticks. No economy yet — every tip executes unconditionally, by design.
**Next:** Stage 3 — two pools, transpiration, per-cell maintenance, the resource gate, and
calibrating the economy slower than the clock. Watch for self-pruning and crown rise.

## 2026-08-28 — characterised the moisture profile: throughflow, not a force balance
**Done:** tested what actually sets the soil moisture profile, prompted by the question of
whether gravity-down plus diffusion-up produces an emergent water level. It does not, in
three separate ways, all measured. (a) With NO sink the soil has no level at all, just slow
saturation — 0.250/0.267/0.335 at 2k/20k/80k ticks, still climbing, because below field
capacity nothing opposes diffusion. (b) The profile is nearly insensitive to sink RATE: a 15x
change in evaporation moves only the top cell (0.034 → 0.002), everything from depth 1 down
identical to three decimals, because transport is conductivity-limited (K(m)=m² at m≈0.1 is
0.01, so the dry layer is almost an insulator). (c) It IS strongly sensitive to gravity:
drainage 0 → 0.929 at depth 40, drainage 0.2 → 0.341. And at steady state water is still
moving — net upward flux 0.0139 across a cut 20 rows above the table, no downward component.
So it is a steady throughflow (table → soil → atmosphere), and the table LEVEL is an imposed
Dirichlet boundary; only the profile above it is emergent.
**Changed:** `MODEL.md` only — no code. Recorded the measurements, the bucket-approximation
limitation (no static equilibrium; slow drift toward saturation absent sinks; ~100k ticks vs
1500-tick runs), and the reason the table stays pinned rather than becoming a finite aquifer
(the two-layer mechanism needs the deep source reliable; a table moving with rainfall would
couple the layers and blur the niche).
**State:** no code change; `node smoketest.mjs` still 12/12 PASS.
**Next:** unchanged — Stage 2: `Tip`, the instruction set, the geometric branch cap, the
genome zoo.

## 2026-08-28 — soil hydraulics: two flaws found by asking whether a sink draws from the table
**Done:** answered the question by measurement rather than argument. A sink *does* draw from
the table (soil water flat at ~3650 while uptake ran indefinitely; a 640-cell root mat was
supply-limited to 2% of demand, so competition is real). The same tests exposed two flaws
that would have silently destroyed the strongest niche axis in the model:
  1. **Uptake was `min(rate, m)`** — a step function. Any cell above `rate` yielded full
     uptake, so roots at depth 1 and depth 32 both returned exactly 0.0200/tick. The water
     niche was flat and depth paid nothing. Uptake now scales with *available* water
     `(m − wiltingPoint)`, with a new `wiltingPoint` parameter.
  2. **Constant hydraulic conductivity** let the table wet the surface (settled at 0.119 with
     rain off), so a shallow root lived off the table and the shallow/deep distinction
     collapsed. Now K(m) = m^exp evaluated at the pair mean (conservative), exp=2 chosen by
     sweeping 0/1/2/3 — surface disconnects to 0.009 while depth holds 0.302.
Also fixed a test bug: `meanUptakeAt(2, P.rainPeriod)` read `P.rainPeriod` after a previous
call had left it at 0, so both "with rain" runs were silently rain-free.
**Changed:** `world.js` (`diffuse` → per-pair unsaturated flux; `uptakeStep` → availability-
scaled; new `conductivity()`), `params.js` (+`conductivityExp`, +`wiltingPoint`),
`smoketest.mjs` (+3 assertions), `MODEL.md` (soil hydrology + the measured result).
**State:** `node smoketest.mjs` → **12/12 PASS** in ~11s. The two-layer mechanism is now a
measured property: table-only, depth 30 outdraws depth 2 by 90x (13x at smoketest settle
times); with rain the ranking **inverts** and depth 2 outdraws depth 30 (2.7e-3 vs 2.1e-3).
Dry surface disconnects at ratio 0.029 vs ~0.26 under constant conductivity.
**Next:** Stage 2 — `Tip`, the instruction set, the geometric branch cap, the genome zoo.

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
