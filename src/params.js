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
  uptakeRate: 0.02,       // MAXIMUM water a root draws per tick, at full availability
  wiltingPoint: 0.08,     // below this, water is held too tightly to extract at all.
                          // Uptake scales with AVAILABLE water (m - wiltingPoint), never
                          // min(rate, m) — a step function makes a root in nearly-dry soil
                          // perform identically to one in saturated soil, which flattens the
                          // entire water niche and leaves depth nothing to pay for.

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
  { key: 'terrainAmp', label: 'Terrain relief', min: 0, max: 0.15, step: 0.01, resets: true },
  { key: 'seed', label: 'Seed', min: 1, max: 99999, step: 1, resets: true },
];
