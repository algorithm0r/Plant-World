# Plant World — DEVLOG
Newest entry on top. **Append only — never edit past entries.**

<!-- append new entries above this line -->

## 2026-11-13 — presentation: Claude Basic 0.6.0, genome inspector, first-30-seconds page

**Done:** Page rebuilt for showing to two incoming grad students (TCSS 600 candidates). Claude
Basic **0.6.0** vendored in `vendor/` (identical to Flea Jumping's copy); layout is the kit's
`cb-sim` stage + charts. Under the world: a clock dial (one turn per 1000 ticks), a legend of
world marks, a **plant inspector** (click a plant, or "Pick the tallest plant": its germline as
symbol chips with hover definitions, its live facts, and each growing tip's working copy with
the read head ringed), a founder row (six presets from the params comment plus a free genome
field and Sow), 8 front controls and the other 23 behind a disclosure. Right column: a "how
plants grow" panel (teaching register, stylometry + cold reader applied), lines for plants and
seed bank, births/deaths, distinct genomes, cells by tissue, and heatmaps of height, root depth
and genome length per plant. `charts.js` (the in-canvas LineGraph) and the text status block
are gone.
**Changed:** Observer draws one pixel per cell into an ImageData and scales it once (was one
fillRect per cell); colours come from `--pw-*` primitives in `index.html`, resolved by
`CB.sim.palette`, so no colour is written in JS. Tips drawn at cell size (were cell+2, which
turned the canopy pink). Wet-soil colour softened. DataManager keeps view arrays beside the
packet samples; **the packet is unchanged**. PARAM_SCHEMA got plain labels, a View select and
`front` flags; no PARAMETERS value changed. **No model change.** Brief asked for day/night and
seasons; the model has neither by design (MODEL.md), so none were added and the dial shows
elapsed time only.
**State:** smoke **33/33 PASS @ af6d0a9-dirty** (pre-commit). Model untouched, checked two
ways: headless 15k ticks gives identical metrics with no DataManager, with it, and with
`traits()` called on every plant every tick (137 plants, 931 births, 802 deaths), and the
browser shows the same 137 plants at t=15000. Browser cost per frame: draw 0.58 ms, a tick
0.53 ms at ~74 plants, so 12 ticks/frame fits 60 fps (not measured as fps: the pane was hidden
and throttled). Seen in a real browser at 1600x1000 and 375 px (no horizontal scroll), basic and
paper themes; click-to-inspect and preset Sow tested. **Found, not fixed:** every browser DB
save fails (`root is not defined` in `src/db.js`), so the live page has never written a packet.
Kit findings (wide-stage grid, histmap y range, ordinal clock count, world-palette pattern)
filed in the side-session notes folder; one bridge in `index.html` (grid override).
**Next:** Chris reviews before anything goes public (not pushed, not published to `live`). Then
the db.js fix upstream, and back to Stage 4's clonal reproduction.

## 2026-08-28 — world doubled to 400 wide; transport allocation bug
**Done:** `gridW` 200 -> 400 (1600x600 px canvas). `terrainScale` doubled 2.5 -> 5.0 alongside
it, because it counts undulations across the WIDTH — leaving it would have stretched every
hill to twice its size and changed how much of the world is valley (table within root reach)
versus ridge. Geometry preserved: valleys 10 rows to the table, ridges 27.
**Performance, and my first guess was wrong.** Assumed `topSoilY`'s per-column O(H) scan was
the bottleneck, cached it, gained almost nothing (340 -> 351 ticks/s). Profiling per phase
showed **transport at 58% of the tick**, and the cause was its inner neighbour loop
allocating a fresh `[i-1, i+1, i-W, i+W]` array per cell per sub-step — ~38k allocations/tick
at 3200 cells. Unrolled: 340 -> 441 ticks/s at the largest populations, 651 -> 828 mid-run.
Note that transport had ALREADY been "optimised" this session (grid scan -> plant-cell list,
a real 3x win) and I moved on without profiling, so the allocation cost sat underneath
undetected.
**A near-miss worth recording.** Also pointed `uptakeStep` at the plant-cell list — which
silently zeroed uptake, because `pcells` means "cells registered to a plant" and the Stage 1
fixtures place a bare `ROOT` with `set()` and have no plants at all. Two sets that usually
coincide are not the same set. Caught immediately only because uptake went to exactly
0.0000/tick; a version that skipped only SOME roots would have looked like an economy
calibration problem and sent me tuning `uptakeRate`. Reverted — it was 4% of the tick, and
uptake should work for a root cell however it came to exist.
**This is the fourth instance today of one mistake:** treating two things as the same set
because they usually overlap — roots and the reachable water table, the tested genome and the
shipped genome, the browser build and the headless build, and now registered cells and root
cells.
**Also:** smoketest probes are now width-relative (`w.W >> 1` etc.) instead of assuming a
200-wide world, so they survive further size changes.
**State:** `node smoketest.mjs` -> **33/33 PASS** at the shipped 400-wide world. The suite
runs the configuration that ships rather than a faster proxy, deliberately.
**Published (later the same day).** Remote is `algorithm0r/Plant-World`, which turned out to
ALREADY EXIST from June 2023 — a one-commit three.js voxel prototype of the same project,
public, with Pages already live at the same URL. Chris chose to push over it. `main`
force-pushed (`9c86480` -> `fba882f`); the old commit preserved as tag
`voxel-prototype-2023`. Created a `live` branch and repointed Pages at it, so the site does
not move when `main` does — publishing is `git push origin main:live`. Site verified 200 with
all `src/` files serving. About description and homepage updated. The published page does hit
the research Server (Chris's call), so visitors open a socket and the DataManager writes at
`epoch`.
**Superseded note:** the repo was local-only — no remote, no `gh-pages`, no GitHub Pages site. Publishing
would need `src/db.js` neutered first: it dials `research.climbinggiants.com:8888` over
socket.io, which would be a visible connection attempt from every visitor.

## 2026-08-28 — plant death, and: the two-layer mechanism had never been operating
**The big one.** Chris asked why there was no branching; chasing that led to checking how deep
roots actually grow, and: **roots reach ~14 rows while the water table sat 41-57 rows below
the surface. No plant had ever reached it.** Every plant in every run has lived entirely on
rain. The deep-rooted half of Walter's two-layer mechanism — described in MODEL.md as the
strongest single source of niche structure in the model — was geometrically unreachable and
did nothing. The Stage 1 measurements that appeared to demonstrate it (depth 30 outdrawing
depth 2 by 90x; the ranking inverting with rain) used **hand-placed** roots: true statements
about the soil, never statements about plants.
The diagnostic was available since Stage 1 and never run: with rain off, plants died on low
AND high ground at every tableDepth of 0.70 or deeper. If the deep layer mattered, low ground
should have lived. Fixed with `tableDepth` 0.88 -> 0.67 (~10 rows below valleys, ~26 below
ridges, 16-row soil column retained). Now: rain off, low ground 20 cells vs high ground 0;
rain on, that same high-ground column 34 cells.
**Withdrew the "ranking inverts with rain" claim.** It compared single roots at fixed depths
and ignored the cost of REACHING depth. With a reachable table, deep simply wins (90x); the
Stage 1 inversion was an artifact of the table being far enough away that a "deep" root was
not near the source. Replaced by the partition stated at plant level, both halves asserted.
**Also, this is the third instance today of one error shape:** testing components in isolation
and asserting a property of their composition. The browser ran a genome with no `F` while
population dynamics were reported; the demo genome had no `B` while branching was described;
and the soil and the plants were each verified while the gap between them was not. The cheap
general diagnostic is to remove a mechanism's only input and require the system to fail.
**Plant death, per Chris.** Two mechanisms added, both previously flagged as open: **random
background mortality** (density-INDEPENDENT, so it can open gaps — starvation is
density-dependent and structurally cannot), and **monocarpic senescence** (a plant whose tips
have all run off the tape is a completed adult and dies after `plantSenescence` ticks). The
latter finally makes the annual/perennial axis do something, on one symbol: `GL@@@!GLF@@@`
(no `*`) ends its program at t=2727 and dies; `GL@@@!GLF*` never ends and is alive with 55
cells at t=12000. Death causes over 12k ticks: starved 184, random 25, senescent 4.
**Split the RNG into two streams.** Adding mortality consumed draws every tick, shifted the
rain pattern, and silently reversed an unrelated water-table result. `rng` is now environment
only (terrain, rain) and `rngBio` biology only (mortality, dispersal, mutation). Without this
every Stage 5 ablation would have been untrustworthy, since turning a mechanism off would also
change the environment it was compared against.
**Corrected an overclaim about the demo founder.** `GL@@@!GLBF*` was called "the best
performer tested"; that came from comparing two genomes differing in two ways at once. The
controlled test: `GL@@@!GLF*` (no branch) 413 births, `GL@@@!GLBF*` (branch) 286. The gain
came from the shorter juvenile phase, not branching. Worse, `B` **flips sign** by context —
+136 births with a long juvenile phase, -127 with a short one. That is epistasis, and it is a
better result than a uniform benefit: growth form and developmental timing must co-evolve.
The founder keeps `B` for visibility, and MODEL.md now says so.
**Also corrected the positional table.** The full sweep peaks at position 8 (immediately
before the `!`), and every adult-phase position is worse than no branching at all. The earlier
caption — "branching late splits an established plant that can afford it" — described adult
behaviour that had not been measured, from a table whose every entry was juvenile.
**Test-parameterisation fixes:** depth probes now derive from the actual soil thickness at the
probe column instead of hard-coded rows that fell below the raised table and read as dry;
single-plant behavioural tests disable random mortality, which was killing the subject
mid-measurement; the water-table test no longer compares cell counts on 5-cell margins.
**State:** `node smoketest.mjs` -> **33/33 PASS**.
**Next:** apply the remove-the-input diagnostic to the other diversity mechanisms before
Stage 5, which is built entirely on ablations.

## 2026-08-28 — Stage 4: reproduction, inheritance, and a self-sustaining population
**Done:** `F` now mutates the parent germline, disperses it by a local exponential kernel into
a seed bank with dormancy and a lifespan, and germinates onto bare surface. Mutation operators:
point substitution, indel, **`@`-run slippage** (the microsatellite analogue that keeps repeat
number a smooth quantitative trait) and **tandem duplication** of a random substring (how real
genomes build modules). `prune()` extended so a cut-loose fragment that still touches ground
becomes an independent ramet rather than falling. Plants with no tissue are retired.
**Chris's reframe was right and it is the headline: population turnover works even though
individual plants do not stabilise.** From 8 founders of `GL@@@@@@!GLF*`: 90 plants alive, 476
germinations, 394 plant deaths, 131 seeds banked, 19 distinct genomes by t=20000, with mean
genome length stable at 13.4 (no bloat). Individual plants still boom and bust; the population
does not care, because fitness is seeds set before the crash. The overshoot that blocked Stage
5 may be a life-history rather than a defect.
**Weismann's barrier verified exactly, and nobody coded it.** It falls out of `!` being
per-tip. With mutation off, germline `GL@@@@@@!GLF*`, the two tips held `GLF*` and `GL!GLF*`
(differently truncated, because they are at different points in their own working copies), and
the seed carried the full untruncated germline. The `lamarckian` switch flips the seed to
`GLF*`, the parent tip's working copy — a one-line experimental condition.
**Guarded against an obvious exploit:** `seedProvision` < 1, so a seed always carries less
sugar than `F` costs. Without that, reproduction is an energy source and selection finds it
immediately.
**Not done: clonal reproduction is implemented but never observed.** Stem cells die only from
starvation, and by the time a stem starves the whole plant is collapsing, so the fragment is
rarely both anchored and viable. Real stolon disconnection is *programmed* — the connector
senesces once the daughter has rooted — not a starvation event. Candidate fix: make `S`-forced
tissue ephemeral, since a stolon is an ephemeral connector by definition and `S` already
exists. Recorded as `[~]` in the DEVPLAN rather than ticked.
**Changed:** `world.js` (+seed bank, disperse, germinateBank, mutate, clonal splitting in
prune, plant retirement, population metrics), `tip.js` (`F` disperses instead of placing a
cell), `plant.js` (+seedsMade, age), `params.js` (Stage 4 block), `smoketest.mjs` (+4
assertions, and trimmed: the suite had grown to ~5 minutes).
**The browser demo was stale, and Chris caught it.** Everything above was verified headlessly
while `index.html` was still sowing `genome: 'GL*'` — which has no `F`, so **nothing
reproduced in the UI at all**. None of the population dynamics being reported were visible.
The status line still read "Stage 2 ... No economy yet". Three further gaps: the seed bank
was never drawn, so reproduction was invisible until a plant abruptly appeared; the graph
tracked soil moisture rather than anything about plants; and at `updatesPerDraw: 1` the
interesting behaviour (t>5000) was minutes of wall-clock away. Fixed: founder genome
`GL@@@@@@!GLF*`, `updatesPerDraw` 12, `epoch` 60000, seed-bank markers, a live multi-line
status refreshed on a 400 ms interval, and the graph switched to live plant count. At ~15 s
of watching: 57 plants, 119 born, 70 died, 48 banked. **Lesson: headless verification says
nothing about the demo. Check the artifact the user actually looks at.**
**Demo founder had no `B`, so the UI showed only bare stalks** — Chris caught that too. Asked
whether evolution could find `B` on its own, the measurement says: yes, but slowly. Mutation
generated 5 B-carrying seeds by t=20000 from a founder with none, yet none established. A
positional sweep shows why — inserting one `B` into `GL@@@@@@!GLF*` gives 19/0/0/0/4/19/27/43
surviving plants at positions 0..7: **lethal at 1-3, best at 7, and smooth in between**.
Branching early splits a seedling's resources before it can earn; branching late splits a
plant that can afford it. Demo founder switched to `GL@@@!GLBF*` (branches in the adult phase,
and the best performer tested: 286 births/12k ticks vs 158 unbranched). Branching is visible
about 2 seconds in. Recorded in MODEL.md — the positional gradient is an evolvability result,
not just a demo fix.
**Next:** get clonal reproduction to actually happen, then Stage 5 — disturbance, the
water-source ablation, and diversity measured as modality rather than variance.

## 2026-08-28 — whole-plant death, structural support, storage organs
**Done:** fixed the floating stems and leaves Chris saw. Two causes: (1) `plant.alive` was
tied to HAVING TIPS, and `maintain()` skips dead plants, so a plant that stopped growing was
never charged maintenance again and froze into an immortal husk. `alive` now means HAS
TISSUE; a plant that stops growing is a mature plant that keeps respiring. (2) No structural
support — a death low down cut everything above it loose and it hung in the air. Added
`prune()`: flood-fill from tissue anchored at or below the soil surface, and anything
unreached falls (counted as `fallen`, separately from starvation).
Also fixed the tip backstop: it aged out on LIFETIME, so it killed healthy slow-growing
meristems at exactly `maxTipSteps` and froze the plant — the step cap was doing the halting,
the one thing it must not do. It now counts consecutive UNPRODUCTIVE steps and resets on any
successful build. With that fixed `GL*` went from frozen at 53 cells to 57 at t=5000 and 90
at t=8000.
**Built storage:** `L` below ground now makes a `STORE` cataphyll instead of being suppressed
(real scale leaves are non-photosynthetic storage organs; a bulb is a stack of them). Same
symbol, tissue set by position, as `G` works. Storage loads at the full transport rate and
unloads at `storeRelease` times it — starch must be remobilised — making it a low-pass filter
on the carbon budget.
**Storage did NOT fix the overshoot.** A local store cannot rescue a whole-plant deficit when
transport holds every cell near the same level and they cross the debt threshold together.
What did stop the collapse was **faster leaf senescence**: the collapse is a race between two
shedding mechanisms and the graceful one was losing to the brutal one. At `leafSenescence` 40
a plant reached 113 cells and held; at 120 it collapsed. But 40 keeps so few leaves that the
plant no longer self-shades, so **crown rise disappears and the water-table advantage
reverses**. Reverted to 120 rather than tune to make tests pass; this is a live trade-off.
**Regression, recorded not hidden:** storage changed what `GL*` means — its down-tip's `L`
used to be a no-op and now builds a store, so the canopy is thinner. The crown-rise SIGNATURE
(lowest living leaf rising 2 → 7) no longer reproduces. The MECHANISM is intact and still
asserted: senescence fires, targets leaves, spares roots. Two assertions were rewritten to
claim what is now true — anti-collapse rather than settling, and mechanism rather than
signature — with the weakening stated in the test comments.
**Changed:** `world.js` (STORE, prune, asymmetric transport, maintain-all-plants, mark array),
`plant.js` (alive/growing split, dirty, fallen, store in traits), `tip.js` (idle backstop,
`L` builds STORE), `params.js` (+storeRelease), `observer.js` (STORE colour, combined view),
`smoketest.mjs`, `MODEL.md`, `DEVPLAN.md`.
**Also:** combined light+moisture display — view 0 now shows sky brightness as light (canopy
shadows read as dark columns) and ground colour as soil moisture, plants in tissue colours.
Views are 0 both / 1 light / 2 wet / 3 type.
**State:** `node smoketest.mjs` → **28/28 PASS** (~3 min now; the 4000-tick economy run
dominates). `GL*` grows 29 → 64 cells over 4000 ticks without collapsing, holding 8 leaves,
14 roots, 13 store cells at height 28.
**Next:** Stage 4 — reproduction and inheritance, including the mutation operators. Nutrients
and litter deferred to after a first evolution run so their contribution is measurable.

## 2026-08-28 — Stage 3: the economy; self-pruning emerges; an instability found
**Done:** built the resource economy — per-cell plant pools for water and sugar, root uptake
into the plant, photosynthesis that REQUIRES water (stomata open to admit CO2, so a leaf with
no water fixes no carbon), transpiration draining leaves whether growing or not, sub-stepped
transport between plant-graph neighbours, per-cell maintenance with a genome-length surcharge,
and growth gated on the tip being able to pay. The seed is now a real endowed `SEED` cell so
the endosperm sits inside the transport network.
**Four bugs, each found by measurement:**
  1. New cells were born with an empty pool and died the tick after being built. Fixed with a
     debt tolerance (`cellDebtLimit`) plus the seed-as-cell endowment.
  2. `draw()` used `Math.min(rate, ps[i])` — with debt tolerance `ps` can be negative, so tips
     ABSORBED cell debt into their own banks (observed at -3.7, -5.3, -6.7) and could then
     never afford to build. This silently capped every plant at whatever its seed funded, and
     showed up as plant size scaling linearly with seedSugar (0.5→3 cells, 10→49).
  3. Tip banks hoarded sugar that maintenance needed, starving the root system. Added a draw
     floor — and applied it to SUGAR ONLY, since maintenance is paid in sugar and water has no
     competing claim.
  4. Single-pass diffusion gives a supply gradient growing as N^2, which starves anything past
     ~20 cells. Real phloem is pressure-driven bulk flow. Added transport sub-steps, keeping
     the lag (a feature) without the quadratic wall (a defect).
**Added, not in the plan: local leaf senescence.** The general debt rule prunes by DISTANCE
from the sugar source, and roots are always furthest, so it shed the root system first and
plants died of thirst (crown rise reached height 21 with root count 0). A leaf below its own
light compensation point for `leafSenescence` ticks is now shed — a local rule with a real
referent. Crown rise then stabilises and roots survive.
**Added: `economyOff`**, a control condition giving pure Stage 2 semantics. Stage 2 assertions
test the interpreter under it; it is also the ablation Stage 5 needs.
**Changed:** `world.js` (+pools, photosynthesise, transport, maintain, killCell, senescence),
`tip.js` (draw/pay/wait; growth helpers report success), `plant.js`, `params.js` (economy
block, calibrated), `smoketest.mjs` (+5 Stage 3 assertions; checks stream), `MODEL.md`,
`DEVPLAN.md`.
**State:** `node smoketest.mjs` → **28/28 PASS**. Stage 3 criteria all met: near the table 43
cells vs 41 far from it; `*` halts on the economy (oldest live tip 2400 vs a 4000 backstop);
2.1% of tip-ticks execute; **self-pruning with crown rise** — lowest living leaf 2 → 7, 17
cells shed, 9 roots retained, with no rule saying prune.
**Known limitation, recorded not hidden:** an **overshoot instability**. Tips commit to cells
on a local bank with no reference to whole-plant carrying capacity, so an abundant plant
overbuilds and, since transport keeps cell sugar even, all cells cross the debt threshold at
once. At low transpiration a plant peaked at 99 cells and finished at 0. Water throttling is
currently the only thing preventing carbon overshoot — a load-bearing accident. Response to
seed provisioning is non-monotone (`GL*`: 43 / 0 / 9 / 5 cells at seedSugar 2.5 / 6 / 12 / 25)
and only 2 of 8 test genomes stay viable. That landscape is too close to noise for Stage 5.
**Next:** decide on **storage** — a pool absorbing surplus rather than converting it straight
to tissue, drawn down in deficit. It damps this oscillation and is also what perennial
overwintering, the seasonal storage effect and tuber/bulb propagules need.

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
