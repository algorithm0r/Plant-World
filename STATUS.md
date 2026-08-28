# Plant World — STATUS
*One screen. The current pulse. Overwritten, never appended — for history read DEVLOG.*

**Updated:** 2026-08-28 — refreshed every session close; may carry unverified claims
**Verified:** never — no cold audit (`/audit`) has run yet; treat State as unverified

## Stage
DEVPLAN **Stage 4 — Reproduction and inheritance**  `[ ACTIVE ]`.
Four of five items done; **clonal reproduction is implemented but not yet observed**.
Stage 3 closed with storage built (it did not fix the overshoot — see MODEL.md).

## State
**Stages 1-4 run, in-browser and headless — `smoketest.mjs` 33/33 PASS @ 2026-08-28.**
Browser demo sows the founder `GL@@@@@@!GLF*`; ~15 s of watching gives 57 plants, 119 born,
70 died, 48 seeds banked. Tick cost 0.57 ms at 141 plant cells, 1.43 ms at 1922.

*Environment:* heterogeneous terrain; two water sources (table + episodic rain); field
capacity; moisture-dependent conductivity; wilting-point uptake; graded light.

*Genome:* `G R S L B F ! @ *` per tip; two tips per germination; positional cell fate.

*Economy:* two per-cell pools; photosynthesis requires water; transpiration; sub-stepped
transport; per-cell maintenance with a genome-length surcharge; storage (`L` below ground
builds a cataphyll that loads fast and unloads slowly); local leaf senescence; structural
support, so cut-loose tissue falls.

*Reproduction:* `F` mutates the parent germline, disperses it by a local exponential kernel
into a seed bank with dormancy, and germinates onto bare surface. Mutation is point, indel,
`@`-run slippage and tandem duplication.

**Verified emergent:** a self-sustaining population with turnover — 8 founders → 90 plants,
476 germinations, 394 deaths, 19 distinct genomes by t=20000, genome length stable at 13.4.
**Weismann's barrier**, which nobody coded: `!` is per-tip and somatic, so tips held `GLF*`
and `GL!GLF*` while the seed carried the full germline `GL@@@@@@!GLF*`.

**Predicted failure mode, still recorded:** built straightforwardly this model gives a
monoculture height race. Graded light, two water sources, gap-size disturbance and local
dispersal are structural requirements. Stage 5 ablates each.

## Metrics
- Environment @600 ticks, defaults: meanMoisture 0.297, shallow 0.367, deep 0.271,
  surfaceLight 1.000, totalWater 2904. Field converges to net delta 8.6e-6/tick.
- Demo genome `GGGGGG!GLB*`, 3 seeds, 200 ticks: 16471 plant cells (3361 leaf, 9377 root,
  3733 stem), 9954 live tips, max height 55. 217 ms. Unbounded because Stage 3 is not built.
- Per-plant records decided but not yet written: a **trait vector**, never a diversity
  scalar. Diversity computed post hoc, measured as **modality, not variance**.

## Branches
- `main` — development
- `live` — what GitHub Pages serves (https://algorithm0r.github.io/Plant-World/).
  Publish with `git push origin main:live`; pushing `main` alone does NOT update the site.
- tag `voxel-prototype-2023` — the June 2023 three.js prototype `main` was force-pushed over

## Open
- Nothing blocking. Non-blocking: δ scope; calibrating "slower than the clock" (Stage 3);
  τ per-leaf transmittance; cell death/decay and disturbance regime; collision rule;
  transpiration rate; gap size distribution; monocarpic senescence; angled day-sweeping
  light (costed, deferred; day/night intensity rejected for v1); sensing/tropisms (Stage 6); continuous space.

## Next action
Close Stage 4 by getting **clonal reproduction** to actually happen, then Stage 5. Stem cells
only die from starvation, and a starving plant rarely leaves a fragment that is both anchored
and viable — whereas real stolon disconnection is programmed, not a starvation event.
Candidate: make `S`-forced tissue ephemeral, since a stolon is an ephemeral connector by
definition and `S` already exists.

## Blockers
- **Overshoot instability (blocks Stage 5).** Tips commit to cells on a local bank with no
  reference to whole-plant carrying capacity; transport keeps cell sugar even, so an
  overbuilt plant crosses the debt threshold everywhere at once and collapses instead of
  shedding gracefully. Measured: peak 99 cells → final 0 at low transpiration. Water
  throttling is currently the only thing preventing carbon overshoot, which is an accident
  rather than a mechanism. Response to seed provisioning is **non-monotone** (`GL*`: 43 / 0 /
  9 / 5 cells at seedSugar 2.5 / 6 / 12 / 25) and only 2 of 8 test genomes stay viable — too
  close to noise for evolution to produce an interpretable result.
  **Candidate fix: storage.** See MODEL.md. This is a decision, not an oversight.
