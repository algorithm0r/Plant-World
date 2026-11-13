'use strict';
// Single source of truth for every tunable. Serialized verbatim into every saved data
// packet (see datamanager.js) so any run reconstructs from its stored parameters.
// Declared `var` so it's a global in the browser AND headless.
//
// Stage 1 scope: the environment only — terrain, soil water (two sources), light.
// No genome, no tips. See MODEL.md and DEVPLAN Stage 1.
var PARAMETERS = {
  // --- grid ---
  gridW: 400,             // cells across  (x cellSize = canvas width, so 1600 px)
  gridH: 150,             // cells down
  cellSize: 4,            // px per cell when rendering
  seed: 12345,            // drives terrain relief and rain patchiness; runs are reproducible

  // --- terrain ---
  surfaceFraction: 0.55,  // mean soil surface, as a fraction of grid height from the top
  terrainAmp: 0.06,       // relief amplitude, as a fraction of grid height
  terrainScale: 5.0,      // undulations across the WIDTH, so it must scale with gridW or
                          // hills stretch. Doubled alongside gridW 200->400 to keep each
                          // hill the same size and simply give more of them — which matters,
                          // because hill width sets how much of the world is valley (table
                          // within root reach) versus ridge (not).

  // --- water source 1: the table (deep, reliable) ---
  tableDepth: 0.67,       // water table top, as a fraction of grid height from the top.
                          // MUST be within root reach or the deep layer does not exist for
                          // any real plant. At 0.88 the table sat 41-57 rows below the
                          // surface while `GL*` roots reach 14, so every plant lived purely
                          // on rain and Walter's two-layer mechanism was inert — all the
                          // deep-water measurements had used HAND-PLACED roots. At 0.64 the
                          // At 0.67 the table is ~10 rows below low ground and ~26 below
                          // high ground: reachable in the valleys, out of reach on the
                          // ridges, which is exactly the split the niche needs — while still
                          // leaving a real soil column to hold a depth gradient. (0.64 made
                          // it reachable but left only 5 rows of soil, too thin to measure.)
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
  genome: 'GL@@@!GLBF*',   // founder: a leafy juvenile axis (`GL` repeated by a unary `@`
                          // run), then `!` commits the meristem to a seeding adult phase
                          // repeated by `*`, with `B` branching in the ADULT phase. It must
                          // contain `F` or nothing reproduces, and `B` or nothing branches —
                          // the previous founder had no `B` and produced only bare stalks.
                          // Chosen so branching is VISIBLE, not because it is fittest: a
                          // controlled test puts unbranched `GL@@@!GLF*` ahead (413 births vs
                          // 286 over 12k ticks). `B` helps with a long juvenile phase and
                          // hurts with a short one — see the epistasis table in MODEL.md.
                          // Try 'GL@@@!GLF*' (fittest), 'GL@@@!GLF@@@' (annual: no `*`, so it
                          // dies when its program ends), 'GL*' (no reproduction),
                          // 'GG!SSSSSSL*' (rhizome), 'GL@@@@@B@!GLF*' (branch mid-juvenile).
  nSeeds: 8,              // founder plants, sown evenly across the width
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
  seedCost: 3.40,         // sugar for one propagule. Must exceed what the seed carries
                          // (seedCost x seedProvision) or reproduction creates energy.
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
  storeRelease: 0.12,     // storage LOADS at the full transport rate but UNLOADS at this
                          // fraction of it. The asymmetry is the whole point: starch has to
                          // be remobilised, which is slower than laying it down. It makes a
                          // store a low-pass filter on the carbon budget — surplus is
                          // sequestered instead of immediately funding growth, and deficit
                          // is met from reserve instead of pushing every cell into debt at
                          // once. That is the candidate fix for the overshoot instability.
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

  // --- reproduction and inheritance (Stage 4) ---
  seedProvision: 0.75,    // fraction of seedCost that reaches the seed as endosperm. MUST be
                          // < 1: if a seed carried more sugar than it cost, `F` would be an
                          // energy source and selection would find that immediately.
  dispersalMean: 14,      // mean dispersal distance in cells; direction is +/- x. LOCAL by
                          // design — a global kernel means the best competitor wins
                          // everywhere and refuges stop existing (MODEL.md).
  seedDormancy: 60,       // ticks a seed waits before it may germinate
  seedLifespan: 4000,     // ticks after which an ungerminated seed is lost from the bank
  minClone: 4,            // a cut-loose fragment smaller than this cannot make it as an
                          // independent ramet and simply falls
  maxPlants: 600,         // safety cap on simultaneous plants
  lamarckian: false,      // false = the seed carries the parent GERMLINE (untruncated).
                          // true = it carries the parent tip's `!`-truncated working copy.
                          // A one-line experimental switch, not a redesign — see MODEL.md.

  // --- plant death ---
  // Until now a plant died ONLY by starving cell-by-cell to nothing. Two mechanisms were
  // missing, and both were already flagged as open (monocarpic senescence in MODEL.md,
  // random mortality as a Stage 5 disturbance knob).
  plantMortality: 0.00006, // per plant per tick, density-INDEPENDENT background mortality.
                          // This is the disturbance that opens gaps; without it the only way
                          // to free space is for a plant to starve, which is
                          // density-dependent and so cannot create the gaps a pioneer needs.
  plantSenescence: 500,   // ticks a plant survives after its program ENDS (all tips gone).
                          // A determinate genome — one with no `*` — finishes its tape and is
                          // then a completed adult that cannot grow or reproduce further.
                          // Monocarpic plants die after fruiting; this is that, and it is
                          // what completes the annual/perennial axis. A `*` meristem never
                          // runs out of tape, so perennials are simply not subject to it.

  // --- mutation ---
  mutPoint: 0.010,        // per-symbol substitution probability
  mutIndel: 0.060,        // probability of one insertion or deletion per reproduction
  mutSlip: 0.120,         // probability of expanding/contracting an `@` run by one. The
                          // microsatellite analogue: unary counts make repeat number a
                          // smooth quantitative trait (MODEL.md).
  mutDup: 0.040,          // probability of a tandem duplication of a random substring —
                          // how real genomes build modules, and the raw material for
                          // divergence.

  // --- view ---
  view: 0,                // 0 = combined (sky = light, ground = moisture), 1 = light only,
                          // 2 = moisture only, 3 = cell type

  // --- engine ---
  updatesPerDraw: 12,     // fast-forward: sim updates per rendered frame. Population
                          // dynamics live at t>5000, which is minutes of wall-clock at 1.

  // --- data collection ---
  reportingPeriod: 25,    // sample metrics every N ticks
  epoch: 60000,           // a run ends (and ships a packet) at N ticks. Long, because the
                          // interesting behaviour (turnover, drift) is tens of thousands.

  // --- database (the standard vendored client, src/db.js) ---
  db: {
    transport: 'socket',
    server: 'https://research.climbinggiants.com:8888',
    mongoUrl: 'mongodb://127.0.0.1:27017',
    db: 'plantworldDB',
    run: 'run',
  },
};

// Schema drives the control strip (ui.js, via Claude Basic's CB.sim.controls). One entry per
// live-tunable. `front: true` puts a control in the short strip under the world; the rest sit
// behind "All model parameters", so a first-time viewer meets eight controls, not thirty.
// `resets: true` rebuilds the world when the slider is released.
var PARAM_SCHEMA = [
  { key: 'view', label: 'Colour the world by', front: true, options: [
    { value: 0, label: 'Light and water' }, { value: 1, label: 'Light only' },
    { value: 2, label: 'Soil moisture' }, { value: 3, label: 'Cell type' }] },
  { key: 'updatesPerDraw', label: 'Speed (ticks per frame)', min: 1, max: 60, step: 1, front: true },
  { key: 'nSeeds', label: 'Founder seeds sown', min: 1, max: 40, step: 1, resets: true, front: true },
  { key: 'rainPeriod', label: 'Rain every (ticks, 0 = never)', min: 0, max: 600, step: 10, front: true },
  { key: 'rainAmount', label: 'Rain amount', min: 0, max: 1, step: 0.05, front: true },
  { key: 'plantMortality', label: 'Random death chance per tick', min: 0, max: 0.001, step: 0.00002, front: true },
  { key: 'dispersalMean', label: 'Seed dispersal (cells)', min: 1, max: 80, step: 1, front: true },
  { key: 'mutPoint', label: 'Point mutation rate', min: 0, max: 0.05, step: 0.002, front: true },
  { key: 'diffusion', label: 'Soil diffusion', min: 0, max: 0.24, step: 0.01 },
  { key: 'drainage', label: 'Drainage', min: 0, max: 0.3, step: 0.01 },
  { key: 'fieldCapacity', label: 'Field capacity', min: 0, max: 1, step: 0.05 },
  { key: 'conductivityExp', label: 'Conductivity exponent', min: 0, max: 4, step: 1 },
  { key: 'wiltingPoint', label: 'Wilting point', min: 0, max: 0.4, step: 0.01 },
  { key: 'evaporation', label: 'Evaporation', min: 0, max: 0.05, step: 0.002 },
  { key: 'rainPatchiness', label: 'Rain patchiness', min: 0, max: 1, step: 0.05 },
  { key: 'tauLeaf', label: 'Leaf transmittance τ', min: 0.05, max: 0.95, step: 0.05 },
  { key: 'uptakeRate', label: 'Root uptake', min: 0, max: 0.1, step: 0.005 },
  { key: 'deltaIndex', label: 'δ (branch face rule)', min: 1, max: 5, step: 1, resets: true },
  { key: 'plantSenescence', label: 'Senescence (ticks)', min: 50, max: 4000, step: 50 },
  { key: 'mutSlip', label: '@-run slippage', min: 0, max: 0.4, step: 0.02 },
  { key: 'mutDup', label: 'Duplication rate', min: 0, max: 0.2, step: 0.01 },
  { key: 'photoRate', label: 'Photosynthesis rate', min: 0, max: 0.1, step: 0.005 },
  { key: 'transpiration', label: 'Transpiration', min: 0, max: 0.06, step: 0.002 },
  { key: 'maintenance', label: 'Maintenance cost per cell', min: 0, max: 0.006, step: 0.0002 },
  { key: 'transportRate', label: 'Transport rate', min: 0, max: 0.24, step: 0.01 },
  { key: 'transportIters', label: 'Transport sub-steps', min: 1, max: 16, step: 1 },
  { key: 'tipDrawFloor', label: 'Tip draw floor', min: 0, max: 0.2, step: 0.01 },
  { key: 'cellSugarCost', label: 'Cell cost (sugar)', min: 0.02, max: 0.5, step: 0.02 },
  { key: 'leafSenescence', label: 'Leaf senescence (ticks)', min: 10, max: 600, step: 10 },
  { key: 'terrainAmp', label: 'Terrain relief', min: 0, max: 0.15, step: 0.01, resets: true },
  { key: 'seed', label: 'Random seed', min: 1, max: 99999, step: 1, resets: true },
];
