'use strict';
// ALL DOM lives here (and in index.html). The sim classes never touch the document, which
// is what keeps them headless. This file:
//   · resolves the world's colour tokens (--pw-* in index.html) for the canvas Observer
//   · builds the control strip from PARAM_SCHEMA with Claude Basic's CB.sim.controls
//   · runs the founder-genome row (presets + a free text genome, sown on Reset)
//   · wires each chart ONCE to the datamanager's own arrays (the kit repaints them)
//   · runs the plant inspector: click a plant, read the genome that grew it
var $ = (id) => document.getElementById(id);

// ── colours ────────────────────────────────────────────────────────────────
// The canvas can't read var(), so resolve the world's tokens to rgb triplets. The kit's
// CB.sim.palette does the resolving (it handles every CSS colour form), so a theme change
// that moves --cb-accent moves the selection box too.
var WORLD_TOKENS = {
  skyDark: '--pw-sky-dark', skyLit: '--pw-sky-lit', shade: '--pw-shade', sun: '--pw-sun',
  soilDry: '--pw-soil-dry', soilWet: '--pw-soil-wet', air: '--pw-air', soil: '--pw-soil',
  water: '--pw-water', root: '--pw-root', stem: '--pw-stem', leaf: '--pw-leaf',
  seed: '--pw-seed', store: '--pw-store', bank: '--pw-bank', tip: '--pw-tip',
  select: '--cb-accent',
};
function worldPalette() {
  const out = {};
  CB.sim.palette(document.body, (res) => {
    for (const k in WORLD_TOKENS) out[k] = res('var(' + WORLD_TOKENS[k] + ')').rgb;
  });
  return out;
}

// ── the genome alphabet, as the inspector explains it ───────────────────────
// Every line here is what tip.js actually does, not what an L-system symbol would mean.
var SYMBOLS = {
  G: { name: 'grow', kind: 'build', tip: 'G - grow one cell ahead and move into it. It makes stem in air and root in soil.' },
  R: { name: 'root', kind: 'build', tip: 'R - grow one cell ahead, always root (an override of G).' },
  S: { name: 'stem', kind: 'build', tip: 'S - grow one cell ahead, always stem (an override of G).' },
  L: { name: 'leaf', kind: 'leaf', tip: 'L - put a leaf on a free side, and the tip stays put. Below ground it becomes a storage scale.' },
  B: { name: 'branch', kind: 'branch', tip: 'B - fork. A new tip starts on a free side and reads the same program from its start.' },
  F: { name: 'seed', kind: 'seed', tip: 'F - make a seed (costs sugar). It carries the full genome, mutated, and lands nearby.' },
  '!': { name: 'commit', kind: 'ctl', tip: '! - commit. This tip forgets everything before here, and its loops now return here.' },
  '@': { name: 'repeat once more', kind: 'ctl', tip: '@ - count. Go back to the loop start and delete this @, so n @s give n+1 passes.' },
  '*': { name: 'repeat forever', kind: 'ctl', tip: '* - forever. Go back to the loop start and keep the *, so the loop never ends.' },
};
var PRESETS = [
  { g: 'GL@@@!GLBF*', label: 'Branching perennial (default)' },
  { g: 'GL@@@!GLF*', label: 'Unbranched perennial' },
  { g: 'GL@@@!GLF@@@', label: 'Annual (no *), dies when its program ends' },
  { g: 'GL@@@@@B@!GLF*', label: 'Branches while young' },
  { g: 'GG!SSSSSSL*', label: 'Rhizome (stem runs on below ground, no seeds)' },
  { g: 'GL*', label: 'Grows forever, never seeds' },
];

function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }

/** a genome as symbol chips; `head` marks the read head (a tip's next instruction) */
function genomeHTML(g, head) {
  if (!g.length) return '<span class="pw-gene empty">(empty: this tip has run off its tape)</span>';
  let out = '';
  for (let i = 0; i < g.length; i++) {
    const c = g[i], s = SYMBOLS[c] || { kind: 'inert', tip: c + ' - not in the alphabet, so it is skipped (no symbol can kill a plant).' };
    out += '<span class="pw-sym ' + s.kind + (i === head ? ' head' : '') + '" data-tip="' + esc(s.tip) + '">' + esc(c) + '</span>';
  }
  return '<span class="pw-gene">' + out + '</span>';
}

// ── controls ───────────────────────────────────────────────────────────────
function buildControls() {
  const front = PARAM_SCHEMA.filter((s) => s.front), rest = PARAM_SCHEMA.filter((s) => !s.front);
  CB.sim.controls($('controls'), front, PARAMETERS, {
    onReset: reset,
    buttons: [
      { label: 'Pause', onClick: (e) => { togglePause(); e.target.textContent = paused ? 'Run' : 'Pause'; } },
      { label: 'Reset', primary: true, onClick: reset },
    ],
  });
  // no buttons here: Pause and Reset already sit in the strip above
  CB.sim.controls($('moreControls'), rest, PARAMETERS, { onReset: reset, buttons: [] });
  $('symKey').innerHTML = Object.keys(SYMBOLS).map((c) =>
    '<span>' + genomeHTML(c) + ' ' + esc(SYMBOLS[c].name) + '</span>').join('');

  // the founder row: a preset list and a free genome, sown on Reset
  const sel = $('preset'), inp = $('genome');
  for (const p of PRESETS) {
    const o = document.createElement('option');
    o.value = p.g; o.textContent = p.label + '  ·  ' + p.g;
    sel.appendChild(o);
  }
  const custom = document.createElement('option');
  custom.value = ''; custom.textContent = 'Your own genome';
  sel.appendChild(custom);
  const sync = () => { sel.value = PRESETS.some((p) => p.g === inp.value) ? inp.value : ''; };
  inp.value = PARAMETERS.genome; sync();
  sel.onchange = () => { if (sel.value) { inp.value = sel.value; sow(); } else inp.focus(); };
  inp.oninput = sync;
  inp.onkeydown = (e) => { if (e.key === 'Enter') sow(); };
  $('sow').onclick = sow;
  function sow() {
    // the language is permissive (unknown symbols are inert), so only tidy case and spaces
    const g = inp.value.toUpperCase().replace(/\s+/g, '');
    if (!g) { CB.toast('A genome needs at least one symbol.'); return; }
    inp.value = g; sync();
    PARAMETERS.genome = g;
    reset();
  }
}

// ── charts: wired once per reset, to the datamanager's own arrays ──────────
function wireCharts(dm) {
  const dx = PARAMETERS.reportingPeriod, s = dm.series, B = DataManager.BINS;
  $('pop').data = { dx: dx, series: [
    { label: 'plants alive', values: s.plants, color: 'var(--pw-leaf)' },
    { label: 'seeds waiting', values: s.seedBank, color: 'var(--pw-bank)' },
  ] };
  $('turnover').data = { dx: dx, series: [
    { label: 'born', values: s.births, color: 'var(--cb-ok)' },
    { label: 'died', values: s.deaths, color: 'var(--cb-bad)' },
  ] };
  $('tissue').data = { dx: dx, series: [
    { label: 'leaf', values: s.leaf, color: 'var(--pw-leaf)' },
    { label: 'stem', values: s.stem, color: 'var(--pw-stem)' },
    { label: 'root', values: s.root, color: 'var(--pw-root)' },
    { label: 'storage scale', values: s.store, color: 'var(--pw-store)' },
  ] };
  $('distinct').data = { dx: dx, series: [{ label: 'genomes', values: s.distinct, color: 'var(--cb-accent)' }] };
  for (const k of ['height', 'depth', 'genome']) {
    const el = $('h-' + k);
    el.setAttribute('lo', B[k].lo); el.setAttribute('hi', B[k].hi); el.setAttribute('bins', B[k].n);
    el.data = { dx: dx, columns: dm.hist[k] };
  }
}

// ── the inspector: click a plant, read its genome ──────────────────────────
var inspected = null;     // the Plant on show (kept after it dies, so its genome stays readable)

/** the plant under a click: the owner of the nearest plant cell within a few cells */
function plantAt(ev) {
  const cv = $('gameWorld'), r = cv.getBoundingClientRect(), w = world;
  const cx = Math.floor((ev.clientX - r.left) / r.width * w.W);
  const cy = Math.floor((ev.clientY - r.top) / r.height * w.H);
  let best = null, bd = Infinity;
  for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
    const x = cx + dx, y = cy + dy;
    if (!w.inBounds(x, y)) continue;
    const id = w.owner[w.idx(x, y)], d = dx * dx + dy * dy;
    if (id >= 0 && d < bd) { bd = d; best = id; }
  }
  return best == null ? null : w.plants.find((p) => p.id === best) || null;
}

function inspect(pl) {
  inspected = pl;
  observer.selected = pl;
  renderInspector(true);
}

function pickTallest() {
  let best = null, bh = -1;
  for (const pl of world.plants) {
    if (!pl.alive) continue;
    const h = pl.traits(world).height;
    if (h > bh) { bh = h; best = pl; }
  }
  if (best) inspect(best); else CB.toast('No plant has come up yet.');
}

/** full = the plant changed (rebuild the germline row too); otherwise just the live parts */
function renderInspector(full) {
  const pl = inspected;
  if (!pl) {
    if (full) {
      $('inspTitle').textContent = 'Founder genome';
      $('inspGermLabel').textContent = 'Genome the founder seeds carry';
      $('inspGenome').innerHTML = genomeHTML(PARAMETERS.genome);
      $('inspFacts').innerHTML = '';
      $('inspTips').innerHTML = '<p class="pw-hint">You can click any plant in the world to read the genome that grew it, and watch each of its growing tips step through that genome.</p>';
    }
    return;
  }
  const dead = !pl.alive || world.plants.indexOf(pl) < 0;
  if (full) {
    $('inspTitle').textContent = 'Plant ' + pl.id + (pl.genome === PARAMETERS.genome ? ' · founder genome' : ' · mutant');
    $('inspGenome').innerHTML = genomeHTML(pl.genome);
    $('inspGermLabel').textContent = 'Genome its seeds carry (germline)';
  }
  const t = dead ? null : pl.traits(world);
  const status = dead ? 'dead' : pl.tips.length ? 'growing' : 'program finished';
  const facts = [
    ['status', status],
    ['age', (pl.age || 0) + ' ticks'],
    ['height', t ? t.height + ' cells' : '–'],
    ['root depth', t ? t.depth + ' cells' : '–'],
    ['cells of leaf · stem · root · storage', t ? [t.leaf, t.stem, t.root, t.store].join(' · ') : '–'],
    ['seeds made', pl.seedsMade],
  ];
  $('inspFacts').innerHTML = facts.map((f) => '<dt>' + f[0] + '</dt><dd>' + esc(f[1]) + '</dd>').join('');
  const tips = pl.tips.filter((tp) => !tp.dead), SHOW = 6;
  $('inspTips').innerHTML = tips.length
    ? '<div class="cb-label">' + (tips.length > 1
        ? tips.length + ' growing tips, each reading its own copy of the program'
        : '1 growing tip, reading its own copy of the program') + '</div>' +
      '<div class="pw-hint">The ringed symbol is the one each tip reads next. ! and @ shorten a copy as it runs.</div>' +
      tips.slice(0, SHOW).map((tp) => '<div class="pw-tip">' + genomeHTML(tp.tape, tp.p) + '</div>').join('') +
      (tips.length > SHOW ? '<div class="pw-hint">and ' + (tips.length - SHOW) + ' more</div>' : '')
    : '<p class="pw-hint">' + (dead ? 'This plant has died. Its genome is shown above.'
      : 'No tip is still growing, since every tip has run off the end of its program.') + '</p>';
}

function wireInspector() {
  $('gameWorld').addEventListener('click', (ev) => {
    const pl = plantAt(ev);
    if (pl) inspect(pl);
  });
  $('tallest').onclick = pickTallest;
  $('clearPick').onclick = () => { inspected = null; observer.selected = null; renderInspector(true); };
}

// ── the clock ──────────────────────────────────────────────────────────────
// The model has no day/night and no seasons (MODEL.md: day/night deliberately not in v1;
// seasons wait for sensing in Stage 6), so the dial shows elapsed time only: one turn per
// thousand ticks, the centre counting which thousand we are in.
var CLOCK_PERIOD = 1000;

// browser-only entity: keeps the dial and the inspector current and follows a theme change
var UiPump = class UiPump {
  constructor() { this.frame = 0; }
  update() {}
  draw() {
    $('clock').value = gameEngine.tick;
    this.frame++;
    if (this.frame % 15 === 0) renderInspector(false);
  }
};
