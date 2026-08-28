# Plant World — STATUS
*One screen. The current pulse. Overwritten, never appended — for history read DEVLOG.*

**Updated:** 2026-08-28 — refreshed every session close; may carry unverified claims
**Verified:** never — no cold audit (`/audit`) has run yet; treat State as unverified

## Stage
DEVPLAN **Stage 3 — Couple growth to the economy**  `[ ACTIVE ]`
(Stage 0 design, Stage 1 environment, Stage 2 genome/tips are `[ DONE ]`.)

## State
**Stages 1–2 run, in-browser and headless — `smoketest.mjs` 23/23 PASS @ 2026-08-28** (~100s).

*Environment:* heterogeneous terrain; two water sources (Dirichlet table + episodic patchy
rain); field-capacity drainage; moisture-dependent unsaturated conductivity; wilting-point-
scaled uptake; light-scaled evaporation; graded top-down light.

*Genome:* `G R S L B F ! @ *` executed per tip, one instruction per tick. Germination gives
two tips (up + down) reading one genome, and positional cell fate makes shoot above / root
below with no extra symbols. Six zoo genomes give distinct reproducible morphologies —
counted stalk, leafy axis with alternating phyllotaxis, heteroblastic two-phase plant,
recursive brancher, aerial roots, rhizome.

**Two-layer mechanism is measured, not assumed:** table-only, a root at depth 30 outdraws one
at depth 2 by ~90x; with rain the ranking inverts.

**No economy yet, by design** — tips execute unconditionally, so plants grow without limit
until they run off the tape or hit the geometric cap. Resource gating is Stage 3.

**Predicted failure mode, recorded before it happens:** built straightforwardly this model
gives a monoculture height race. Graded light, two water sources, gap-size-structured
disturbance and local dispersal are therefore structural requirements, not refinements.
Stage 5 ablates each and measures its contribution.

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
Stage 3 — two pools, transpiration, per-cell maintenance, and the resource gate; then
calibrate the economy slower than the clock. Acceptance includes **self-pruning**: shaded
lower branches dying of their own maintenance cost, producing crown rise with no rule for it.

## Blockers
- none
