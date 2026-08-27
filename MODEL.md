<!-- Design bible: amended in place, NOT append-only (conventions taxonomy rule).
     Origin: plant-world-model-skeleton.md, written by Chris 2026-08-27.
     INCOMPLETE by design — the open decisions live in DEVPLAN Stage 0. -->

# Plant World — Model Skeleton (2D Prototype)

## Overview
A 2D cellular automaton where plants grow according to a string-based genome
(L-system inspired), interpreted by one or more active growth tips, layered
on top of a simple environmental resource simulation (soil moisture + light).

## Grid
- 2D lattice: soil rows at the bottom, air above.
- Each cell has a `type`: `soil`, `water_source`, `air`, `root`, `stem`,
  `leaf`, `seed`.
- Each cell has a small property bag:
  - Soil cells: `moisture`
  - Plant cells: `resource_pool` (water/sugar)

## Genome String
Example: `R S S L S [ B S L ] S L`

| Symbol | Meaning |
|---|---|
| `R` | Grow a root cell in the current direction |
| `S` | Grow a stem cell |
| `L` | Grow a leaf cell (offset ~90° so it isn't buried in the stem) |
| `[` | Branch: push current tip's state (position + heading) onto a stack; spawn new tip, turn 90°, reset its read-head to 0 |
| `]` | Pop back to parent tip's saved state; resume reading its string |
| `@` | Jump read-head back to 0 ("repeat since beginning") |
| `!` | Truncate this tip's working copy up to current position ("delete since beginning," so future `@` skips it) |

## Tip (the active growth agent)
Each growing tip is a small struct:

```
Tip {
  position
  heading
  read_head
  resource_pool
  genome_copy      // per-tip working copy, so @ / ! are local
}
```

Each timestep, per tip:
1. If `resource_pool >= cost(next_instruction)`: execute it
   (grow a cell / move+turn / push-branch / pop).
2. Advance `read_head` (or jump/truncate per `@` / `!`).

## Environmental / Resource CA (runs every tick, independent of genome execution)
- **Soil moisture**: diffuses outward from a fixed water source/table.
- **Light**: simple top-down column shadow-check — a leaf cell is lit unless
  another plant cell occupies the column above it that tick. No ray casting
  needed in 2D.
- **CO2**: abstracted as a global constant (not spatial).
- **Uptake/transport**:
  - Root cells pull from local soil `moisture` into their `resource_pool`.
  - Leaf cells generate sugar from `light × CO2_constant`.
  - Stem cells transport/average pool with plant-neighbors each tick, so
    water flows up from roots and sugar flows down from leaves.

## Open Design Questions
- Is genome truncation (`!`) per-tip only, or does it ever mutate the
  organism's shared genome as it grows?
- Branch turn angle: fixed 90°, random, or a phyllotaxis-style divergence
  angle (real plants often use ~137.5°) as a future evolvable parameter?
- Exact resource costs per instruction (`R`/`S`/`L`/`[`) — flat cost vs.
  scaling with tip depth/age?

## Prior Art / Inspiration
- Prusinkiewicz & Lindenmayer, *The Algorithmic Beauty of Plants*
- Mech & Prusinkiewicz, "open L-systems" (environment-sensing L-systems)
- Runions et al., space-colonization algorithm for branching structures
