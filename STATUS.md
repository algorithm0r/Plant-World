# Plant World — STATUS
*One screen. The current pulse. Overwritten, never appended — for history read DEVLOG.*

**Updated:** 2026-08-27 — refreshed every session close; may carry unverified claims
**Verified:** never — no cold audit (`/audit`) has run yet; treat State as unverified

## Stage
DEVPLAN **Stage 0 — Close the remaining model decisions**  `[ ACTIVE ]` — *design, not code.*

## State
Scaffold + a settled design. The demo "drifters" model from engine v2 runs in-browser and
headless — smoke PASS @ commit e1e26cd (2026-08-27). **No Plant World code exists yet.**

The model is now substantially designed and written into `MODEL.md`: purpose is evolution;
two resource pools with sugar-costed maintenance; a nine-symbol instruction tape
(`G R S L B F ! @ *`) executed per-tip with `B` as a concurrent fork; positional cell fate;
clonal reproduction emergent from branching + disconnection; Weismannian germline; one
divergence angle δ carrying the same encoding into 2D and 3D.

## Metrics
- (none — no model code yet; **the metric itself is still undecided** and blocks Stage 1)

## Branches
- `main`

## Open
- **Blocking Stage 1:** instructions-per-tick (constant vs. proportional to supply); and the
  metric that goes to `plantworldDB`.
- Non-blocking: δ scope, cell death/decay, collision rule, instruction cost schedule,
  whether the economy really bounds `B` recursion, sensing/tropisms (Stage 6), continuous
  space.

## Next action
Decide the two blocking items in DEVPLAN Stage 0, write them into `MODEL.md`, then Stage 1
(grid + resource CA, no plants).

## Blockers
- Two model decisions outstanding (by intent, not obstruction).
