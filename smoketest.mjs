// No-DB sanity run. Verifies the Stage 1 invariants and prints the numbers that belong in
// the DEVLOG entry (proof coupled to log). Exits non-zero on failure.
//   node smoketest.mjs
//
// Loads the SAME browser sim files into the MAIN V8 realm via indirect eval (NOT vm).
// Everything in src/ is `var` / `function` / `var X = class X`, so once the leading
// 'use strict' directive is stripped the top-level names attach to globalThis and read as
// fast native globals. Main-realm (not vm) because vm adds a ~7-10x hot-loop tax on per-tick
// global reads (e.g. PARAMETERS.*) and a one-config run never needs vm's isolation — see
// ~/.claude/conventions.md §4.
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const indirectEval = eval; // aliased → runs in the global (sloppy) realm, so `var` leaks to globalThis
for (const f of ['util.js', 'params.js', 'engine.js', 'tip.js', 'world.js']) {
  let src = readFileSync(path.join(__dirname, 'src', f), 'utf8');
  src = src.replace(/^\s*(['"])use strict\1;?/, ''); // strip directive so declarations leak to global
  indirectEval(src);
}

const P = globalThis.PARAMETERS;
const { World, GameEngine, CELL } = globalThis;

let failures = 0;
const results = [];
function check(name, ok, detail) {
  results.push((ok ? '  PASS  ' : '  FAIL  ') + name + '   ' + detail);
  if (!ok) failures++;
}
// One engine per world, kept across calls: rain fires on `tick % rainPeriod`, so a fresh
// engine per call would restart the clock at 1 and rain would never land.
const engines = new WeakMap();
const run = (w, n) => {
  let e = engines.get(w);
  if (!e) { e = new GameEngine(); engines.set(w, e); }
  for (let k = 0; k < n; k++) { e.tick++; w.update(e); }
};
const fresh = (over) => { Object.assign(P, over || {}); return new World(P.gridW, P.gridH); };
const BASE = JSON.parse(JSON.stringify({
  rainPeriod: P.rainPeriod, rainAmount: P.rainAmount, evaporation: P.evaporation,
  uptakeRate: P.uptakeRate, drainage: P.drainage,
}));
const restore = () => Object.assign(P, BASE);

// ---------------------------------------------------------------------------
// 1. The moisture field settles, and settles into a monotone depth profile.
//    Rain off and uptake off, so the table is the only source: water must rise from below
//    and the steady state must get wetter with depth. Asserts convergence numerically
//    rather than "looks stable".
// ---------------------------------------------------------------------------
restore();
const wA = fresh({ rainPeriod: 0, uptakeRate: 0 });
run(wA, 4000);
const settled = wA.maxDelta;   // NET change across a whole tick, not the diffusion half-step
const profile = [0, 2, 4, 8, 16, 24, 32].map((d) => wA.moistureAtDepth(d));
let monotone = true;
for (let k = 1; k < profile.length; k++) if (profile[k] < profile[k - 1] - 1e-3) monotone = false;

check('field converges (no rain, no uptake)', settled < 1e-5,
  'maxΔ/tick=' + settled.toExponential(2) + ' after 4000 ticks');
check('moisture increases monotonically with depth', monotone,
  'depths 0,2,4,8,16,24,32 → ' + profile.map((v) => v.toFixed(3)).join(' '));

// ---------------------------------------------------------------------------
// 2. Light is GRADED, not binary — the decision the understory niche depends on.
//    A hand-placed stack of leaves must attenuate as τ^k, and light below several leaves
//    must remain strictly positive.
// ---------------------------------------------------------------------------
restore();
const wB = fresh({});
const col = 40, topAir = wB.surfaceY[col] - 12;
for (let k = 0; k < 5; k++) wB.set(col, topAir + k, CELL.LEAF);
wB.computeLight();
const tau = P.tauLeaf;
let maxErr = 0;
for (let k = 0; k <= 5; k++) {
  const got = wB.light[wB.idx(col, topAir + k)];
  const want = Math.pow(tau, k);
  maxErr = Math.max(maxErr, Math.abs(got - want));
}
const under5 = wB.light[wB.idx(col, topAir + 5)];
const clearCol = wB.light[wB.idx(col + 20, topAir + 5)];
let strictlyDecreasing = true;
for (let k = 1; k <= 5; k++) {
  if (!(wB.light[wB.idx(col, topAir + k)] < wB.light[wB.idx(col, topAir + k - 1)])) strictlyDecreasing = false;
}

check('light attenuates as τ^k through a leaf stack', maxErr < 1e-6,
  'τ=' + tau + '  max|got-τ^k|=' + maxErr.toExponential(2));
check('shade is graded, not binary', strictlyDecreasing && under5 > 0 && under5 < clearCol,
  'under 5 leaves=' + under5.toFixed(5) + '  open column=' + clearCol.toFixed(3) +
  '  (>0 ⇒ an understory is viable)');

// ---------------------------------------------------------------------------
// 3. Rain is TRANSIENT — it must spike the surface and then decay away. If surface water
//    were permanent the shallow/deep distinction (Walter's two layers) would collapse.
// ---------------------------------------------------------------------------
restore();
const wC = fresh({ uptakeRate: 0 });
run(wC, P.rainPeriod - 1);
const beforeRain = wC.shallowMoisture();
run(wC, 1);                       // the rain tick itself
const justAfter = wC.shallowMoisture();
run(wC, Math.round(P.rainPeriod * 0.8));
const laterOn = wC.shallowMoisture();
const deepC = wC.deepMoisture();

check('rain spikes surface moisture', justAfter > beforeRain + 0.05,
  'before=' + beforeRain.toFixed(3) + ' → after=' + justAfter.toFixed(3));
check('surface dries again between events (rain is transient)', laterOn < justAfter - 0.02,
  'after=' + justAfter.toFixed(3) + ' → ' + Math.round(P.rainPeriod * 0.8) + ' ticks later=' + laterOn.toFixed(3));
check('two layers are distinguishable (deep wetter than dried surface)', deepC > laterOn,
  'deep=' + deepC.toFixed(3) + ' vs shallow=' + laterOn.toFixed(3));

// ---------------------------------------------------------------------------
// 4. A root cell is a real sink, and two worlds built from the same seed are identical.
//    Same seed + same params must reproduce exactly, or nothing above is repeatable.
// ---------------------------------------------------------------------------
restore();
const wD = fresh({ rainPeriod: 0 });
const wE = fresh({ rainPeriod: 0 });
const rx = 70, ry = wD.surfaceY[rx] + 6;
let identical = true;
for (let i = 0; i < wD.n && identical; i++) {
  if (wD.type[i] !== wE.type[i] || Math.abs(wD.moisture[i] - wE.moisture[i]) > 0) identical = false;
}
wD.set(rx, ry, CELL.ROOT);        // wE is the untouched control
run(wD, 600); run(wE, 600);
const withRoot = wD.moisture[wD.idx(rx, ry)];
const control = wE.moisture[wE.idx(rx, ry)];
const drawn = wD.uptake[wD.idx(rx, ry)];

check('two worlds from the same seed are identical', identical, 'cell-by-cell type + moisture');
check('a root cell depletes its own cell', withRoot < control - 1e-4,
  'root cell=' + withRoot.toFixed(4) + ' vs control=' + control.toFixed(4) +
  '  (drawing ' + drawn.toFixed(4) + '/tick)');

// ---------------------------------------------------------------------------
// 5. THE TWO-LAYER TEST — the model's strongest niche axis, and the assertion that would
//    have caught two silent flaws. Uptake must scale with available water (not min(rate,m),
//    which is a step function that makes a root in nearly-dry soil perform identically to
//    one in saturated soil), and the dry surface must be hydraulically DISCONNECTED from
//    the table (constant conductivity lets the table wet the surface, so a shallow root
//    lives off the table and the shallow/deep distinction collapses).
//    The signature is that the ranking INVERTS between the two water regimes.
// ---------------------------------------------------------------------------
function meanUptakeAt(depth, rainPeriod) {
  restore();
  const w = fresh({ rainPeriod, evaporation: 0.010 });
  run(w, 3000);
  const sx = 100;
  w.set(sx, w.surfaceY[sx] + depth, CELL.ROOT);
  run(w, 2000);
  let tot = 0;
  for (let k = 0; k < 300; k++) { run(w, 1); for (let i = 0; i < w.n; i++) tot += w.uptake[i]; }
  return { uptake: tot / 300, world: w };
}
// capture the base rain period FIRST — each call mutates P, so reading P.rainPeriod as a
// later argument would pick up whatever the previous call left behind (it left 0).
const RAIN = BASE.rainPeriod;
const dryShallow = meanUptakeAt(2, 0).uptake;
const dryDeep = meanUptakeAt(30, 0).uptake;
const wetShallow = meanUptakeAt(2, RAIN).uptake;
const wetDeep = meanUptakeAt(30, RAIN).uptake;

check('depth pays when the table is the only source', dryDeep > dryShallow * 10,
  'depth2=' + dryShallow.toExponential(1) + ' vs depth30=' + dryDeep.toExponential(1) +
  '  (' + (dryDeep / dryShallow).toFixed(0) + '× — a step-function uptake gives 1×)');
check('rain inverts the ranking (Walter two-layer signature)', wetShallow > wetDeep,
  'with rain: depth2=' + wetShallow.toExponential(1) + ' > depth30=' + wetDeep.toExponential(1));

restore();
const wG = fresh({ rainPeriod: 0, evaporation: 0.010, uptakeRate: 0 });
run(wG, 6000);
const surfDry = wG.moistureAtDepth(0), deepDry = wG.moistureAtDepth(32);
check('dry surface hydraulically disconnects from the table', surfDry < 0.05 && deepDry > 0.15,
  'table-only surface=' + surfDry.toFixed(3) + ' deep=' + deepDry.toFixed(3) +
  '  ratio=' + (surfDry / deepDry).toFixed(3) + '  (constant conductivity gives ~0.26)');

// ---------------------------------------------------------------------------
restore();
const wF = fresh({});
run(wF, 600);
const m = wF.metrics();

console.log('');
console.log('Plant World — Stage 1 smoketest (environment only, no plants)');
console.log(results.join('\n'));
console.log('');
console.log('metrics @600 ticks with defaults:  meanMoisture=' + m.meanMoisture.toFixed(4) +
  '  shallow=' + m.shallowMoisture.toFixed(4) + '  deep=' + m.deepMoisture.toFixed(4) +
  '  surfaceLight=' + m.surfaceLight.toFixed(3) + '  totalWater=' + m.totalWater.toFixed(1));
console.log('smoke: ' + (results.length - failures) + '/' + results.length +
  ' checks -> ' + (failures ? 'FAIL' : 'PASS'));
process.exit(failures ? 1 : 0);
