# Plant World — STATUS
*One screen. The current pulse. Overwritten, never appended — for history read DEVLOG.*

**Updated:** 2026-08-28 — refreshed every session close; may carry unverified claims
**Verified:** never — no cold audit (`/audit`) has run yet; treat State as unverified

## Stage
DEVPLAN **Stage 2 — Tips and the instruction set**  `[ ACTIVE ]`
(Stage 0 design and Stage 1 environment are `[ DONE ]`.)

## State
**Stage 1 environment runs, in-browser and headless — `smoketest.mjs` 12/12 PASS @ 2026-08-28.**
Heterogeneous terrain; soil water with two sources (Dirichlet table + episodic patchy rain);
field-capacity drainage; moisture-dependent unsaturated conductivity; wilting-point-scaled
root uptake; light-scaled surface evaporation; graded top-down light. 0.27 ms/tick at 200x150.

**The two-layer mechanism is measured, not assumed:** table-only, a root at depth 30 outdraws
one at depth 2 by ~90x; with rain the ranking inverts. A sink genuinely draws from the table
(soil water flat while uptake continues); a dense root mat is supply-limited to 2% of demand.

**No genome code exists yet** — no tips, no instruction set, no plants.

**Predicted failure mode, recorded before it happens:** built straightforwardly this model
gives a monoculture height race. Graded light, two water sources, gap-size-structured
disturbance and local dispersal are therefore structural requirements, not refinements.
Stage 5 ablates each and measures its contribution.

## Metrics
- Environment @600 ticks, defaults: meanMoisture 0.297, shallow 0.367, deep 0.271,
  surfaceLight 1.000, totalWater 2904. Field converges to net delta 8.6e-6/tick.
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
Stage 2 — `Tip` as a local accumulator, the instruction set (`G R S L B F ! @ *`), `B`
failing when a node has no free face, and a genome zoo asserting the counted-loop identities.

## Blockers
- none
