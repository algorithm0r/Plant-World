# Plant World — DEVPLAN
*Living document, not frozen. Update as the design evolves.*

`MODEL.md` is the design bible — read it first; it carries the rationale, this file carries
the work. The model is settled enough to build (design session 2026-08-27) — Stage 0 is
`[ DONE ]` and Stage 1 is `[ ACTIVE ]`. The open items that remain are tuning numbers and
deferred features, none of which block code.

## Built
- Scaffolded from engine v2 (vanilla-JS canvas + standard DB client). Demo "drifters" model
  runs in-browser and headless.
- The model design: purpose, machine semantics, resource economy, alphabet, reproduction,
  inheritance, mutation operators. See `MODEL.md`.

## Not yet built
- All of it. No Plant World code exists.

---

## Stage 0 — Close the remaining model decisions  [ DONE ]  *(design, not code)*

Settled 2026-08-27 (recorded in `MODEL.md`): purpose is **evolution**; two resource pools
(water + sugar) with maintenance costing sugar; light modelled, CO2 not; `!` per-tip;
`@` consumed as a unary counter with `!` as the loop origin; `*` added for indeterminate
growth; `]` dropped and the **no-lethal-sites** rule adopted in its place; `[` → `B` with
fork semantics and no stack; positional cell fate via `G` with `R`/`S` overrides; clonal
reproduction emergent from `B` + disconnection; `F` for propagules; Weismannian germline;
divergence angle δ as the single 2D/3D switch.

Also settled: **one instruction per tip per tick, gated on resources, with the economy tuned
slower than the clock** — so developmental rate is set by the economy and the tick is only a
ceiling. And the goal is **diversity** — distinct coexisting growth forms — which makes
graded light, spatial heterogeneity, gaps and local dispersal structural requirements rather
than refinements. Both are written up in `MODEL.md`.

Nothing now blocks Stage 1. Remaining open items, none blocking:
- [ ] δ: face-selection rule on a lattice (quantised) — how much of it is evolvable
- [ ] Transpiration rate; gap size distribution; monocarpic senescence
- [ ] Angled day-sweeping light (costed, deferred); day/night intensity (rejected for v1)
- [ ] Calibrating "slower than the clock" — the numbers, not the rule (Stage 3's main job)
- [ ] τ, per-leaf transmittance — sets how deep an understory can be
- [ ] Cell death/decay and matter return; disturbance regime (random / patch / seasonal /
      emergent-only)
- [ ] Collision rule (stall / die / grow through; self vs. other-plant)
- [ ] Per-tip maintenance — out of v1; geometry caps branching, so this is an optional
      apical-dominance refinement, not a safeguard
- [ ] Environmental sensing / tropisms / a conditional symbol — the largest expressive gap,
      deliberately deferred (see Stage 6)
- [ ] Continuous space — kept open by the δ design, not yet costed

**Done when:** — met 2026-08-27. Stage 1 may begin.

---

## Stage 1 — Grid + resource CA, no plants  [ DONE ]
Build and verify the environment alone, before any genome code exists.
- [x] Grid, cell types, soil/air layout in `world.js`; tunables into `params.js`
- [x] **Two water sources**: a water table diffusing upward, and episodic rain wetting the
      surface. Uptake consumes both. This is Walter's two-layer mechanism and it is the
      strongest single source of niche structure in the model.
- [x] **Spatially heterogeneous** moisture/terrain — a required feature, not a later polish
- [x] **Graded** light: top-down transmittance sweep with per-leaf τ, not a binary shadow
- [x] Observer renders the grid (moisture, light and cell-type views)
- [x] `datamanager` records the field statistics
- [x] **Field capacity** — not in the original plan, added because it had to be. Without it
      every cell drains into the table and the whole profile goes dry (measured: moisture
      ≈0 above 7 rows from the table), which deletes the deep layer and with it half of
      Walter's mechanism. Only moisture above field capacity drains.
- ~~Transpiration~~ — moved to Stage 3. It is a *plant-level* drain and there are no plants
  yet; implementing it here would mean faking a leaf→soil path that Stage 3 would undo.
**Done when:** — met 2026-08-27. `smoketest.mjs` asserts 9 invariants, all passing: field
convergence (net Δ 1.9e-6/tick after 4000 ticks), monotone depth profile, τ^k light
attenuation to 6e-9, shade graded and non-zero under 5 leaves, rain spiking then decaying,
the two layers distinguishable, seed reproducibility, and root uptake as a real sink.
No genome code exists.

## Stage 2 — Tips and the instruction set  [ DONE ]
- [x] `Tip`: position, heading, read head, per-tip working copy
- [x] **Tips are local accumulators**: a tip draws its node's water and sugar into itself
      and builds when it has banked enough. Never a shared plant pool.
- [x] `B` fails when the node has no free face (≤5 branches per node in 3D, ≤3 in 2D)
- [x] `G` / `R` / `S` / `L` with positional cell fate
- [x] `B` fork semantics, δ as a lattice face-selection rule, concurrent tips
- [x] `!` / `@` / `*` with `!` as loop origin and `@` consumed
- [x] Hard step cap as a batch-run backstop only (the economy is the real halting condition)
**Done when:** a hand-written genome zoo (≥6 genomes covering a counted `@` loop, an `!`-
delimited two-phase program, a `*` indeterminate meristem, a `B` recursion, an `R` override
and an `S` override) grows to reproducible, distinct morphologies from a fixed seed; the
counted-loop identities in `MODEL.md` hold exactly (`G!L@@@S` → `GLLLLS`,
`G!L@@!S@@@F` → `GLLLSSSSF`, `G@@@` → `GGGG`); and `B*` caps at 4 tips on one node with 0
cells rather than proliferating.

**Added during Stage 2, not in the plan:** buds must **claim** a face, not merely find one
vacant. `B` originally checked only that the target face was empty, and since `B*` builds no
cells the faces stayed empty forever — tips reached 71,675 and were still doubling. A tip now
occupies one (cell, heading) slot, which is what actually enforces the geometric cap.

## Stage 3 — Couple growth to the economy  [ ACTIVE ]
- [x] Two pools; root uptake, leaf photosynthesis, graph-neighbour transport (sub-stepped)
- [x] **Transpiration** (moved from Stage 1): leaf area drains water every tick, growing or
      not. This is what makes drought lethal rather than merely slow, and therefore what
      makes root:shoot genuinely contested.
- [x] Growth gating; per-cell maintenance; per-symbol genome cost (per cell, so bloat is taxed with size)
- [x] One instruction per tip per tick, executed only if affordable; tips bank and wait
      (Stage 2 executes unconditionally — the gate is this stage's job)
- [x] **Storage organs** — built: `L` below ground makes a `STORE` cataphyll, loading fast and
      unloading slowly. It did NOT fix the overshoot (a local store cannot rescue a
      whole-plant deficit); faster leaf senescence does, at the cost of crown rise. See
      MODEL.md.
- [x] Whole-plant death and structural support: `alive` means has tissue, not has tips;
      cut-loose tissue falls. Fixes the floating stems/leaves left after a collapse.
- [ ] **Nutrients + litter** — deliberately deferred until after a first evolution run, so
      their contribution is measurable rather than baked in (same logic as the Stage 5
      ablations). Design: a third soil pool; dead cells become litter rather than vanishing;
      litter decays and restocks the soil; fallen leaves land on the surface. This closes a
      plant→soil feedback the model currently lacks, and adds a third niche axis. Adding it
      now would mean recalibrating a two-resource economy that is not yet stable.
      *(Original note: leading candidate fix for the overshoot instability, not only a
      life-history feature.)* `L` underground currently no-ops (suppressed, per etiolation). Real
      underground leaves are cataphylls — scale leaves, and a bulb is a stack of them. Making
      them sugar-storage cells would give storage as an evolvable trait using an existing
      symbol, which is what perennial overwintering, the seasonal storage effect, and
      tuber/bulb clonal propagules all need.
- [x] **Calibrated: 2.1% of tip-ticks execute.** — the main tuning job of this stage.
      Instrument the fraction of tip-ticks that actually execute; it should be well under 1.
- [x] Starvation, cell death, and local leaf senescence
**Done when:** — met 2026-08-28, all five criteria, 28/28 smoketest. Near the table 43 cells
vs 41 far from it; `*` halts on the economy (oldest live tip 2400 steps against a 4000 backstop);
2.1% of tip-ticks execute; **self-pruning observed** — lowest living leaf rises 2 → 7 with 17
cells shed and 9 roots retained, no rule saying prune.

**Stage 3 is NOT closed:** storage organs above is still open, and it is the candidate fix
for the instability below. The five acceptance criteria are met; the stage is not.

**Not resolved, and it blocks Stage 5:** the **overshoot instability** (MODEL.md). Response to
seed provisioning is non-monotone (`GL*`: 43 cells at seedSugar 2.5, 0 at 6, 9 at 12, 5 at 25),
and only 2 of 8 test genomes stay viable. Evolution needs a smoother landscape than that.
Candidate fix is **storage**; it is a decision, not an oversight.

## Stage 4 — Reproduction and inheritance  [ ACTIVE ]
- [x] `F` propagules, **local** dispersal kernel (exponential), dormancy, seed bank, germination
- [ ] Per-plant trait vector into the packet (height, width, root:shoot, leaf fraction,
      branch count, mean internode, genome length, clonal:sexual allocation, lifespan,
      realized fitness). **Store the vector, never a diversity scalar** — the measure will
      change and runs are expensive.
- [~] Graph disconnection on stem death → clonal individuals. **Implemented but not yet
      observed.** A cut-loose fragment that still touches ground becomes an independent
      ramet; one that does not, falls. But stem cells only die from starvation, and by the
      time a stem starves the whole plant is usually collapsing, so the fragment is rarely
      both anchored and viable. Real stolon disconnection is *programmed* — the connector
      senesces deliberately once the daughter has rooted — not a starvation event. Candidate
      fix: make `S`-forced tissue ephemeral (a stolon is an ephemeral connector by
      definition), which uses the existing override rather than a new symbol.
- [x] Weismannian germline (seed carries the untruncated genome); Lamarckian switch
- [x] Mutation operators: point, indel, `@`-run slippage, tandem duplication
**Done when:** a population sustains itself across generations from a single founder, both
reproductive modes are observed, and the germline/soma split is verified by a genome diff
between a heavily-truncated parent tip and its seed.

**Status: two of three met.** A population sustains itself and turns over (8 founders → 90
plants, 476 germinations, 394 plant deaths, 131 seeds banked by t=20000, 19 distinct genomes,
mean genome length stable at 13.4). The germline/soma split is verified exactly: germline
`GL@@@@@@!GLF*`, tips holding `GLF*` and `GL!GLF*` (differently truncated), seed carrying the
full germline; the Lamarckian switch flips it to `GLF*`. **Clonal reproduction is not yet
observed** — see the item above.

## Stage 5 — Evolution and diversity  [ PLANNED ]
The actual experiment: *do standard coexistence mechanisms still generate niches when
morphology is evolved rather than parameterised?* Headless batch via `runner.mjs`.
- [ ] Disturbance: random mortality and patch kills as **separate** knobs, with a gap size
      *distribution* — scattered single-cell death is not gap disturbance
- [ ] Water-source ablation (rain only / table only / both) — the two-layer prediction is
      that a deep-rooted and a shallow-rooted strategy coexist only in the third
- [ ] Diversity measured as **modality, not variance** — distinct morphospace clusters
      sustained above ~1% abundance across many generations, not a snapshot
- [ ] Ablation series: the four diversity mechanisms (graded light, heterogeneity, gaps,
      local dispersal) turned off one at a time. The prediction is that with all off the
      result is a monoculture height race; each mechanism's contribution is then measurable.
- [ ] Test the encoding's anisotropy prediction — growth *form* clustering discretely
      (`B`/`*` switches) while size varies continuously within form
- [ ] Plain-L-system control encoding, for the encoding comparison
- [ ] Instrument dead-code age vs. re-activation fitness (the `*` reservoir question)
**Done when:** there is a result worth writing down.

## Stage 6 — Sensing  [ PLANNED ]
Tropisms and/or a conditional symbol. Would let an indeterminate meristem become determinate
— floral induction. Deliberately after a first evolutionary result, so the cost of *not*
having it is measured rather than assumed.

## Stage 7 — 3D  [ PLANNED ]
δ already carries the encoding across. The real work is light: 3D breaks the O(width) column
trick, so voxel shadow accumulation or hemisphere sampling, and the cost may force 2D for
evolution runs with 3D as showcase/validation.

---

## Deferred
- ~~Spatial CO2~~ — global constant.
- ~~Outcrossing / two sexes~~ — deferred to after Stage 5; v1 is selfing/apomictic.
- ~~Named genes / reuse by reference~~ — `B` is a recursive self-call and already provides
  hierarchical reuse, which was most of what genes would have bought. Revisit only if
  evolution visibly stalls on structural complexity (Stage 5).

## Prior art to read before Stage 2
- Prusinkiewicz & Lindenmayer, *The Algorithmic Beauty of Plants*
- Měch & Prusinkiewicz, open (environment-sensing) L-systems
- Ray (Tierra); Ofria & Wilke (Avida) — linear self-modifying genomes
- Runions et al., space colonization — the contrast case
