'use strict';
// Samples the world every reportingPeriod ticks and ships a self-describing packet (full
// PARAMETERS + samples) to the DB at epoch. The packet() helper (db.js) embeds PARAMETERS
// verbatim so every run reconstructs from its own record.
//
// It also keeps the live view's arrays (`series`, `hist`). ui.js hands these to the Claude
// Basic chart elements ONCE; the kit's frame loop repaints a chart when an array grows. They
// are view data only and are NOT written to the packet, so the saved record is unchanged.
//
// NOTE: in the browser this auto-flushes at epoch (fire-and-forget, errors logged). The
// headless runner (runner.mjs) drives ticks and flushes explicitly so it can await the write.
var DataManager = class DataManager {
  constructor(world, db) {
    this.world = world;
    this.db = db;
    this.samples = [];
    this.run = (PARAMETERS.db && PARAMETERS.db.run) || 'run';
    this.flushed = false;
    this.series = {
      plants: [], seedBank: [], births: [], deaths: [],
      leaf: [], stem: [], root: [], store: [], distinct: [],
    };
    // per-plant distributions, one column of bin counts per sample (histogram heatmaps)
    this.hist = { height: [], depth: [], genome: [] };
  }

  // Bin layout for the heatmaps; ui.js reads the same numbers for the axes, so they live here.
  static get BINS() {
    return {
      height: { lo: 0, hi: 40, n: 20 },    // cells above the local soil surface
      depth: { lo: -12, hi: 0, n: 12 },    // cells below it, as negatives so deeper is lower
      genome: { lo: 4, hi: 28, n: 24 },    // germline length in symbols (one bin each)
    };
  }

  update(engine) {
    if (engine.tick % PARAMETERS.reportingPeriod === 0) {
      const m = this.world.allMetrics();
      m.tick = engine.tick;
      this.samples.push(m);
      this.record(m);
    }
    if (!this.flushed && engine.tick >= PARAMETERS.epoch) {
      this.flushed = true;
      this.flush();
    }
  }

  record(m) {
    const s = this.series, w = this.world, B = DataManager.BINS;
    s.plants.push(m.alivePlants);
    s.seedBank.push(m.seedBank);
    s.births.push(m.births);
    s.deaths.push(m.plantDeaths);
    s.leaf.push(m.leafCells); s.stem.push(m.stemCells);
    s.root.push(m.rootCells); s.store.push(m.storeCells);
    const bin = (b, v) => {
      const k = Math.floor((v - b.lo) / (b.hi - b.lo) * b.n);
      return k < 0 ? 0 : (k >= b.n ? b.n - 1 : k);
    };
    const h = new Array(B.height.n).fill(0), d = new Array(B.depth.n).fill(0);
    const g = new Array(B.genome.n).fill(0), genomes = new Set();
    for (const pl of w.plants) {
      if (!pl.alive) continue;
      const t = pl.traits(w);
      h[bin(B.height, t.height)]++;
      d[bin(B.depth, -t.depth)]++;
      g[bin(B.genome, pl.genome.length)]++;
      genomes.add(pl.genome);
    }
    this.hist.height.push(h); this.hist.depth.push(d); this.hist.genome.push(g);
    s.distinct.push(genomes.size);
  }

  async flush() {
    if (!this.db) return { ok: false };
    const pkt = this.db.packet(PARAMETERS, {
      run: this.run, samples: this.samples, final: this.world.allMetrics(),
    });
    try {
      const res = await this.db.insert(this.run, pkt);
      if (typeof console !== 'undefined') console.log('[data] saved', JSON.stringify(res));
      return res;
    } catch (e) {
      if (typeof console !== 'undefined') console.error('[data] save failed:', e.message);
      return { ok: false, error: e.message };
    }
  }

  draw() {}
};
