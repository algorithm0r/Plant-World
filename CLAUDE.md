# Plant World — Claude instructions

## Read first, every session
1. `STATUS.md` — where the system is right now (the 60-second orient)
2. `DEVLOG.md` — the top entry (what changed last)
3. `DEVPLAN.md` — the current `[ ACTIVE ]` stage
4. `MODEL.md` — the design bible (amended in place). **Read it before touching `src/`.**

## What this is
A 2D cellular-automaton plant-growth model: genomes are instruction tapes read by concurrent
growth tips, layered on a soil-moisture + light resource CA. The goal is **evolved
diversity** — distinct coexisting growth forms, niches arising from the dynamics rather than
assumed. Stage 0 (the model design) is `[ DONE ]`; building has begun.

## Model rules that are decisions, not details
Changing any of these changes the results. If one looks wrong, raise it — don't quietly
"fix" it. Rationale for each is in `MODEL.md`.
- **This is not an L-system.** Tape + read head + program counter per tip; development *is*
  execution. `B` is a concurrent fork, not a bracket. There is no stack.
- **The language is permissive; the economy is what constrains.** Bloat, plant size,
  branching ratio, seed number — every limit goes in the resource economy, never the grammar.
- **No lethal sites.** No symbol may, by single-point appearance, kill the organism. This is
  why there is no end-of-tip symbol, and why `*` must never be "repaired" by truncating
  after it.
- **Tips draw from the local cell's pool, never a shared plant pool.** This forecloses the
  proliferate-meristems exploit and is what makes self-pruning work.
- **Light is graded, not binary.** A binary shadow deletes the understory niche and with it
  any chance of stratification.
- **Store trait vectors, never a diversity scalar.** The measure will change; runs are
  expensive.

## Stack (never violate)
- Vanilla JS + Canvas. No build step, no framework, no modules. `<script>` tags load
  `src/` in dependency order (`main.js` last).
- **Shared things are top-level `var`** — including `var Foo = class Foo {}`. This is what
  lets the SAME `src/` files run in the browser AND headless: the runners strip `'use strict'`
  and load them into the **main V8 realm via indirect `eval`** (not `vm`), where top-level
  `var` attaches to `globalThis` (a bare `class`/`const` would be block-scoped and never
  attach). Main-realm, not `vm`, because `vm` adds a ~7-10x hot-loop tax on per-tick global
  reads and we never need its sandbox isolation (conventions §4). Never fork the sim core.
- **All DOM lives in `ui.js` + `index.html`.** Sim classes (`world`, `agent`, `observer`,
  `datamanager`) touch zero DOM — that's what keeps them headless-safe.
- **Model/view split:** the world holds state and never draws; the `Observer` renders it.
- **Config:** one `PARAMETERS` global (`params.js`), serialized verbatim into every saved
  packet. `PARAM_SCHEMA` drives the control panel.
- **DB:** the vendored standard client `src/db.js` (see `~/.claude/conventions.md` §4).
  Use `db.packet()`, `db.nextBatch()`, and `db.scratch()` for throwaway work.

## Conventions
Follow `~/.claude/conventions.md`. STATUS is overwritten every close (present truth); DEVLOG is
append-only, newest on top (history); DEVPLAN stages carry `[ DONE ] / [ ACTIVE ] / [ PLANNED ]`
tokens and a `**Done when:**` criterion. `/log-session` rewrites STATUS — don't hand-edit its
`Verified:` line (that moves only on a cold `/audit`).

## Run
- Browser: open `index.html`.
- Headless batch: `node runner.mjs --reps N` (writes to MongoDB via the Server).
- Smoke (no DB): `node smoketest.mjs` — prints the numbers that go in the DEVLOG entry.
