# Plant World

A 2D cellular-automaton plant-growth model: L-system-style genomes read by active growth tips, layered on a soil-moisture + light resource CA.

A browser-based agent-based simulation (vanilla JS + Canvas, no build step), scaffolded from
the shared engine v2.

## Live demo
**https://algorithm0r.github.io/Plant-World/**

GitHub Pages serves the **`live`** branch, not `main` — so committing to `main` does NOT
update the site. Publishing is deliberate:

```
git push origin main:live
```

The published page uses the same `PARAMETERS.db` as everything else, so a visitor's browser
opens a socket to the research Server and the DataManager tries to write a packet at `epoch`.
**That write currently fails in every browser** (`root is not defined`, a scoping bug in the
vendored `src/db.js`, found 2026-11-13; not yet fixed). Disable `db.transport` if the socket
ever needs to stop.

History note: `main` was force-pushed over a June 2023 three.js voxel prototype of the same
project. That commit is preserved as the tag `voxel-prototype-2023`.

## Run
- **Browser:** open `index.html` (locally: http://localhost:8000/research/Plant%20World/sim/).
  Click a plant to read its genome; pick or type a founder genome and press Sow.
- **Headless batch:** `node runner.mjs --reps 50` — runs the same sim core in the main V8 realm
  (indirect `eval`, not `vm` — avoids vm's hot-loop tax; see `~/.claude/conventions.md` §4) and
  writes self-describing packets to MongoDB through the research Server.
- **Smoke test:** `node smoketest.mjs` — no DB; asserts the model invariant and prints metrics.

## Layout
- `src/` — sim core (`engine`, `params`, `world`, `plant`, `tip`, `observer`, `datamanager`,
  `util`) + `db.js` (vendored standard DB client) + `ui.js`/`main.js` (browser-only, all DOM).
- `vendor/` — Claude Basic 0.6.0, a pinned copy of the shared UI kit's `dist/`. Never edit it;
  re-vendor from `Claude's Space/Claude Basic` to upgrade.
- `runner.mjs` / `smoketest.mjs` — headless entry points.
- `DEVPLAN.md` / `DEVLOG.md` — the plan (forward) and the log (backward, append-only).

See `~/.claude/conventions.md` for the shared standards this follows.
