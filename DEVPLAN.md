# Plant World — DEVPLAN
*Living document, not frozen. Update as the design evolves.*

`MODEL.md` is the design bible — read it first; it carries the rationale, this file carries
the work. The model is now substantially settled (design session 2026-08-27). Stage 0 is
still `[ ACTIVE ]`: a short list of genuinely open decisions remains, and two of them
(instructions-per-tick, the metric) must close before Stage 1 code is written.

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
- [ ] δ: one float per genome or per branch point
- [ ] Calibrating "slower than the clock" — the numbers, not the rule (Stage 3's main job)
- [ ] τ, per-leaf transmittance — sets how deep an understory can be
- [ ] Cell death/decay and matter return; disturbance regime (random / patch / seasonal /
      emergent-only)
- [ ] Collision rule (stall / die / grow through; self vs. other-plant)
- [ ] Instruction cost schedule — `B` is known to need to be expensive
- [ ] Whether the economy actually bounds `B` recursion at plausible branching ratios —
      **check this early**, it is an assumption the design leans on
- [ ] Environmental sensing / tropisms / a conditional symbol — the largest expressive gap,
      deliberately deferred (see Stage 6)
- [ ] Continuous space — kept open by the δ design, not yet costed

**Done when:** — met 2026-08-27. Stage 1 may begin.

---

## Stage 1 — Grid + resource CA, no plants  [ ACTIVE ]
Build and verify the environment alone, before any genome code exists.
- [ ] Grid, cell types, soil/air layout in `world.js`; tunables into `params.js`
- [ ] Moisture diffusion from the water table; uptake consumes it
- [ ] **Spatially heterogeneous** moisture/terrain — a required feature, not a later polish
- [ ] **Graded** light: top-down transmittance sweep with per-leaf τ, not a binary shadow
- [ ] Observer renders the grid (moisture and light fields both visible)
- [ ] `datamanager` records a field statistic
**Done when:** moisture reaches a stable profile from a known initial condition; a
hand-placed obstacle column produces the *graded* light profile it should (monotone decay
with depth, matching τ^n within tolerance — not merely "dark below"); and `smoketest.mjs`
asserts both numerically. No genome code anywhere yet.

## Stage 2 — Tips and the instruction set  [ PLANNED ]
- [ ] `Tip`: position, heading, read head, per-tip working copy, resource share
- [ ] `G` / `R` / `S` / `L` with positional cell fate
- [ ] `B` fork semantics, δ roll, concurrent tips
- [ ] `!` / `@` / `*` with `!` as loop origin and `@` consumed
- [ ] Hard step cap as a batch-run backstop only (the economy is the real halting condition)
**Done when:** a hand-written genome zoo (≥6 genomes covering a counted `@` loop, an `!`-
delimited two-phase program, a `*` indeterminate meristem, a `B` recursion, an `R` override
and an `S` override) grows to reproducible, distinct morphologies from a fixed seed — and
the counted-loop identities in `MODEL.md` hold exactly (`A ! B @@@ C` → `A;BBBB;C`).

## Stage 3 — Couple growth to the economy  [ PLANNED ]
- [ ] Two pools; root uptake, leaf photosynthesis, graph-neighbour transport
- [ ] Liebig-minimum growth gating; per-cell maintenance; per-symbol genome cost
- [ ] One instruction per tip per tick, executed only if affordable; tips bank and wait
- [ ] **Calibrate the economy slower than the clock** — the main tuning job of this stage.
      Instrument the fraction of tip-ticks that actually execute; it should be well under 1.
- [ ] Starvation and tip death
**Done when:** a genome grown at the water table outperforms the identical genome grown far
from it, measured not eyeballed; a `*` meristem provably self-terminates where marginal sugar
gain meets marginal maintenance rather than at a step cap; `B` recursion is bounded by cost
at a plausible branching ratio; and **self-pruning is observed** — shaded lower branches dying
of their own maintenance cost, producing crown rise without any rule that says so.

## Stage 4 — Reproduction and inheritance  [ PLANNED ]
- [ ] `F` propagules, **local** dispersal kernel, dormancy, germination
- [ ] Per-plant trait vector into the packet (height, width, root:shoot, leaf fraction,
      branch count, mean internode, genome length, clonal:sexual allocation, lifespan,
      realized fitness). **Store the vector, never a diversity scalar** — the measure will
      change and runs are expensive.
- [ ] Graph disconnection on stem death → clonal individuals
- [ ] Weismannian germline (seed carries the untruncated genome); Lamarckian switch
- [ ] Mutation operators incl. `@`-run slippage and subtree duplication
**Done when:** a population sustains itself across generations from a single founder, both
reproductive modes are observed, and the germline/soma split is verified by a genome diff
between a heavily-truncated parent tip and its seed.

## Stage 5 — Evolution and diversity  [ PLANNED ]
The actual experiment: *do standard coexistence mechanisms still generate niches when
morphology is evolved rather than parameterised?* Headless batch via `runner.mjs`.
- [ ] Disturbance/gap regime
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
