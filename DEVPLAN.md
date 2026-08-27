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

## Stage 0 — Close the remaining model decisions  [ ACTIVE ]  *(design, not code)*

Settled 2026-08-27 (recorded in `MODEL.md`): purpose is **evolution**; two resource pools
(water + sugar) with maintenance costing sugar; light modelled, CO2 not; `!` per-tip;
`@` consumed as a unary counter with `!` as the loop origin; `*` added for indeterminate
growth; `]` dropped and the **no-lethal-sites** rule adopted in its place; `[` → `B` with
fork semantics and no stack; positional cell fate via `G` with `R`/`S` overrides; clonal
reproduction emergent from `B` + disconnection; `F` for propagules; Weismannian germline;
divergence angle δ as the single 2D/3D switch.

Still open — **blocking Stage 1:**
- [ ] **Instructions per tick** — constant, or proportional to resource supply? Decides what
      genome length means in time, and therefore what the tick loop looks like.
- [ ] **The metric** — the number that goes to `plantworldDB`. `datamanager.js` and the
      smoketest invariant are both built around it, so it cannot be deferred.

Still open — **not blocking:**
- [ ] δ: one float per genome or per branch point
- [ ] Cell death/decay and matter return
- [ ] Collision rule (stall / die / grow through; self vs. other-plant)
- [ ] Instruction cost schedule (flat vs. depth/age-scaled)
- [ ] Whether the economy actually bounds `B` recursion at plausible branching ratios —
      **check this early**, it is an assumption the design leans on
- [ ] Environmental sensing / tropisms / a conditional symbol — the largest expressive gap,
      deliberately deferred (see Stage 6)
- [ ] Continuous space — kept open by the δ design, not yet costed

**Done when:** the two blocking items are decided and written into `MODEL.md`.

---

## Stage 1 — Grid + resource CA, no plants  [ PLANNED ]
Build and verify the environment alone, before any genome code exists.
- [ ] Grid, cell types, soil/air layout in `world.js`; tunables into `params.js`
- [ ] Moisture diffusion from the water table; uptake consumes it
- [ ] Light / column shadowing, with hand-placed static obstacles as the test fixture
- [ ] Observer renders the grid; `datamanager` records a field statistic
**Done when:** moisture reaches a stable profile from a known initial condition, a
hand-placed obstacle casts the shadow it should, and `smoketest.mjs` asserts both
numerically. No genome code anywhere yet.

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
- [ ] Starvation and tip death
**Done when:** a genome grown at the water table outperforms the identical genome grown far
from it, measured not eyeballed; and a `*` meristem provably self-terminates at the point
where marginal sugar gain meets marginal maintenance, rather than at a step cap.

## Stage 4 — Reproduction and inheritance  [ PLANNED ]
- [ ] `F` propagules, dispersal kernel, dormancy, germination
- [ ] Graph disconnection on stem death → clonal individuals
- [ ] Weismannian germline (seed carries the untruncated genome); Lamarckian switch
- [ ] Mutation operators incl. `@`-run slippage and subtree duplication
**Done when:** a population sustains itself across generations from a single founder, both
reproductive modes are observed, and the germline/soma split is verified by a genome diff
between a heavily-truncated parent tip and its seed.

## Stage 5 — Evolution  [ PLANNED ]
The actual experiment. Populations under light and water competition; measure what forms and
strategies appear. Headless batch via `runner.mjs`.
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
