# Plant World — STATUS
*One screen. The current pulse. Overwritten, never appended — for history read DEVLOG.*

**Updated:** 2026-11-13 — refreshed every session close; may carry unverified claims
**Verified:** never — no cold audit (`/audit`) has run yet; treat State as unverified

## Stage
DEVPLAN **Stage 4 — Reproduction and inheritance**  `[ ACTIVE ]`; **clonal reproduction is
implemented but not yet observed**. Stage 3 is still tokened `[ ACTIVE ]` though its criteria
are met (Backlog item to settle it). The 2026-11-13 session was presentation only: no model change.

## State
**Smoke 33/33 PASS @ af6d0a9-dirty (2026-11-13, pre-commit of the presentation session).**
*Browser page (2026-11-13, seen at 1600x1000 and 375 px, basic + paper themes):* Claude Basic
0.6.0 vendored in `vendor/`; world with legend and a 1000-tick dial; click a plant (or "Pick the
tallest plant") to read its germline and each tip's working copy with the read head; six founder
presets plus a free genome field; 8 front controls, 23 more behind a disclosure; a short
"how plants grow" panel; lines for plants/seed bank, births/deaths, distinct genomes, tissue;
heatmaps of height, root depth, genome length. Draw 0.58 ms/frame, tick 0.53 ms at ~74 plants.
*Model:* unchanged since 2026-08-28. Default founder `GL@@@!GLBF*`, 8 seeds: 137 plants, 931
births, 802 deaths at t=15000 (headless and browser agree). Environment: terrain, water table +
episodic rain, field capacity, graded light. **No day/night and no seasons, by design** (MODEL.md).
*Economy, reproduction, Weismann barrier:* as recorded 2026-08-28 (DEVLOG); not re-verified
beyond the smoke test.

## Metrics
- Smoke @600 ticks: meanMoisture 0.3742, shallow 0.3704, deep 0.3898, surfaceLight 1.000,
  totalWater 2771.9 (2026-11-13).
- Default run, headless, t=30000: 160 plants, 234 seeds banked, median height 6 (max 39),
  median root depth 3 (max 11), genome length 9-17, 33 distinct genomes (2026-11-13).
- Per-plant trait vectors are still not written to the packet. Store the vector, never a
  diversity scalar.

## Branches
- `main` — development. Pushed through b683228 (2026-11-13, Chris approved).
- `live` — what GitHub Pages serves (https://algorithm0r.github.io/Plant-World/). It still
  serves the Claude Basic page (b683228), verified live 2026-11-13: page runs, no console
  errors. Publish with `git push origin main:live` (Chris approves).
- tag `voxel-prototype-2023` — the June 2023 three.js prototype `main` was force-pushed over

## Open
- **Browser DB saves always fail** (`root is not defined`, `src/db.js` `getSocket()`); the live
  page has never written a packet. Upstream fix in the standard client, then `/refresh-db`.
- Kit findings for Claude Basic filed in the side-session notes (wide-stage grid, histmap has
  no y range, ordinal clock count, world-palette pattern). One bridge: the `.cb-sim` grid
  override in `index.html`.
- Non-blocking model items unchanged: δ scope, τ, disturbance regime, collision rule, gap size
  distribution, angled light (deferred), sensing (Stage 6), continuous space.

## Next action
Fix the `src/db.js` browser-save bug upstream. Then close Stage 4 by getting **clonal reproduction** to happen (candidate: make
`S`-forced tissue ephemeral), then Stage 5.

## Blockers
- **Overshoot instability (blocks Stage 5)**, as recorded 2026-08-28: response to seed
  provisioning is non-monotone and few test genomes stay viable. Storage was built and did not
  fix it. See MODEL.md.
