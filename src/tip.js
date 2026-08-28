'use strict';
// A growth tip: the agent that reads the genome tape. Development IS execution — there is no
// rewriting step and no finished string to walk. See MODEL.md.
//
// A tip is a LOCAL ACCUMULATOR: it sits on a node, and from Stage 3 draws that node's water
// and sugar into itself and builds when it has banked enough. It never draws from a shared
// plant pool — that is what forecloses the proliferate-meristems exploit and what makes
// self-pruning work. Stage 2 has no economy, so every tip executes one instruction per tick
// unconditionally. From Stage 3 an instruction executes only if the tip can pay for it, and
// the economy is tuned slower than the clock — so the tick rate is only a ceiling and the
// realized developmental rate is set by resource acquisition.
//
// Two failure modes, and they behave differently on purpose:
//   can't FIT (target occupied, no free face) → no-op, read head ADVANCES. Crowding degrades
//                                               growth rather than killing; a blocked tip
//                                               carries on and may branch elsewhere.
//   can't PAY (Stage 3, insufficient resources) → tip WAITS without advancing, and banks.

// 4-neighbourhood. Headings index this array; 3D swaps in a 6-entry table and nothing else
// in the interpreter changes.
var DIRS = [{ dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }]; // U R D L
function opposite(h) { return (h + 2) % DIRS.length; }
function lateralFaces(h) { return [(h + 1) % DIRS.length, (h + DIRS.length - 1) % DIRS.length]; }

var Tip = class Tip {
  // Tips are created through spawn(), never `new` directly: a bud OCCUPIES a face, so
  // creation fails if that face of that node already carries one. This is what enforces the
  // geometric cap on TIPS (<=3 per node in 2D, <=5 in 3D). Without it a genome like `B *`
  // proliferates without bound, because it builds no cells and so never fills a face.
  static spawn(plant, x, y, heading, tape, world) {
    if (world.budTaken(x, y, heading)) return null;
    world.claimBud(x, y, heading);
    return new Tip(plant, x, y, heading, tape);
  }

  constructor(plant, x, y, heading, tape) {
    this.plant = plant;
    this.x = x;
    this.y = y;
    this.heading = heading;
    this.tape = tape;        // per-tip WORKING COPY — `!` and `@` mutate this, never the germline
    this.p = 0;              // read head
    this.k = 0;              // branch/leaf counter, drives delta face selection
    this.age = 0;            // total steps, diagnostic only
    this.idle = 0;           // consecutive steps WITHOUT building anything
    this.dead = false;
    this.water = 0;          // Stage 3
    this.sugar = 0;          // Stage 3
  }

  // --- tape mechanics, isolated from the world so they can be unit-tested ------
  // Executed-symbol trace for a tape, with no world at all. This is what proves the
  // counted-loop identities in MODEL.md hold exactly.
  static trace(tape, maxSteps) {
    const out = [];
    let t = tape, p = 0, n = 0;
    const cap = maxSteps || 10000;
    while (p < t.length && n++ < cap) {
      const c = t[p];
      if (c === '!') { t = t.slice(p + 1); p = 0; continue; }          // truncate prefix, move origin
      if (c === '@') { t = t.slice(0, p) + t.slice(p + 1); p = 0; continue; } // consume, jump to origin
      if (c === '*') { p = 0; continue; }                              // jump to origin, NOT consumed
      out.push(c);
      p++;
    }
    return out.join('');
  }

  // --- one instruction ---------------------------------------------------------
  // Pull from the node this tip sits on — never from a shared plant pool. Several tips on
  // one node draw from one node's bank, so heavy local branching means slow growth unless the
  // node is well supplied.
  draw(world) {
    const i = world.idx(this.x, this.y);
    const rate = PARAMETERS.tipDrawRate;
    // clamp at 0: cells may run a sugar DEBT (see cellDebtLimit), and an unclamped min()
    // makes the tip absorb that debt into its own bank — after which it can never afford to
    // build again. This silently capped every plant at whatever its seed reserve funded.
    // Clamp at 0: cells may run a sugar DEBT (cellDebtLimit), and an unclamped min() makes
    // the tip absorb that debt into its own bank, after which it can never afford to build.
    // The floor applies to SUGAR only — maintenance is paid in sugar, so water has no
    // competing claim to reserve.
    const w = Math.max(0, Math.min(rate, world.pw[i])); world.pw[i] -= w; this.water += w;
    const floor = PARAMETERS.tipDrawFloor;
    const g = Math.max(0, Math.min(rate, world.ps[i] - floor)); world.ps[i] -= g; this.sugar += g;
  }

  step(world) {
    if (this.dead) return;
    // The backstop must fire on a tip that has stopped doing anything, NOT on one that has
    // simply been alive a long time. Ageing out on lifetime killed healthy slow-growing
    // meristems at exactly maxTipSteps and froze the plant — the step cap was doing the
    // halting, which is the one thing it must never do.
    this.age++;
    if (++this.idle > PARAMETERS.maxTipSteps) { this.die(world); return; }
    const t = this.tape;
    if (this.p >= t.length) { this.die(world); return; }    // ran off the end — a determinate tip
    world.tipTicks++;
    this.draw(world);

    const P = PARAMETERS;
    switch (t[this.p]) {
      // control flow costs nothing and manages its own read head
      case '!': this.tape = t.slice(this.p + 1); this.p = 0; world.tipExecs++; return;
      case '@': this.tape = t.slice(0, this.p) + t.slice(this.p + 1); this.p = 0; world.tipExecs++; return;
      case '*': this.p = 0; world.tipExecs++; return;
      // B produces no cell, so it is free — the branch's real cost is paid by the cells the
      // child goes on to build
      case 'B': this.branch(world); break;
      // growth costs. CAN'T PAY → wait and bank, WITHOUT advancing the read head. That is a
      // different failure from CAN'T FIT, which is a no-op that does advance.
      case 'G': case 'R': case 'S': case 'L': {
        if (!P.economyOff && (this.sugar < P.cellSugarCost || this.water < P.cellWaterCost)) return;
        const c = t[this.p];
        const built = (c === 'L') ? this.leaf(world)
          : this.grow(world, c === 'R' ? CELL.ROOT : (c === 'S' ? CELL.STEM : -1));
        if (built) {
          this.idle = 0;                                     // productive: reset the backstop
          if (!P.economyOff) { this.sugar -= P.cellSugarCost; this.water -= P.cellWaterCost; }
        }
        break;
      }
      case 'F': {
        if (!P.economyOff && this.sugar < P.seedCost) return;                       // wait
        if (this.propagule(world) && !P.economyOff) this.sugar -= P.seedCost;
        break;
      }
      default: break;                                  // unknown symbol: inert, never lethal
    }
    world.tipExecs++;
    this.p++;
  }

  // Grow one cell in the current heading and move into it. Cell type is set by POSITION —
  // soil → root, air → stem — unless forced by R/S. The genome specifies geometry, the world
  // specifies tissue; that is what gives plasticity with nothing added to the language.
  grow(world, forceType) {
    const d = DIRS[this.heading];
    const nx = this.x + d.dx, ny = this.y + d.dy;
    if (!world.inBounds(nx, ny)) return false;           // can't fit
    const target = world.at(nx, ny);
    if (!world.isVacant(target)) return false;           // occupied, or the water table
    const type = forceType >= 0 ? forceType : (target === CELL.AIR ? CELL.STEM : CELL.ROOT);
    world.place(nx, ny, type, this.plant);
    // the bud moves with the tip: release the face it held, claim the one it now points at
    world.releaseBud(this.x, this.y, this.heading);
    this.x = nx; this.y = ny;
    world.claimBud(nx, ny, this.heading);
    return true;
  }

  die(world) {
    this.dead = true;
    world.releaseBud(this.x, this.y, this.heading);
    const i = world.idx(this.x, this.y);          // return the bank to the node
    world.pw[i] += this.water; world.ps[i] += this.sugar;
    this.water = 0; this.sugar = 0;
  }

  // A leaf is placed on a free LATERAL face and the tip does NOT move — otherwise the axis
  // would be built out of leaves. Underground it is suppressed: a leaf primordium in the dark
  // is arrested pending light (skotomorphogenesis), not converted into anything else. It
  // fails on POSITION, not on light level — reading light would be sensing (Stage 6).
  leaf(world) {
    const face = this.pickFace(world, lateralFaces(this.heading));
    if (face < 0) return false;                          // can't fit
    const d = DIRS[face];
    const nx = this.x + d.dx, ny = this.y + d.dy;
    if (world.at(nx, ny) !== CELL.AIR) return false;     // suppressed underground
    world.place(nx, ny, CELL.LEAF, this.plant);
    this.k++;
    return true;
  }

  // Fork. The child sits at MY position with a rolled heading and reads from 0 of my CURRENT
  // working copy (so it inherits my truncations); I continue at p+1. It is a recursive
  // self-call, not a bracket — there is no stack and no partner symbol.
  // Fails when the node has no free face: at most 3 branches per node in 2D, 5 in 3D. That
  // geometric cap, not any cost, is what bounds branching.
  branch(world) {
    const cand = [];
    for (let h = 0; h < DIRS.length; h++) if (h !== opposite(this.heading)) cand.push(h);
    const face = this.pickFace(world, cand);
    if (face < 0) return;                                // no room for a bud
    const child = Tip.spawn(this.plant, this.x, this.y, face, this.tape, world);
    if (!child) return;                                  // that face already carries a bud
    this.plant.addTip(child);
    this.idle = 0;                                           // productive: reset the backstop
    this.k++;
  }

  // Stage 4 wires reproduction. Stage 2 just marks the cell so it is visible.
  propagule(world) {
    const face = this.pickFace(world, lateralFaces(this.heading));
    if (face < 0) return false;
    const d = DIRS[face];
    world.place(this.x + d.dx, this.y + d.dy, CELL.SEED, this.plant);
    this.k++;
    return true;
  }

  // delta as a FACE-SELECTION rule. On a lattice headings are quantised, so delta cannot be a
  // continuous divergence angle — it picks which free face to take next (MODEL.md).
  pickFace(world, candidates) {
    const free = [];
    for (const h of candidates) {
      if (world.budTaken(this.x, this.y, h)) continue;    // that face already carries a bud
      const d = DIRS[h];
      const nx = this.x + d.dx, ny = this.y + d.dy;
      if (world.inBounds(nx, ny) && world.isVacant(world.at(nx, ny))) free.push(h);
    }
    if (!free.length) return -1;
    return free[(this.k * PARAMETERS.deltaIndex) % free.length];
  }
};
