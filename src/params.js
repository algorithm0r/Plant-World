'use strict';
// Single source of truth for every tunable. Serialized verbatim into every saved data
// packet (see datamanager.js) so any run reconstructs from its stored parameters.
// Declared `var` so it's a global in the browser AND headless.
//
// Stage 1 scope: the environment only — terrain, soil water (two sources), light.
// No genome, no tips. See MODEL.md and DEVPLAN Stage 1.
var PARAMETERS = {
  // --- grid ---
  gridW: 200,             // cells across  (× cellSize = canvas width)
  gridH: 150,             // cells down
  cellSize: 4,            // px per cell when rendering
  seed: 12345,            // drives terrain relief and rain patchiness; runs are reproducible

  // --- terrain ---
  surfaceFraction: 0.55,  // mean soil surface, as a fraction of grid height from the top
  terrainAmp: 0.06,       // relief amplitude, as a fraction of grid height
  terrainScale: 2.5,      // low-frequency undulations across the width

  // --- water source 1: the table (deep, reliable) ---
  tableDepth: 0.88,       // water table top, as a fraction of grid height from the top
  tableMoisture: 1.0,     // held constant — a Dirichlet source, never updated
  initialMoisture: 0.25,  // soil moisture at t=0 above the table

  // --- water source 2: rain (shallow, episodic) ---
  // Together with the table this is Walter's two-layer mechanism — see MODEL.md.
  rainPeriod: 150,        // ticks between rain events (0 disables rain entirely)
  rainAmount: 0.55,       // moisture added to each surface cell per event
  rainPatchiness: 0.4,    // 0 = uniform across the width, 1 = strongly patchy
  rainPatchScale: 3.0,    // spatial frequency of the patchiness

  // --- soil water transport ---
  diffusion: 0.18,        // base transport coefficient (must be < 0.25 to be stable)
  conductivityExp: 2,     // K(m) = m^exp — unsaturated hydraulic conductivity. Dry soil is a
                          // very poor conductor (Richards); with a constant K the water table
                          // wets the surface and the two layers stop being distinct.
                          // 0 = constant K (the naive model), 2 = measured best separation.
  fieldCapacity: 0.35,    // soil holds water against gravity below this; only the EXCESS
                          // drains. Without it every cell drains into the table and the
                          // whole profile goes dry — the deep layer stops existing.
  drainage: 0.05,         // downward advection of the excess per tick — makes rain transient
  evaporation: 0.010,     // per-tick fractional loss from the exposed surface cell,
                          // scaled by incident light (so shade retains moisture)

  // --- light ---
  lightTop: 1.0,          // incident light above the canopy
  tauLeaf: 0.35,          // transmittance through one leaf cell — graded, never binary
  tauStem: 0.70,          // transmittance through a stem/root/seed cell

  // --- uptake (Stage 1: a diagnostic sink; Stage 3 pipes it into a tip's pool) ---
  uptakeRate: 0.04,       // MAXIMUM water a root draws per tick, at full availability
  wiltingPoint: 0.08,     // below this, water is held too tightly to extract at all.
                          // Uptake scales with AVAILABLE water (m - wiltingPoint), never
                          // min(rate, m) — a step function makes a root in nearly-dry soil
                          // perform identically to one in saturated soil, which flattens the
                          // entire water niche and leaves depth nothing to pay for.

  // --- genome / tips (Stage 2) ---
  genome: 'GL*',          // demo plant: leafy indeterminate axis. Viable under the
                          // current economy. Most juvenile-phase genomes are NOT —
                          // see the overshoot limitation in MODEL.md.
  nSeeds: 3,              // seeds sown evenly across the width
  deltaIndex: 1,          // face-selection rule for B and L. On a lattice headings are
                          // quantised, so delta picks WHICH free face to take next rather
                          // than a continuous divergence angle (MODEL.md).
  maxTipSteps: 4000,      // batch-run backstop ONLY. The economy is the real halting
                          // condition from Stage 3; this exists so a `*` loop cannot hang
                          // a headless sweep. A run that hits it is reporting a problem.

  // --- economy (Stage 3) ---
  // Sugar is a STOCK: it is the building material and is locked permanently into structure.
  // Water is a FLUX: it drives expansion and is then lost to transpiration. See MODEL.md.
  photoRate: 0.030,       // sugar a leaf makes per tick at full light
  transpiration: 0.008,   // water a leaf loses per tick at full light, growing or not.
                          // This is what makes drought lethal rather than merely slow, and
                          // therefore what makes root:shoot genuinely contested.
  maintenance: 0.0003,    // sugar EVERY living cell costs per tick — the term that makes
                          // size expensive and produces the size/allocation balance
  genomeCost: 0.000015,   // extra maintenance per cell per genome symbol. Every cell carries
                          // the genome, so bloat is taxed in proportion to plant size. This
                          // is the bloat control — it lives in the economy, not the grammar.
  transportRate: 0.22,    // diffusion of both pools between plant-graph neighbours. Water
                          // rises from roots, sugar descends from leaves, both by gradient.
                          // Explicit diffusion is stable only below 0.25, hence the sub-steps:
  transportIters: 6,      // diffusion sub-steps per tick. One pass gives a supply gradient
                          // that grows as N^2 with plant size, which starves anything past
                          // ~20 cells — real phloem is pressure-driven bulk flow, not
                          // diffusion. Sub-stepping keeps the transport LAG (a feature) while
                          // removing the quadratic wall (a defect).
  tipDrawFloor: 0.03,     // a tip may only draw SUGAR above this much in its node — the floor
                          // does not apply to water. Maintenance outranks growth (a
                          // carbon-starved plant stops growing before it sheds tissue), and
                          // without it tip banks hoard the sugar living cells need and the
                          // root system starves. Maintenance is paid in sugar only, so water
                          // has no competing claim to reserve.
  cellSugarCost: 0.14,    // sugar to build one cell (uniform by type, per Chris)
  cellWaterCost: 0.006,   // water locked into one cell by turgor-driven expansion. SMALL by
                          // design: a real plant transpires far more water than it ever
                          // builds into biomass, so growth is a sugar cost that merely
                          // requires water to be available, not a water cost.
  seedCost: 1.20,         // sugar for one propagule — deliberately large
  tipDrawRate: 0.06,      // MAX a tip pulls from its node per tick. Several tips on one node
                          // compete for one node's bank; that is the whole point of tips
                          // being local accumulators.
  seedSugar: 2.50,        // endosperm, held in the SEED cell itself so it is part of the
  seedWater: 2.00,        // transport network. A seedling must reach light before it can
                          // earn anything, so a long juvenile phase needs a bigger seed —
                          // a real trade-off. Provisioning becomes a trait in Stage 4.
  leafSenescence: 120,    // a leaf below its own compensation point — earning less than it
                          // costs to maintain — for this many consecutive ticks is shed.
                          // LOCAL balance, deliberately: the general debt rule prunes by
                          // DISTANCE from the sugar source, and roots are always furthest, so
                          // it sheds the root system first and the plant dies of thirst
                          // (measured: crown rise reached height 21 but root count hit 0).
                          // Real leaf abscission is triggered by the leaf's own carbon
                          // balance at the light compensation point, which targets exactly
                          // the shaded tissue and leaves roots alone.
  cellDebtLimit: 0.06,    // a cell may run a sugar deficit this deep before it dies. Newly
                          // built cells start empty and are fed by transport; without some
                          // tolerance every cell dies the tick after it is built. It also
                          // gives self-pruning its meaning: a branch that stays a net carbon
                          // sink long enough is shed, rather than one that dips for a tick.

  economyOff: false,      // CONTROL CONDITION, not a model feature: disables resource gating,
                          // maintenance and senescence, giving pure Stage 2 semantics (every
                          // tip executes every tick). Used to test the interpreter
                          // independently of the economy, and it is the ablation Stage 5
                          // needs to show what the economy contributes.

  // --- view ---
  view: 0,                // 0 = moisture, 1 = light, 2 = cell type

  // --- engine ---
  updatesPerDraw: 1,      // fast-forward: sim updates per rendered frame

  // --- data collection ---
  reportingPeriod: 25,    // sample metrics every N ticks
  epoch: 1500,            // a run ends (and ships a packet) at N ticks

  // --- database (the standard vendored client, src/db.js) ---
  db: {
    transport: 'socket',
    server: 'https://research.climbinggiants.com:8888',
    mongoUrl: 'mongodb://127.0.0.1:27017',
    db: 'plantworldDB',
    run: 'run',
  },
};

// Schema drives the auto-generated control panel (ui.js). One entry per live-tunable.
var PARAM_SCHEMA = [
  { key: 'view', label: 'View (0 wet/1 light/2 type)', min: 0, max: 2, step: 1 },
  { key: 'updatesPerDraw', label: 'Speed', min: 1, max: 60, step: 1 },
  { key: 'diffusion', label: 'Diffusion', min: 0, max: 0.24, step: 0.01 },
  { key: 'drainage', label: 'Drainage', min: 0, max: 0.3, step: 0.01 },
  { key: 'fieldCapacity', label: 'Field capacity', min: 0, max: 1, step: 0.05 },
  { key: 'conductivityExp', label: 'Conductivity exp', min: 0, max: 4, step: 1 },
  { key: 'wiltingPoint', label: 'Wilting point', min: 0, max: 0.4, step: 0.01 },
  { key: 'evaporation', label: 'Evaporation', min: 0, max: 0.05, step: 0.002 },
  { key: 'rainPeriod', label: 'Rain period (0=off)', min: 0, max: 600, step: 10 },
  { key: 'rainAmount', label: 'Rain amount', min: 0, max: 1, step: 0.05 },
  { key: 'rainPatchiness', label: 'Rain patchiness', min: 0, max: 1, step: 0.05 },
  { key: 'tauLeaf', label: 'Leaf transmittance τ', min: 0.05, max: 0.95, step: 0.05 },
  { key: 'uptakeRate', label: 'Root uptake', min: 0, max: 0.1, step: 0.005 },
  { key: 'deltaIndex', label: 'delta (face select)', min: 1, max: 5, step: 1, resets: true },
  { key: 'nSeeds', label: 'Seeds', min: 1, max: 12, step: 1, resets: true },
  { key: 'photoRate', label: 'Photosynthesis', min: 0, max: 0.1, step: 0.005 },
  { key: 'transpiration', label: 'Transpiration', min: 0, max: 0.06, step: 0.002 },
  { key: 'maintenance', label: 'Maintenance', min: 0, max: 0.006, step: 0.0002 },
  { key: 'transportRate', label: 'Transport', min: 0, max: 0.24, step: 0.01 },
  { key: 'transportIters', label: 'Transport steps', min: 1, max: 16, step: 1 },
  { key: 'tipDrawFloor', label: 'Tip draw floor', min: 0, max: 0.2, step: 0.01 },
  { key: 'cellSugarCost', label: 'Cell cost (sugar)', min: 0.02, max: 0.5, step: 0.02 },
  { key: 'leafSenescence', label: 'Leaf senescence (ticks)', min: 10, max: 600, step: 10 },
  { key: 'terrainAmp', label: 'Terrain relief', min: 0, max: 0.15, step: 0.01, resets: true },
  { key: 'seed', label: 'Seed', min: 1, max: 99999, step: 1, resets: true },
];
