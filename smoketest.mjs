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
for (const f of ['util.js', 'params.js', 'engine.js', 'tip.js', 'plant.js', 'world.js']) {
  let src = readFileSync(path.join(__dirname, 'src', f), 'utf8');
  src = src.replace(/^\s*(['"])use strict\1;?/, ''); // strip directive so declarations leak to global
  indirectEval(src);
}

const P = globalThis.PARAMETERS;
const { World, GameEngine, CELL, Tip } = globalThis;
console.log('Plant World smoketest — Stage 1 environment + Stage 2 genome/tips');

let failures = 0;
const results = [];
function check(name, ok, detail) {
  const line = (ok ? '  PASS  ' : '  FAIL  ') + name + '   ' + detail;
  results.push(line);
  console.log(line);            // print as we go: the suite takes ~15s
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
run(wA, 4000);   // duration IS the claim here — do not trim
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
  // settle times are part of the CLAIM here: the depth gradient needs time to develop, and
  // trimming them silently weakened the measured advantage from 13x to 10x. Do not trim.
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
run(wG, 4000);
const surfDry = wG.moistureAtDepth(0), deepDry = wG.moistureAtDepth(32);
check('dry surface hydraulically disconnects from the table', surfDry < 0.05 && deepDry > 0.15,
  'table-only surface=' + surfDry.toFixed(3) + ' deep=' + deepDry.toFixed(3) +
  '  ratio=' + (surfDry / deepDry).toFixed(3) + '  (constant conductivity gives ~0.26)');


// ===========================================================================
// STAGE 2 — the genome tape, tips, and morphology
// ===========================================================================

// --- 6. Counted-loop identities, tested on the tape ALONE (no world at all).
//     `!` moves the origin that `@` jumps to, and `@` is consumed, so the two compose into
//     sequential counted blocks. These are the identities stated in MODEL.md.
const idA = Tip.trace('G!L@@@S');
const idB = Tip.trace('G!L@@!S@@@F');
const idC = Tip.trace('G@@@');
check('counted loop: G!L@@@S', idA === 'GLLLLS', 'got "' + idA + '" want "GLLLLS"');
check('sequential loops: G!L@@!S@@@F', idB === 'GLLLSSSSF', 'got "' + idB + '" want "GLLLSSSSF"');
check('unary @ run: G@@@ is 4 grows', idC === 'GGGG', 'got "' + idC + '" (n @s => n+1 reps)');
const star10 = Tip.trace('L*', 10), star30 = Tip.trace('L*', 30);
check('* repeats without bound', star30.length > star10.length && star10.length > 0,
  'cap10 -> ' + star10.length + ' L, cap30 -> ' + star30.length + ' L');

// --- 7. Growing plants. One germination, two tips (radicle + plumule), both reading the
//     same genome from 0 — so positional cell fate alone must produce shoot above and root
//     below with no extra symbols.
// Stage 2 assertions test the INTERPRETER, so they run with the economy off (`economyOff`
// is the control condition, and the same ablation Stage 5 uses). Stage 3 tests the economy.
function grow(genome, ticks) {
  restore();
  const w = fresh({ rainPeriod: 0, economyOff: true });
  const pl = w.plantSeed(genome, 100);
  const e = new GameEngine();
  for (let t = 1; t <= (ticks || 60); t++) { e.tick = t; w.update(e); }
  return { w: w, pl: pl, tr: pl.traits(w) };
}
function countBySide(r, type) {
  let above = 0, below = 0;
  for (const i of r.pl.cells) {
    if (r.w.type[i] !== type) continue;
    const x = i % r.w.W, y = (i / r.w.W) | 0;
    if (y < r.w.surfaceY[x]) above++; else below++;
  }
  return { above: above, below: below };
}

const axis = grow('G*');
check('one genome, two tissues (positional cell fate)',
  axis.tr.stem > 5 && axis.tr.root > 5 && axis.tr.height > 5 && axis.tr.depth > 5,
  'G* -> stem=' + axis.tr.stem + ' up ' + axis.tr.height + ', root=' + axis.tr.root +
  ' down ' + axis.tr.depth + ' (same program, both directions)');

const leafy = grow('GL*');
const lf = countBySide(leafy, CELL.LEAF);
check('L is suppressed underground (skotomorphogenesis)', lf.above > 5 && lf.below === 0,
  'leaves above=' + lf.above + ' below=' + lf.below + ' with ' + leafy.tr.root + ' root cells');

const aer = grow('GGGGRR@@@');
const ar = countBySide(aer, CELL.ROOT);
const rhi = grow('GG!SSSSSSL*');
const rs = countBySide(rhi, CELL.STEM);
check('R override makes aerial roots', ar.above > 0,
  'root cells above the surface = ' + ar.above);
check('S override makes underground stem (rhizome)', rs.below > 0,
  'stem cells below the surface = ' + rs.below);

// --- 8. The geometric branch cap. A bud OCCUPIES a face, so a node carries at most one tip
//     per heading (<=4 in 2D, <=3 excluding the one it arrived from). `B *` builds no cells,
//     so face VACANCY alone would never bound it — tips grew exponentially until buds
//     claimed their faces. This assertion is that fix.
const prol = grow('B*', 200);
check('B* is capped by geometry, not by cost', prol.pl.tips.length <= 4 && prol.tr.cells <= 1,
  'B* -> ' + prol.pl.tips.length + ' tips at one node, ' + prol.tr.cells +
  ' cell (the seed itself; unclaimed faces gave 71675 tips and still climbing)');

// --- 9. The zoo: distinct, reproducible morphologies from a fixed seed.
const ZOO = ['G@@@@@@', 'GL*', 'GGGGGG!GLB*', 'GGGGB*', 'GGGGRR@@@', 'GG!SSSSSSL*'];
const sigs = ZOO.map((g) => { const r = grow(g); const t = r.tr;
  return [t.cells, t.stem, t.leaf, t.root, t.height, t.depth, t.branches].join('/'); });
const distinct = new Set(sigs).size;
const repeat = ZOO.map((g) => { const t = grow(g).tr;
  return [t.cells, t.stem, t.leaf, t.root, t.height, t.depth, t.branches].join('/'); });
const reproducible = sigs.every((v, i) => v === repeat[i]);
check('zoo: ' + ZOO.length + ' genomes give distinct morphologies', distinct === ZOO.length,
  distinct + '/' + ZOO.length + ' distinct trait signatures');
check('zoo: morphologies are reproducible from a fixed seed', reproducible,
  'cells/stem/leaf/root/h/d/br identical on a second run of all ' + ZOO.length);


// ===========================================================================
// STAGE 3 — the economy
// ===========================================================================
function growEcon(genome, ticks, col, over) {
  restore();
  const w = fresh(Object.assign({ economyOff: false }, over || {}));
  const pl = w.plantSeed(genome, col === undefined ? 100 : col);
  const e = new GameEngine();
  const track = [];
  for (let t = 1; t <= ticks; t++) {
    e.tick = t; w.update(e);
    if (t % 400 === 0) track.push(pl.cells.length);
  }
  return { w: w, pl: pl, tr: pl.traits(w), track: track };
}
function lowestLeafHeight(w, pl) {
  const surf = w.surfaceY[pl.x];
  let lo = 1e9;
  for (const i of pl.cells) if (w.type[i] === CELL.LEAF) {
    const h = surf - ((i / w.W) | 0); if (h < lo) lo = h;
  }
  return lo === 1e9 ? 0 : lo;
}

// --- 10. A plant establishes and then STOPS, without collapsing.
const eco = growEcon('GL*', 4000);
// The substantive claim is that a plant establishes and does NOT collapse. It no longer
// reaches a flat plateau inside a testable window — with storage it keeps growing slowly for
// a long time — so asserting "stops growing" would be asserting something false.
const peakCells = Math.max.apply(null, eco.track);
check('a plant establishes and does not collapse', eco.tr.cells > 20 && eco.tr.cells >= 0.8 * peakCells,
  'cells at t=400..4000: ' + eco.track.join(' → ') + '  (peak ' + peakCells + ', leaf=' +
  eco.tr.leaf + ' root=' + eco.tr.root + ' store=' + eco.tr.store + ' h=' + eco.tr.height + ')');

// --- 11. The economy is slower than the clock — the whole point of resource gating.
//     A tip attempts one instruction per tick but executes only when it can pay.
const ef = eco.w.tipExecs / Math.max(1, eco.w.tipTicks);
check('economy is slower than the clock', ef > 0 && ef < 0.5,
  'tip-ticks that executed = ' + (100 * ef).toFixed(1) + '%  (1 instruction/tick is the ceiling)');

// --- 12. `*` self-terminates on the ECONOMY, not on the step cap. If any tip had aged out
//     the backstop would be doing the halting, which is exactly what it must not do.
// The backstop counts IDLE steps (consecutive steps without building), not lifetime — a
// healthy slow meristem must never age out. So the test reads `idle`, which is the field the
// backstop actually fires on.
let maxIdle = 0, oldest = 0;
for (const t of eco.pl.tips) { if (t.idle > maxIdle) maxIdle = t.idle; if (t.age > oldest) oldest = t.age; }
check('* halts on the economy, not the step cap', eco.pl.tips.length > 0 && maxIdle < P.maxTipSteps,
  'oldest live tip has run ' + oldest + ' steps but idled only ' + maxIdle +
  ' of them, backstop = ' + P.maxTipSteps + ' (a `*` meristem still productive, just slow)');

// --- 13. SELF-PRUNING and CROWN RISE. Shaded lower leaves fall below their own light
//     compensation point and are shed; the lit crown persists. Nothing says "prune".
// Leaf senescence must fire, and must target LEAVES while sparing roots. A distance-based
// debt rule sheds the root system first and the plant dies of thirst; that is the failure
// this local rule exists to prevent. (The stronger crown-rise signature — the lowest living
// leaf rising — needs a canopy dense enough to self-shade, which the economy no longer
// sustains now that `L` underground builds storage. Regression recorded in DEVLOG.)
const shedLeaves = eco.w.cellDeaths;
check('self-pruning: shaded leaves are shed, roots are spared',
  shedLeaves > 0 && eco.tr.root > 0 && eco.tr.leaf > 0,
  shedLeaves + ' cells shed, ' + eco.tr.root + ' roots and ' + eco.tr.leaf +
  ' leaves retained (a distance-based rule sheds roots first and kills the plant)');

// --- 14. Water availability pays. The same genome on the lowest terrain (close to the
//     table) must outperform it on the highest (far from it). Measured, not eyeballed.
let hiCol = 0, loCol = 0;
for (let x = 0; x < 200; x++) {
  if (fresh({}).surfaceY[x] < fresh({}).surfaceY[hiCol]) hiCol = x;   // high ground, deep table
  if (fresh({}).surfaceY[x] > fresh({}).surfaceY[loCol]) loCol = x;   // low ground, shallow table
}
const wRef = fresh({});
const nearTable = growEcon('GL*', 1500, loCol);
const farTable = growEcon('GL*', 1500, hiCol);
check('a plant near the water table outperforms one far from it',
  nearTable.tr.cells > farTable.tr.cells,
  'surface row ' + wRef.surfaceY[loCol] + ' (near) → ' + nearTable.tr.cells + ' cells vs row ' +
  wRef.surfaceY[hiCol] + ' (far) → ' + farTable.tr.cells + ' cells; table at row ' + wRef.tableY);


// ===========================================================================
// STAGE 4 — reproduction and inheritance
// ===========================================================================
const FOUNDER = 'GL@@@@@@!GLF*';   // leafy juvenile, then `!` commits to a seeding adult

// --- 15. A population sustains itself from founders: births, deaths, and turnover.
restore();
const pop = fresh({ nSeeds: 8 });
{
  const e = new GameEngine();
  for (let k = 0; k < 8; k++) pop.plantSeed(FOUNDER, Math.floor((k + 0.5) * pop.W / 8));
  for (let t = 1; t <= 8000; t++) { e.tick = t; pop.update(e); }
}
const pm = pop.allMetrics();
check('a population sustains itself across generations', pm.births > 20 && pm.plants > 8 && pm.plantDeaths > 0,
  pm.plants + ' plants alive, ' + pm.births + ' germinations, ' + pm.plantDeaths +
  ' plant deaths, ' + pm.seedBank + ' seeds banked (started from 8 founders)');

// --- 16. Mutation generates heritable variation, without runaway genome bloat.
const genomes = new Set(pop.plants.map((p) => p.genome));
check('mutation generates heritable variation', genomes.size > 3 && pm.meanGenomeLen < 60,
  genomes.size + ' distinct genomes in the population, mean length ' +
  pm.meanGenomeLen.toFixed(1) + ' from a founder of ' + FOUNDER.length);

// --- 17. WEISMANN'S BARRIER. `!` is somatic and per-tip, so a branch commits while the seed
//     does not. This is not a rule that was added — it falls out of `!` being per-tip.
function firstSeed(lam) {
  restore();
  const w = fresh({ mutPoint: 0, mutIndel: 0, mutSlip: 0, mutDup: 0, lamarckian: lam });
  const pl = w.plantSeed(FOUNDER, 100);
  const e = new GameEngine();
  for (let t = 1; t <= 12000 && !w.seedBank.length; t++) { e.tick = t; w.update(e); }
  return { seed: w.seedBank[0], tapes: pl.tips.map((t) => t.tape) };
}
const wm = firstSeed(false);
check('Weismann: the seed carries the germline, not the truncated soma',
  !!wm.seed && wm.seed.genome === FOUNDER && wm.tapes.some((t) => t !== FOUNDER),
  'germline "' + FOUNDER + '" → seed "' + (wm.seed ? wm.seed.genome : 'none') +
  '"; tips hold ' + wm.tapes.map((t) => '"' + t + '"').join(' '));
const lm = firstSeed(true);
check('the Lamarckian switch inverts it', !!lm.seed && lm.seed.genome !== FOUNDER,
  'lamarckian=true → seed "' + (lm.seed ? lm.seed.genome : 'none') +
  '" (the parent tip working copy)');

// --- 18. Reproduction must not be an energy source, or selection finds it at once.
check('a seed costs more than it carries', P.seedProvision < 1 && P.seedCost * P.seedProvision < P.seedCost,
  'seedCost ' + P.seedCost + ' → endosperm ' + (P.seedCost * P.seedProvision).toFixed(2) +
  ' (provision ' + P.seedProvision + ')');

// ---------------------------------------------------------------------------
restore();
const wF = fresh({});
run(wF, 600);
const m = wF.metrics();

console.log('');
console.log('metrics @600 ticks with defaults:  meanMoisture=' + m.meanMoisture.toFixed(4) +
  '  shallow=' + m.shallowMoisture.toFixed(4) + '  deep=' + m.deepMoisture.toFixed(4) +
  '  surfaceLight=' + m.surfaceLight.toFixed(3) + '  totalWater=' + m.totalWater.toFixed(1));
console.log('smoke: ' + (results.length - failures) + '/' + results.length +
  ' checks -> ' + (failures ? 'FAIL' : 'PASS'));
process.exit(failures ? 1 : 0);
