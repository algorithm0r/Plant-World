# Plant World — STATUS
*One screen. The current pulse. Overwritten, never appended — for history read DEVLOG.*

**Updated:** 2026-08-27 — refreshed every session close; may carry unverified claims
**Verified:** never — no cold audit (`/audit`) has run yet; treat State as unverified

## Stage
DEVPLAN **Stage 1 — Grid + resource CA, no plants**  `[ ACTIVE ]`
(Stage 0, the model design, is `[ DONE ]`.)

## State
Scaffold + a settled design; no Plant World code yet. The demo "drifters" model from engine
v2 runs in-browser and headless — smoke PASS @ commit e1e26cd (2026-08-27).

The model is designed and written into `MODEL.md`: goal is **evolved diversity** — distinct
coexisting growth forms, niches from dynamics rather than assumption. Two resource pools with
sugar-costed maintenance; one instruction per tip per tick, gated on resources, economy tuned
slower than the clock; nine-symbol tape (`G R S L B F ! @ *`) with `B` as a concurrent fork;
positional cell fate; clonal reproduction emergent from branching + disconnection;
Weismannian germline; δ carries the encoding into both 2D and 3D.

**Predicted failure mode, recorded before it happens:** built straightforwardly this model
gives a monoculture height race. Graded light, spatial heterogeneity, gaps and local
dispersal are therefore structural requirements, not refinements. Stage 5 ablates them.

## Metrics
- (none — no model code yet). The DB record is decided: a **per-plant trait vector**, never a
  diversity scalar. Diversity is computed post hoc, measured as **modality, not variance**.

## Branches
- `main`

## Open
- Nothing blocking. Non-blocking: δ scope; calibrating "slower than the clock" (Stage 3);
  τ per-leaf transmittance; cell death/decay and disturbance regime; collision rule;
  instruction cost schedule (`B` must be expensive); whether the economy really bounds `B`
  recursion — **check early**; sensing/tropisms (Stage 6); continuous space.

## Next action
Stage 1 — grid, heterogeneous moisture, graded light. Verify the environment numerically
before any genome code exists.

## Blockers
- none
