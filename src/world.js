'use strict';
// The world: a 2D lattice holding the environment — terrain, soil moisture, light — and,
// from Stage 2, the plants. It holds state and advances it but draws nothing (the Observer
// renders it), which is what keeps it headless-safe.
//
// Indexing: i = y * W + x, with y = 0 at the TOP (air) and y = H-1 at the bottom. Soil fills
// the lower rows under a heterogeneous surface; the water table is a fixed Dirichlet source
// near the bottom that is never updated, only read.
//
// Stage 1 has no plants. ROOT / STEM / LEAF cells can still be placed by hand as test
// fixtures — that is how the light gradient and the uptake sink are verified before any
// genome code exists (see smoketest.mjs).

var CELL = { AIR: 0, SOIL: 1, WATER: 2, ROOT: 3, STEM: 4, LEAF: 5, SEED: 6 };

// Cells that conduct soil water. Roots sit IN soil, so they conduct as well as extract —
// keeping the moisture field continuous through a root system rather than punching holes in it.
function conductsWater(t) { return t === CELL.SOIL || t === CELL.WATER || t === CELL.ROOT; }

var World = class World {
  constructor(W, H) {
    this.W = W;
    this.H = H;
    this.n = W * H;
    this.type = new Uint8Array(this.n);
    this.moisture = new Float32Array(this.n);
    this.buf = new Float32Array(this.n);      // diffusion double-buffer
    this.light = new Float32Array(this.n);
    this.uptake = new Float32Array(this.n);   // water drawn by each root cell this tick
    this.surfaceY = new Int32Array(W);        // topmost soil row per column, at build time
    this.rng = makeRNG(PARAMETERS.seed);
    this.tick = 0;
    this.raining = false;
    this.lastRainTick = -1;
    this.prev = new Float32Array(this.n);     // snapshot for the convergence diagnostic
    this.maxDelta = 1;                        // largest NET per-cell moisture change last tick
    this.build();
    this.computeLight();
  }

  idx(x, y) { return y * this.W + x; }
  at(x, y) { return this.type[y * this.W + x]; }
  set(x, y, t) { this.type[y * this.W + x] = t; }

  // --- construction -------------------------------------------------------

  build() {
    const P = PARAMETERS, W = this.W, H = this.H;
    const tableY = clamp(Math.round(P.tableDepth * H), 2, H - 1);
    this.tableY = tableY;

    // Two incommensurate sinusoids with seed-derived phases: reproducible relief that is
    // not periodic on the grid width. Heterogeneity is a requirement here, not decoration —
    // a flat surface gives one optimum and therefore one strategy (MODEL.md).
    const base = P.surfaceFraction * H;
    const amp = P.terrainAmp * H;
    const ph1 = this.rng() * TAU, ph2 = this.rng() * TAU;
    for (let x = 0; x < W; x++) {
      const u = (x / W) * TAU * P.terrainScale;
      const h = base + amp * (0.65 * Math.sin(u + ph1) + 0.35 * Math.sin(2.7 * u + ph2));
      this.surfaceY[x] = clamp(Math.round(h), 1, tableY - 3);
    }

    for (let x = 0; x < W; x++) {
      const s = this.surfaceY[x];
      for (let y = 0; y < H; y++) {
        const i = y * W + x;
        if (y < s) { this.type[i] = CELL.AIR; this.moisture[i] = 0; }
        else if (y >= tableY) { this.type[i] = CELL.WATER; this.moisture[i] = P.tableMoisture; }
        else { this.type[i] = CELL.SOIL; this.moisture[i] = P.initialMoisture; }
      }
    }
  }

  // topmost water-conducting cell in a column (the surface that rain lands on and that
  // evaporates). Scanned rather than cached because plants will change it from Stage 2.
  topSoilY(x) {
    const W = this.W;
    for (let y = 0; y < this.H; y++) if (conductsWater(this.type[y * W + x])) return y;
    return -1;
  }

  // --- the tick -----------------------------------------------------------

  update(engine) {
    this.tick = engine ? engine.tick : this.tick + 1;
    this.prev.set(this.moisture);
    this.rain();
    this.uptakeStep();
    this.diffuse();
    this.drain();
    this.evaporate();
    this.computeLight();
    // NET change across the whole tick. Measuring only the diffusion step would report a
    // steady flux forever, because diffusion and drainage balance rather than both stopping.
    let d = 0;
    for (let i = 0; i < this.n; i++) {
      const a = Math.abs(this.moisture[i] - this.prev[i]);
      if (a > d) d = a;
    }
    this.maxDelta = d;
  }

  // Water source 2: episodic, surface, transient. Rewards shallow opportunistic roots.
  rain() {
    const P = PARAMETERS;
    this.raining = false;
    if (!P.rainPeriod || this.tick % P.rainPeriod !== 0) return;
    this.raining = true;
    this.lastRainTick = this.tick;
    const ph = this.rng() * TAU;
    for (let x = 0; x < this.W; x++) {
      const y = this.topSoilY(x);
      if (y < 0) continue;
      const i = this.idx(x, y);
      if (this.type[i] === CELL.WATER) continue;   // sources are fixed
      const u = (x / this.W) * TAU * P.rainPatchScale + ph;
      const f = 1 - P.rainPatchiness + P.rainPatchiness * (0.5 + 0.5 * Math.sin(u));
      this.moisture[i] = Math.min(1, this.moisture[i] + P.rainAmount * f);
    }
  }

  // Root cells draw from their own cell. Stage 1 records it as a diagnostic; Stage 3 pipes
  // it into the tip's pool (tips are local accumulators — MODEL.md).
  uptakeStep() {
    const rate = PARAMETERS.uptakeRate;
    this.uptake.fill(0);
    if (!rate) return;
    for (let i = 0; i < this.n; i++) {
      if (this.type[i] !== CELL.ROOT) continue;
      const take = Math.min(rate, this.moisture[i]);
      this.moisture[i] -= take;
      this.uptake[i] = take;
    }
  }

  // Explicit diffusion over water-conducting cells. WATER cells are Dirichlet sources: they
  // donate to their neighbours but are never themselves updated.
  diffuse() {
    const W = this.W, H = this.H, D = PARAMETERS.diffusion;
    const m = this.moisture, nx = this.buf, t = this.type;
    nx.set(m);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x, ti = t[i];
        if (ti === CELL.WATER || !conductsWater(ti)) continue;
        let sum = 0, cnt = 0;
        if (x > 0 && conductsWater(t[i - 1])) { sum += m[i - 1]; cnt++; }
        if (x < W - 1 && conductsWater(t[i + 1])) { sum += m[i + 1]; cnt++; }
        if (y > 0 && conductsWater(t[i - W])) { sum += m[i - W]; cnt++; }
        if (y < H - 1 && conductsWater(t[i + W])) { sum += m[i + W]; cnt++; }
        if (!cnt) continue;
        nx[i] = m[i] + D * (sum - cnt * m[i]);
      }
    }
    this.moisture = nx;
    this.buf = m;
  }

  // Gravity, as a field-capacity bucket model: only moisture ABOVE field capacity drains.
  // Below it, water is held against gravity by matric potential and moves only by diffusion.
  // Without this term every cell drains into the table and the entire profile goes dry, so
  // the deep rain-independent layer — half of Walter's two layers — stops existing.
  // Iterated bottom-up so water moves at most one row per tick (no cascade).
  drain() {
    const W = this.W, H = this.H, g = PARAMETERS.drainage, fc = PARAMETERS.fieldCapacity;
    if (!g) return;
    const m = this.moisture, t = this.type;
    for (let y = H - 2; y >= 0; y--) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x, below = i + W, ti = t[i], tb = t[below];
        if (ti === CELL.WATER || !conductsWater(ti)) continue;
        if (!conductsWater(tb)) continue;
        const excess = m[i] - fc;
        if (excess <= 0) continue;
        const move = g * excess;
        if (tb === CELL.WATER) { m[i] -= move; continue; }   // absorbed by the table
        const q = Math.min(move, 1 - m[below]);
        if (q > 0) { m[i] -= q; m[below] += q; }
      }
    }
  }

  // Loss from the exposed surface cell, scaled by the light reaching it — so shade retains
  // soil moisture. That is a real facilitation effect and it costs one multiply.
  evaporate() {
    const e = PARAMETERS.evaporation;
    if (!e) return;
    const m = this.moisture, L = this.light;
    for (let x = 0; x < this.W; x++) {
      const y = this.topSoilY(x);
      if (y < 0) continue;
      const i = this.idx(x, y);
      if (this.type[i] === CELL.WATER) continue;
      m[i] = Math.max(0, m[i] - e * L[i] * m[i]);
    }
  }

  // Graded, never binary. T is the transmittance reaching each cell; a cell records the
  // light ARRIVING at it, then attenuates what passes on. A binary lit/unlit shadow would
  // make shade lethal and delete the understory niche entirely (MODEL.md).
  computeLight() {
    const P = PARAMETERS, W = this.W, H = this.H, t = this.type, L = this.light;
    for (let x = 0; x < W; x++) {
      let T = P.lightTop;
      for (let y = 0; y < H; y++) {
        const i = y * W + x, ti = t[i];
        L[i] = T;
        if (ti === CELL.LEAF) T *= P.tauLeaf;
        else if (ti === CELL.STEM || ti === CELL.ROOT || ti === CELL.SEED) T *= P.tauStem;
        else if (ti === CELL.SOIL || ti === CELL.WATER) T = 0;
      }
    }
  }

  // --- metrics ------------------------------------------------------------

  // mean moisture over conducting cells that are not the fixed source
  meanMoisture() {
    let s = 0, c = 0;
    for (let i = 0; i < this.n; i++) {
      const ti = this.type[i];
      if (ti === CELL.WATER || !conductsWater(ti)) continue;
      s += this.moisture[i]; c++;
    }
    return c ? s / c : 0;
  }

  // mean moisture d cells below each column's surface — the depth profile that separates
  // the shallow (rain-fed) layer from the deep (table-fed) one
  moistureAtDepth(d) {
    let s = 0, c = 0;
    for (let x = 0; x < this.W; x++) {
      const top = this.topSoilY(x);
      if (top < 0) continue;
      const y = top + d;
      if (y >= this.H) continue;
      const i = this.idx(x, y);
      if (this.type[i] === CELL.WATER || !conductsWater(this.type[i])) continue;
      s += this.moisture[i]; c++;
    }
    return c ? s / c : 0;
  }

  shallowMoisture() { return (this.moistureAtDepth(0) + this.moistureAtDepth(1) + this.moistureAtDepth(2)) / 3; }
  deepMoisture() {
    const d = Math.max(4, Math.round((this.tableY - this.surfaceY[0]) * 0.75));
    return (this.moistureAtDepth(d) + this.moistureAtDepth(d + 1)) / 2;
  }

  totalWater() {
    let s = 0;
    for (let i = 0; i < this.n; i++) if (this.type[i] !== CELL.WATER) s += this.moisture[i];
    return s;
  }

  // light arriving at the soil surface, averaged across columns — the understory budget
  meanSurfaceLight() {
    let s = 0, c = 0;
    for (let x = 0; x < this.W; x++) {
      const y = this.topSoilY(x);
      if (y < 0) continue;
      s += this.light[this.idx(x, y)]; c++;
    }
    return c ? s / c : 0;
  }

  metrics() {
    return {
      meanMoisture: this.meanMoisture(),
      shallowMoisture: this.shallowMoisture(),
      deepMoisture: this.deepMoisture(),
      surfaceLight: this.meanSurfaceLight(),
      totalWater: this.totalWater(),
    };
  }
};
