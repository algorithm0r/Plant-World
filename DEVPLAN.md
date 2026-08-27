# Plant World — DEVPLAN
*Living document, not frozen. Update as the design evolves.*

**Status of this plan: ROUGH.** The model is not settled. `MODEL.md` (the skeleton Chris
wrote) is the guiding document, and it is explicitly incomplete. Stage 0 below is a design
conversation, not code. **Do not start Stage 1 until Stage 0 is resolved and this plan has
been rewritten with the decisions in it.**

## Built
- Scaffolded from engine v2 (vanilla-JS canvas + standard DB client). Demo "drifters"
  model runs in-browser and headless. Nothing plant-related exists yet.

## Not yet built
- Everything. The grid, the genome interpreter, the tips, the resource CA, the metrics.

---

## Stage 0 — Settle the model  [ ACTIVE ]  *(design, not code)*

The skeleton gives a shape but leaves the load-bearing decisions open. These are the ones
that determine what the code has to be, grouped by how much they constrain the architecture.

### 0.1 What is the model *for*? (decide first — everything else falls out)
The skeleton describes a mechanism but not a question. Candidates, which imply very
different builds:
- **(a) Generative / morphological.** Can this genome encoding + environment produce a
  plausible variety of plant morphologies? Success = the pictures look like plants. No
  evolution needed; a hand-written genome zoo suffices.
- **(b) Evolutionary.** Does selection in a resource-limited environment produce
  recognisable plant strategies — height races, branching investment, root/shoot
  allocation, shade avoidance? Success = a fitness/strategy result. Needs a population,
  reproduction, mutation, many generations → performance matters a lot.
- **(c) Ecological.** Given fixed genomes, what community structure emerges from
  competition for light and water? Success = coexistence/exclusion patterns.
- **(d) Encoding-theoretic.** What do the `@`/`!` self-modifying read-head operators buy
  that a plain L-system doesn't — evolvability, compression, modularity? Success = a
  comparison against a control encoding.

`@` and `!` are the most unusual thing in the skeleton, which points at (d) or (b).
**Open question for Chris.**

### 0.2 Genome / interpreter semantics (the skeleton's own open questions, plus)
- [ ] **Is `!` per-tip or organism-wide?** Per-tip = a developmental mechanism (each branch
  specialises its own program). Organism-wide = somatic mutation, and then: heritable
  (Lamarckian) or discarded at reproduction? These are different models.
- [ ] **`@` on a truncated string.** After `!` cuts the prefix, does `@` jump to index 0 of
  the *working copy* or of the original? The `@`×`!` interaction is where all the expressive
  power — and all the infinite loops — live.
- [ ] **Termination.** `@` makes every genome potentially non-halting. What stops a tip —
  resource starvation only, max age, max cell count, collision? Needs a hard answer before
  anything runs, or batch runs hang.
- [ ] **Branch angle:** fixed 90°, evolvable per-genome parameter, or phyllotactic 137.5°?
  Related: is heading continuous (float radians) or lattice-quantised (4 or 8 directions)?
  **This decides whether the model is a true lattice CA or a continuous geometry rasterised
  onto a grid** — the single biggest architectural fork here. 137.5° forces the latter.
- [ ] **Collision.** What happens when a tip grows into an occupied cell — stall, die,
  overwrite, grow through? Self-collision vs. other-plant collision may differ.
- [ ] **Instruction costs.** Flat per symbol, or scaling with depth/age/distance from root?
  And is there a **maintenance cost per living cell**? That is usually what makes size
  expensive and produces interesting allocation trade-offs.
- [ ] Does the alphabet need explicit turn symbols (`+`/`-`) separate from `[`, or is
  turning always bundled into branch/leaf placement as the skeleton implies?

### 0.3 Physiology (the skeleton abstracts this hard)
- [ ] **One pool or two?** The skeleton says `resource_pool (water/sugar)` — one number. But
  roots make water and leaves make sugar, and the interesting trade-off (root vs. shoot
  investment) only exists if they are **separate and both required**. Two pools with a
  Liebig-minimum growth rule is a small change with a large effect on results.
- [ ] **Transport.** "Average with plant-neighbours each tick" is diffusion. Enough, or does
  it need directionality (xylem up / phloem down)? Diffusion is cheap and probably fine for
  v1 — but it means tall plants are automatically penalised by transport lag, which may be a
  feature rather than a bug. Decide which.
- [ ] **Water budget.** Is soil moisture *consumed* (finite, recharging table) or is the
  source infinite? Finite = root competition is real. Infinite = light is the only contested
  resource, and (c) has almost nothing to say.
- [ ] **Light.** The top-down column shadow is O(W) and correct for vertical light. Does it
  need an angle, partial transmission through leaves (Beer–Lambert), or accumulation over a
  day cycle? Column shadowing first; note the ceiling here so we know when we hit it.
- [ ] **Death / decay.** Do cells die? Does a dead plant return matter to the soil? Without
  this there is no turnover and long runs just fill the grid.

### 0.4 Reproduction (absent from the skeleton; required for (b) and (c))
- [ ] What triggers seed production — accumulated surplus, a genome symbol, age?
- [ ] Dispersal: local, kernel, uniform? Seed bank / dormancy?
- [ ] Mutation operators on a *string* genome: point substitution, insertion, deletion,
  **duplication of a bracketed subtree**. That last one generates hierarchy and is a large
  part of why string genomes are interesting.
- [ ] Generational or overlapping/continuous time?

### 0.5 Scale and measurement
- [ ] Grid size, number of plants, ticks per run. Determines whether the browser canvas is
  the primary view or just a debug view for headless batches.
- [ ] **The metric.** What number goes into `plantworldDB`? Candidates: biomass, height,
  branch count, leaf-area index, genome length, a morphological diversity index, fitness.
  Whatever it is, it must exist before Stage 1 — `datamanager.js` and the smoketest
  invariant are both built around it.

**Done when:** 0.1 has an answer; each box in 0.2–0.5 is decided or explicitly deferred with
a forward pointer; `MODEL.md` is amended in place to record the decisions; and this DEVPLAN
is rewritten with real stages.

---

## Stage 1 — Grid + resource CA, no plants  [ PLANNED ]
Build the environment alone and verify it before any genome code exists.
- [ ] Grid, cell types, soil/air layout in `world.js`; tunables into `params.js`
- [ ] Moisture diffusion from the water table
- [ ] Light / column shadowing, with hand-placed static obstacles as the test fixture
- [ ] Observer renders the grid; `datamanager` records a field statistic
**Done when:** moisture reaches a stable profile from a known initial condition, a
hand-placed obstacle casts the shadow it should, and `smoketest.mjs` asserts both
numerically. No genome code anywhere yet.

## Stage 2 — Genome interpreter + tips  [ PLANNED ]
- [ ] `Tip` (position, heading, read-head, pools, working genome copy)
- [ ] Symbol execution incl. `[` `]` `@` `!` per the Stage 0 decisions
- [ ] Termination guards (0.2)
- [ ] Growth gated on resource cost
**Done when:** a hand-written genome zoo (≥5 genomes, at least one using `@` and one using
`!`) grows to reproducible, distinct, terminating morphologies from a fixed seed.

## Stage 3 — Couple growth to physiology  [ PLANNED ]
- [ ] Root uptake, leaf photosynthesis, transport
- [ ] Growth genuinely limited by the pools; starvation
**Done when:** a plant grown at the water table outperforms an identical genome grown far
from it, measured rather than eyeballed.

## Stage 4 — *(depends entirely on 0.1)*  [ PLANNED ]
Reproduction + mutation + selection if the answer is (b) or (c); a systematic morphology
sweep if (a); an encoding comparison against a plain L-system control if (d).

---

## Deferred
- ~~3D~~ — 2D only. Revisit only if a result demands it (3D breaks the O(W) light trick).
- ~~Spatial CO2~~ — global constant, per the skeleton.

## Prior art to read before Stage 2
- Prusinkiewicz & Lindenmayer, *The Algorithmic Beauty of Plants*
- Měch & Prusinkiewicz, open (environment-sensing) L-systems — the closest existing work to
  this whole model; the resource-CA coupling is essentially their contribution
- Runions et al., space colonization — the alternative to genome-driven branching, worth
  knowing as the contrast case
