# Plant World — STATUS
*One screen. The current pulse. Overwritten, never appended — for history read DEVLOG.*

**Updated:** 2026-08-28 — refreshed every session close; may carry unverified claims
**Verified:** never — no cold audit (`/audit`) has run yet; treat State as unverified

## Stage
DEVPLAN **Stage 3 — Couple growth to the economy**  `[ DONE ]`, but see Blockers.
Stage 4 (reproduction) is next; a **storage** decision should come first.

## State
**Stages 1-3 run, in-browser and headless — `smoketest.mjs` 28/28 PASS @ 2026-08-28.**

*Environment:* heterogeneous terrain; two water sources (table + episodic rain); field
capacity; moisture-dependent conductivity; wilting-point-scaled uptake; graded light.

*Genome:* `G R S L B F ! @ *` per tip. Germination gives two tips (up + down) reading one
genome; positional cell fate makes shoot above / root below with no extra symbols.

*Economy:* two per-cell pools; photosynthesis requires water; transpiration drains leaves
whether growing or not; sub-stepped transport; per-cell maintenance with a genome-length
surcharge; growth gated on the tip being able to pay. **2.1% of tip-ticks execute** — the
economy is the halting condition, not the clock.

**Emergent and verified:** self-pruning with crown rise — the lowest living leaf rises 2 → 7
as shaded leaves fall below their own compensation point, 17 cells shed, 9 roots retained,
with no rule saying prune. Also: near the table 43 cells vs 41 far from it; `*` meristems halt
on the economy (oldest live tip 2400 steps vs a 4000 backstop).

**Predicted failure mode, still recorded:** built straightforwardly this model gives a
monoculture height race. Graded light, two water sources, gap-size-structured disturbance and
local dispersal are structural requirements. Stage 5 ablates each.

## Metrics
- Environment @600 ticks, defaults: meanMoisture 0.297, shallow 0.367, deep 0.271,
  surfaceLight 1.000, totalWater 2904. Field converges to net delta 8.6e-6/tick.
- Demo genome `GGGGGG!GLB*`, 3 seeds, 200 ticks: 16471 plant cells (3361 leaf, 9377 root,
  3733 stem), 9954 live tips, max height 55. 217 ms. Unbounded because Stage 3 is not built.
- Per-plant records decided but not yet written: a **trait vector**, never a diversity
  scalar. Diversity computed post hoc, measured as **modality, not variance**.

## Branches
- `main`

## Open
- Nothing blocking. Non-blocking: δ scope; calibrating "slower than the clock" (Stage 3);
  τ per-leaf transmittance; cell death/decay and disturbance regime; collision rule;
  transpiration rate; gap size distribution; monocarpic senescence; angled day-sweeping
  light (costed, deferred; day/night intensity rejected for v1); sensing/tropisms (Stage 6); continuous space.

## Next action
Decide on **storage** before Stage 4. A pool that absorbs surplus rather than converting it
straight into tissue, and is drawn down during deficit, damps the overshoot oscillation — and
is the same mechanism perennial overwintering, the seasonal storage effect and tuber/bulb
propagules need. `L` underground (currently a no-op) is the natural home for it: real
underground leaves are cataphylls, and a bulb is a stack of them.

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
