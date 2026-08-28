'use strict';
// One plant: a germline genome, a set of concurrent tips, and the cells they have built.
//
// The germline genome is NEVER mutated by development. `!` truncates a tip's own working
// copy, so a branch commits while the seed does not — Weismann's barrier, for free, from a
// decision (`!` is per-tip) we made for other reasons. See MODEL.md.
//
// A seed germinates into TWO tips, one up and one down — radicle and plumule. Both read the
// same genome from position 0, and positional cell fate does the rest: the same program run
// upward builds stem and leaves, run downward builds root. One genome, two environments, two
// tissue types, no extra symbols.
var Plant = class Plant {
  constructor(id, genome, x, y) {
    this.id = id;
    this.genome = genome;      // the germline. Read-only for the lifetime of the plant.
    this.x = x;
    this.y = y;
    this.tips = [];
    this.pending = [];         // tips forked this tick, added after the sweep
    this.cells = [];           // indices of cells this plant owns
    this.counts = [0, 0, 0, 0, 0, 0, 0];  // by CELL type
    this.branches = 0;
    this.alive = true;
  }

  germinate(world) {
    // heading 0 = up (plumule/shoot), heading 2 = down (radicle/root)
    for (const h of [0, 2]) {
      const t = Tip.spawn(this, this.x, this.y, h, this.genome, world);
      if (t) this.tips.push(t);
    }
  }

  addTip(tip) { this.pending.push(tip); this.branches++; }

  register(i, type) {
    this.cells.push(i);
    this.counts[type]++;
  }

  update(world) {
    // a tip standing on a cell that starved goes with it (except the seed node itself,
    // which is bare ground until the first cell is built)
    for (const t of this.tips) {
      if (t.dead) continue;
      const i = world.idx(t.x, t.y);
      if (world.owner[i] !== this.id && !(t.x === this.x && t.y === this.y)) t.die(world);
    }
    for (const t of this.tips) t.step(world);
    if (this.pending.length) { this.tips = this.tips.concat(this.pending); this.pending = []; }
    // a tip that ran off its tape, aged out, or died is retained as history but stops running
    this.tips = this.tips.filter((t) => !t.dead);
    if (!this.tips.length) this.alive = false;
  }

  // --- trait vector -------------------------------------------------------
  // Stage 4 writes this per plant into the packet. Store the VECTOR, never a diversity
  // scalar — the diversity measure will change and runs are expensive (MODEL.md).
  traits(world) {
    let top = world.H, bottom = 0, left = world.W, right = 0;
    this.cells = this.cells.filter((i) => world.owner[i] === this.id);
    for (const i of this.cells) {
      const x = i % world.W, y = (i / world.W) | 0;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
      if (x < left) left = x;
      if (x > right) right = x;
    }
    const surf = world.surfaceY[this.x];
    const root = this.counts[CELL.ROOT], shoot = this.counts[CELL.STEM] + this.counts[CELL.LEAF];
    return {
      id: this.id,
      genomeLength: this.genome.length,
      cells: this.cells.length,
      root: root,
      stem: this.counts[CELL.STEM],
      leaf: this.counts[CELL.LEAF],
      seed: this.counts[CELL.SEED],
      height: Math.max(0, surf - top),        // cells above the local soil surface
      depth: Math.max(0, bottom - surf),      // cells below it
      width: this.cells.length ? right - left + 1 : 0,
      branches: this.branches,
      liveTips: this.tips.length,
      rootShoot: shoot ? root / shoot : 0,
    };
  }
};
