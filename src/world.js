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

// STORE is an underground leaf — a cataphyll. Real scale leaves are non-photosynthetic and
// often storage organs; a bulb is a stack of them. So `L` below ground builds one rather
// than being suppressed, which gives storage as an evolvable trait using an existing symbol.
var CELL = { AIR: 0, SOIL: 1, WATER: 2, ROOT: 3, STEM: 4, LEAF: 5, SEED: 6, STORE: 7 };

// Cells that conduct soil water. Roots sit IN soil, so they conduct as well as extract —
// keeping the moisture field continuous through a root system rather than punching holes in it.
function conductsWater(t) { return t === CELL.SOIL || t === CELL.WATER || t === CELL.ROOT; }

// Unsaturated hydraulic conductivity between two cells, K(m̄) = m̄^exp. Symmetric in its two
// arguments, which is what keeps the diffusion scheme conservative. exp=0 recovers the naive
// constant-conductivity model.
function conductivity(a, b, exp) {
  if (!exp) return 1;
  const mbar = 0.5 * (a + b);
  return exp === 2 ? mbar * mbar : Math.pow(mbar, exp);
}

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
    this.owner = new Int32Array(this.n).fill(-1);  // plant id per cell, -1 = unowned
    // One bit per heading: which faces of this cell already carry a bud. A bud OCCUPIES a
    // face — two tips on the same node pointing the same way is not a thing. This is what
    // actually enforces the geometric branch cap (<=3 per node in 2D, <=5 in 3D). Checking
    // only that a face is VACANT is not enough: a genome like `B *` builds no cells, so the
    // faces stay vacant forever and tips grow exponentially.
    this.budMask = new Uint8Array(this.n);
    // Per-cell PLANT pools, distinct from soil moisture. Tips are local accumulators: they
    // draw from the node they sit on, never from a shared plant pool. That is what forecloses
    // the proliferate-meristems exploit and what makes self-pruning possible.
    this.pw = new Float32Array(this.n);   // plant water
    this.ps = new Float32Array(this.n);   // plant sugar
    this.pbuf = new Float32Array(this.n); // transport double-buffer
    this.made = new Float32Array(this.n);  // sugar each leaf produced this tick
    this.senesce = new Uint16Array(this.n);// consecutive ticks a leaf has been below its own cost
    this.tipTicks = 0;                    // instrumentation: how often tips actually execute
    this.tipExecs = 0;
    this.cellDeaths = 0;
    this.mark = new Int32Array(this.n);    // reusable flood-fill marker for prune()
    this.markGen = 0;
    this.seedBank = [];        // dispersed, ungerminated propagules
    this.births = 0;           // germinations
    this.clonalSplits = 0;     // fragments that became independent plants
    this.plantDeaths = 0;
    this.diedStarved = 0; this.diedRandom = 0; this.diedSenescent = 0;
    this.pcells = [];          // indices of all living plant cells, rebuilt once per tick
    this.plants = [];
    this.nextPlantId = 0;
    // TWO independent streams. Environment (terrain, rain) and biology (mortality, dispersal,
    // mutation) must not share one, or adding a biological process shifts the weather —
    // which is exactly what happened when plant mortality was added: it consumed draws every
    // tick, changed the rain pattern, and silently reversed an unrelated water-table result.
    this.rng = makeRNG(PARAMETERS.seed);              // environment only
    this.rngBio = makeRNG(PARAMETERS.seed ^ 0x9e3779b9);  // biology only
    this.tick = 0;
    this.raining = false;
    this.lastRainTick = -1;
    this.prev = new Float32Array(this.n);     // snapshot for the convergence diagnostic
    this.maxDelta = 1;                        // largest NET per-cell moisture change last tick
    this.buildTerrain();
    this.computeLight();
  }

  idx(x, y) { return y * this.W + x; }
  at(x, y) { return this.type[y * this.W + x]; }
  set(x, y, t) { this.type[y * this.W + x] = t; }
  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.W && y < this.H; }

  budTaken(x, y, h) { return (this.budMask[y * this.W + x] & (1 << h)) !== 0; }
  claimBud(x, y, h) { this.budMask[y * this.W + x] |= (1 << h); }
  releaseBud(x, y, h) { this.budMask[y * this.W + x] &= ~(1 << h); }

  // A cell a tip may build into. Plant cells block (self and other alike, in v1). WATER
  // blocks too: it is the pinned Dirichlet source, and overwriting it would delete the
  // deep half of the two-layer mechanism.
  isVacant(t) { return t === CELL.AIR || t === CELL.SOIL; }

  place(x, y, type, plant) {
    const i = y * this.W + x;
    this.type[i] = type;
    this.owner[i] = plant.id;
    if (type !== CELL.ROOT) this.moisture[i] = 0;   // non-conducting tissue holds no soil water
    plant.register(i, type);
  }

  // --- reproduction ------------------------------------------------------

  // A propagule leaves the parent and lands somewhere else. Local kernel: an exponential
  // distance either side, so a plant seeds its own neighbourhood and inferior competitors
  // keep refuges.
  disperse(genome, x, endosperm) {
    const P = PARAMETERS;
    const d = Math.ceil(-Math.log(1 - this.rngBio()) * P.dispersalMean);
    const nx = clamp(x + (this.rngBio() < 0.5 ? -d : d), 0, this.W - 1);
    this.seedBank.push({ x: nx, genome: genome, sugar: endosperm, age: 0 });
  }

  // Seeds wait out dormancy, then germinate onto bare surface. A seed that never finds a
  // site is lost when it outlives `seedLifespan`.
  germinateBank() {
    const P = PARAMETERS;
    if (!this.seedBank.length) return;
    const keep = [];
    for (const sd of this.seedBank) {
      sd.age++;
      if (sd.age > P.seedLifespan) continue;                       // lost
      if (sd.age < P.seedDormancy) { keep.push(sd); continue; }
      if (this.plants.length >= P.maxPlants) { keep.push(sd); continue; }
      const y = this.surfaceY[sd.x];
      if (this.type[this.idx(sd.x, y)] >= CELL.ROOT) { keep.push(sd); continue; }  // site taken
      this.plantSeed(sd.genome, sd.x, sd.sugar);
      this.births++;
    }
    this.seedBank = keep;
  }

  // Plant-level death. Cell-by-cell starvation is not enough on its own: it is
  // density-dependent, so it cannot open the gaps a pioneer strategy needs, and it never
  // retires a completed determinate plant that is merely sitting there in balance.
  mortality() {
    const P = PARAMETERS;
    for (const pl of this.plants) {
      if (!pl.cells.length) continue;
      if (P.plantMortality > 0 && this.rngBio() < P.plantMortality) {
        this.killPlant(pl); this.diedRandom++; continue;
      }
      // the program is over: no live tips means the tape ran out everywhere. A determinate
      // genome is a completed adult; monocarpic plants die after fruiting.
      if (!pl.growing) {
        if (++pl.senesceTicks > P.plantSenescence) { this.killPlant(pl); this.diedSenescent++; }
      } else pl.senesceTicks = 0;
    }
  }

  killPlant(pl) {
    for (const t of pl.tips) if (!t.dead) t.die(this);
    pl.tips = [];
    for (const i of pl.cells.slice()) this.killCell(i, pl, false);
    pl.cells = [];
    pl.alive = false;
    pl.growing = false;
  }

  // Mutation operators on a string genome. Point / indel are ordinary; the other two are the
  // ones the encoding was chosen for. See MODEL.md.
  mutate(g) {
    const P = PARAMETERS, A = 'GRSLBF!@*';
    const rnd = this.rngBio;
    let out = '';
    for (let i = 0; i < g.length; i++)
      out += (rnd() < P.mutPoint) ? A[(rnd() * A.length) | 0] : g[i];
    // @-run slippage: expand or contract a unary repeat count by exactly one. Small mutation,
    // small phenotypic step — the microsatellite analogue that makes repeat number smooth.
    if (rnd() < P.mutSlip) {
      const runs = [];
      for (let i = 0; i < out.length; i++) if (out[i] === '@') runs.push(i);
      if (runs.length) {
        const k = runs[(rnd() * runs.length) | 0];
        out = rnd() < 0.5 ? out.slice(0, k) + out.slice(k + 1) : out.slice(0, k) + '@' + out.slice(k);
      } else if (out.length) {
        const k = (rnd() * out.length) | 0;
        out = out.slice(0, k) + '@' + out.slice(k);
      }
    }
    if (rnd() < P.mutIndel) {
      const k = (rnd() * Math.max(1, out.length)) | 0;
      out = rnd() < 0.5 && out.length > 1
        ? out.slice(0, k) + out.slice(k + 1)
        : out.slice(0, k) + A[(rnd() * A.length) | 0] + out.slice(k);
    }
    // tandem duplication: copy a substring next to itself. This is how real genomes build
    // modules, and it gives evolution literal raw material to diverge from.
    if (rnd() < P.mutDup && out.length > 1) {
      const a = (rnd() * out.length) | 0;
      const b = Math.min(out.length, a + 1 + ((rnd() * 6) | 0));
      const seg = out.slice(a, b);
      if (out.length + seg.length < 400) out = out.slice(0, b) + seg + out.slice(b);
    }
    return out.length ? out : 'G';
  }

  // Germinate a plant at the surface of column x. Two tips, up and down.
  plantSeed(genome, x, endosperm) {
    const y = this.surfaceY[x];
    const pl = new Plant(this.nextPlantId++, genome, x, y);
    this.plants.push(pl);
    // The seed is a real cell holding the endosperm, so the reserve sits IN the transport
    // network and feeds the seedling until its first leaf earns. Tips start empty and draw
    // from it like any other node.
    this.place(x, y, CELL.SEED, pl);
    this.ps[this.idx(x, y)] = (endosperm === undefined) ? PARAMETERS.seedSugar : endosperm;
    this.pw[this.idx(x, y)] = PARAMETERS.seedWater;
    pl.germinate(this);
    return pl;
  }

  // --- construction -------------------------------------------------------

  buildTerrain() {
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
    // physiology BEFORE development: a tip decides using this tick's supply
    this.collectPlantCells();
    this.photosynthesise();
    this.transport();
    this.maintain();
    this.prune();
    for (const pl of this.plants) if (pl.alive) pl.update(this);
    this.mortality();
    this.germinateBank();
    // retire plants that have lost all tissue
    const before = this.plants.length;
    this.plants = this.plants.filter((pl) => pl.cells.length > 0);
    const gone = before - this.plants.length;
    this.plantDeaths += gone;
    this.diedStarved = this.plantDeaths - this.diedRandom - this.diedSenescent;
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

  // Root cells draw soil water into the PLANT pool at their own cell.
  //
  // Uptake is PROPORTIONAL to available water (m - wiltingPoint), not min(rate, m). The
  // min() form is a step function: any cell above `rate` yields full uptake, so a root in
  // soil at 0.02 performs exactly as well as one at 1.0. That flattens the water niche
  // completely — measured, depth 1 and depth 32 both returned 0.0200/tick — and leaves the
  // deep/shallow trade-off nothing to grip.
  uptakeStep() {
    const rate = PARAMETERS.uptakeRate, wp = PARAMETERS.wiltingPoint;
    this.uptake.fill(0);
    if (!rate) return;
    const span = 1 - wp;
    for (let i = 0; i < this.n; i++) {
      if (this.type[i] !== CELL.ROOT) continue;
      const avail = (this.moisture[i] - wp) / span;
      if (avail <= 0) continue;
      const take = Math.min(rate * avail, this.moisture[i]);
      this.moisture[i] -= take;
      this.uptake[i] = take;
      this.pw[i] += take;
    }
  }

  // Unsaturated flow. Flux between two cells is D · K(m̄) · Δm, where K(m) = m^exp is the
  // moisture-dependent hydraulic conductivity and m̄ is the pair mean — symmetric in (i,j),
  // so the scheme stays conservative. WATER cells are Dirichlet sources: they donate to
  // their neighbours but are never themselves updated.
  //
  // The conductivity term is not decoration. With constant K the water table wets the
  // surface (measured: surface settled at 0.119 with rain off), so a shallow root lives off
  // the table and the shallow/deep distinction — Walter's two layers, the model's strongest
  // niche axis — collapses. At exp=2 the dry surface disconnects (0.007) while depth holds
  // 0.313. Real dry soil conducts water very poorly; that is what keeps the layers apart.
  diffuse() {
    const W = this.W, H = this.H, D = PARAMETERS.diffusion, e = PARAMETERS.conductivityExp;
    const m = this.moisture, nx = this.buf, t = this.type;
    nx.set(m);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x, ti = t[i];
        if (ti === CELL.WATER || !conductsWater(ti)) continue;
        const mi = m[i];
        let acc = 0;
        if (x > 0 && conductsWater(t[i - 1])) acc += conductivity(mi, m[i - 1], e) * (m[i - 1] - mi);
        if (x < W - 1 && conductsWater(t[i + 1])) acc += conductivity(mi, m[i + 1], e) * (m[i + 1] - mi);
        if (y > 0 && conductsWater(t[i - W])) acc += conductivity(mi, m[i - W], e) * (m[i - W] - mi);
        if (y < H - 1 && conductsWater(t[i + W])) acc += conductivity(mi, m[i + W], e) * (m[i + W] - mi);
        nx[i] = mi + D * acc;
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

  // --- plant physiology ---------------------------------------------------

  // One list of living plant cells per tick. The physiology passes used to scan the whole
  // 30k-cell grid — transport did it 6 sub-steps x 2 fields = 360k visits per tick to move
  // sugar between ~1k cells, which cost 1.68 ms/tick at 141 cells against 0.27 ms for the
  // bare environment.
  collectPlantCells() {
    const out = [];
    for (const pl of this.plants) for (const i of pl.cells) if (this.type[i] >= CELL.ROOT) out.push(i);
    this.pcells = out;
  }

  // Leaves fix carbon and lose water doing it. Photosynthesis REQUIRES water: stomata must
  // open to admit CO2, and that is what the water is spent on. A leaf with no water makes no
  // sugar, so drought costs carbon directly rather than merely slowing growth.
  photosynthesise() {
    const P = PARAMETERS, L = this.light, pw = this.pw, ps = this.ps, t = this.type;
    for (const i of this.pcells) this.made[i] = 0;
    for (const i of this.pcells) {
      if (t[i] !== CELL.LEAF) continue;
      const lit = L[i];
      if (lit <= 0) continue;
      const need = P.transpiration * lit;
      const used = need > 0 ? Math.min(need, pw[i]) : 0;
      pw[i] -= used;
      if (need > 0) { const m = P.photoRate * lit * (used / need); ps[i] += m; this.made[i] = m; }
    }
  }

  // Both pools diffuse between adjacent cells of the SAME plant. Water rises from roots and
  // sugar descends from leaves purely by gradient — no directional pump. Tall plants are
  // penalised by transport lag; treated as a feature until evidence says otherwise.
  transport() {
    const W = this.W, r = PARAMETERS.transportRate;
    const t = this.type, own = this.owner;
    const iters = PARAMETERS.transportIters | 0;
    const rel = PARAMETERS.storeRelease;
    const pc = this.pcells, nx = this.pbuf;
    if (!pc.length) return;
    for (const field of [this.pw, this.ps]) {
      for (let it = 0; it < iters; it++) {
        for (let k = 0; k < pc.length; k++) nx[pc[k]] = field[pc[k]];   // snapshot, plant cells only
        for (let k = 0; k < pc.length; k++) {
          const i = pc[k], o = own[i];
          let acc = 0;
          for (const j of [i - 1, i + 1, i - W, i + W]) {
            if (j < 0 || j >= this.n || own[j] !== o || t[j] < CELL.ROOT) continue;
            const d = nx[j] - nx[i];
            if (d === 0) continue;
            // the DONOR is the higher side; if the donor is a store, it releases slowly.
            // Both cells of a pair agree on the donor, so the scheme stays conservative.
            const donor = d > 0 ? j : i;
            acc += (t[donor] === CELL.STORE ? rel : 1) * d;
          }
          field[i] = nx[i] + r * acc;
        }
      }
    }
  }

  // Every living cell burns sugar, and carrying the genome costs extra per cell (every cell
  // holds a copy, so bloat is taxed in proportion to size). A cell that cannot pay dies.
  // This is the term that makes size expensive — and, if transport cannot reach a shaded
  // branch, it is what should produce self-pruning and crown rise with no rule saying so.
  maintain() {
    const P = PARAMETERS, t = this.type, ps = this.ps;
    if (P.economyOff) return;
    for (const pl of this.plants) {
      if (!pl.cells.length) continue;   // NOT `alive`: a plant that has stopped growing must
                                        // keep respiring, or it freezes into an immortal husk
      const cost = P.maintenance + P.genomeCost * pl.genome.length;
      for (const i of pl.cells) {
        if (t[i] < CELL.ROOT || this.owner[i] !== pl.id) continue;
        ps[i] -= cost;
        // Leaf senescence: a LOCAL rule. A leaf earning less than it costs is below its light
        // compensation point; sustain that and it is shed. This is what produces crown rise,
        // and it targets shaded tissue rather than whatever sits furthest from a source.
        if (t[i] === CELL.LEAF) {
          if (this.made[i] < cost) {
            if (++this.senesce[i] > P.leafSenescence) { this.killCell(i, pl); continue; }
          } else this.senesce[i] = 0;
        }
        if (ps[i] < -P.cellDebtLimit) this.killCell(i, pl);
      }
      pl.cells = pl.cells.filter((i) => this.owner[i] === pl.id);
    }
  }

  // Structural support. A plant cell must have a connected path through its own tissue to
  // anchored tissue — a cell at or below the soil surface. Anything else has been cut loose
  // by a death somewhere below it and cannot hang in the air, so it falls.
  // Runs only for plants that lost a cell this tick.
  prune() {
    for (const pl of this.plants) {
      if (!pl.dirty || !pl.cells.length) { pl.dirty = false; continue; }
      pl.dirty = false;
      const keep = this.mark, stack = [];
      this.markGen++;
      const gen = this.markGen;
      for (const i of pl.cells) {
        const x = i % this.W, y = (i / this.W) | 0;
        if (y >= this.surfaceY[x]) { keep[i] = gen; stack.push(i); }  // anchored in the ground
      }
      while (stack.length) {
        const i = stack.pop();
        for (const j of [i - 1, i + 1, i - this.W, i + this.W]) {
          if (j < 0 || j >= this.n || keep[j] === gen) continue;
          if (this.owner[j] !== pl.id || this.type[j] < CELL.ROOT) continue;
          keep[j] = gen; stack.push(j);
        }
      }
      // Unreached tissue is cut loose. A fragment that still touches ground of its own is a
      // CLONAL individual — a rhizome or stolon whose connecting stem died — so it becomes an
      // independent plant. A fragment with no ground contact cannot hang in the air and falls.
      const loose = pl.cells.filter((i) => keep[i] !== gen);
      if (loose.length) {
        const seen = new Set();
        for (const start of loose) {
          if (seen.has(start)) continue;
          const comp = [start]; seen.add(start);
          let anchored = false;
          for (let qi = 0; qi < comp.length; qi++) {
            const i = comp[qi];
            const cx = i % this.W, cy = (i / this.W) | 0;
            if (cy >= this.surfaceY[cx]) anchored = true;
            for (const j of [i - 1, i + 1, i - this.W, i + this.W]) {
              if (j < 0 || j >= this.n || seen.has(j)) continue;
              if (this.owner[j] !== pl.id || this.type[j] < CELL.ROOT || keep[j] === gen) continue;
              seen.add(j); comp.push(j);
            }
          }
          if (anchored && comp.length >= PARAMETERS.minClone) {
            const ramet = new Plant(this.nextPlantId++, pl.genome, comp[0] % this.W,
                                    (comp[0] / this.W) | 0);
            this.plants.push(ramet);
            for (const i of comp) { this.owner[i] = ramet.id; ramet.register(i, this.type[i]); }
            for (const t of pl.tips) if (this.owner[this.idx(t.x, t.y)] === ramet.id) {
              t.plant = ramet; ramet.tips.push(t);
            }
            pl.tips = pl.tips.filter((t) => t.plant === pl);
            ramet.alive = true;
            this.clonalSplits++;
          } else {
            for (const i of comp) this.killCell(i, pl, true);
          }
        }
      }
      pl.cells = pl.cells.filter((i) => this.owner[i] === pl.id);
    }
  }

  killCell(i, plant, fell) {
    const x = i % this.W, y = (i / this.W) | 0;
    plant.counts[this.type[i]]--;
    plant.dirty = true;                  // a death can cut tissue loose; prune() will check
    if (fell) plant.fallen++;
    this.type[i] = (y >= this.surfaceY[x]) ? CELL.SOIL : CELL.AIR;
    this.owner[i] = -1;
    this.ps[i] = 0; this.pw[i] = 0; this.senesce[i] = 0; this.made[i] = 0;
    this.budMask[i] = 0;                 // any bud on this cell goes with it
    this.cellDeaths++;
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

  plantMetrics() {
    let cells = 0, leaf = 0, root = 0, stem = 0, tips = 0, height = 0, alive = 0;
    for (const pl of this.plants) {
      cells += pl.cells.length;
      leaf += pl.counts[CELL.LEAF]; root += pl.counts[CELL.ROOT]; stem += pl.counts[CELL.STEM];
      tips += pl.tips.length;
      if (pl.alive) alive++;
      const t = pl.traits(this);
      if (t.height > height) height = t.height;
    }
    return { plants: this.plants.length, alivePlants: alive, plantCells: cells,
             leafCells: leaf, rootCells: root, stemCells: stem, liveTips: tips,
             storeCells: this.plants.reduce((a, p) => a + p.counts[CELL.STORE], 0),
             seedBank: this.seedBank.length, births: this.births,
             clonalSplits: this.clonalSplits, plantDeaths: this.plantDeaths,
             diedStarved: this.diedStarved, diedRandom: this.diedRandom,
             diedSenescent: this.diedSenescent,
             meanGenomeLen: this.plants.length
               ? this.plants.reduce((a, p) => a + p.genome.length, 0) / this.plants.length : 0,
             maxHeight: height, cellDeaths: this.cellDeaths,
             execFraction: this.tipTicks ? this.tipExecs / this.tipTicks : 0 };
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

  allMetrics() { return Object.assign(this.metrics(), this.plantMetrics()); }
};
