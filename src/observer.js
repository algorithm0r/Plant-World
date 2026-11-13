'use strict';
// The view. Reads world state and draws it; never mutates the model, and never touches the
// DOM — it is handed a 2d context, a small offscreen buffer and a resolved palette by ui.js.
// Keeping all rendering here is what makes the world headless-safe.
//
// Four views (PARAMETERS.view): 0 combined (sky brightness = light, ground = soil moisture,
// plants in tissue colours), 1 light only, 2 soil moisture only, 3 cell type.
//
// Rendering is one pixel per cell into an ImageData on the buffer, then a single scaled
// drawImage. The old path issued one fillRect per cell (60,000 a frame at 400x150), which
// cost more than the simulation it was drawing.
//
// Colours. A canvas cannot read CSS variables, so ui.js resolves the world's colour tokens
// (`--pw-*`, declared once in index.html) to rgb triplets and hands them in as `pal`. No
// colour is written in this file. `setPalette` rebuilds the ramps when the theme changes.
var Observer = class Observer {
  constructor(world, buffer, pal) {
    this.world = world;
    this.LEVELS = 32;
    this.buf = buffer;
    this.bctx = buffer.getContext('2d');
    this.img = this.bctx.createImageData(world.W, world.H);
    this.selected = null;          // a Plant, highlighted with a box (ui.js sets it)
    this.setPalette(pal);
  }

  // pal: { skyDark, skyLit, soilDry, soilWet, shade, sun, air, soil, water, root, stem, leaf,
  //        seed, store, bank, tip, select }, each [r, g, b]; select also carries .css
  setPalette(pal) {
    this.pal = pal;
    const ramp = (a, b) => {
      const out = new Uint8ClampedArray(this.LEVELS * 3);
      for (let k = 0; k < this.LEVELS; k++) {
        const v = k / (this.LEVELS - 1);
        for (let c = 0; c < 3; c++) out[k * 3 + c] = a[c] + (b[c] - a[c]) * v;
      }
      return out;
    };
    this.skyRamp = ramp(pal.skyDark, pal.skyLit);    // combined view: air by light
    this.lightRamp = ramp(pal.shade, pal.sun);        // light-only view
    this.wetRamp = ramp(pal.soilDry, pal.soilWet);    // soil by moisture
    // tissue colour by CELL type; the order is CELL's (AIR SOIL WATER ROOT STEM LEAF SEED STORE)
    this.typeRGB = [pal.air, pal.soil, pal.water, pal.root, pal.stem, pal.leaf, pal.seed, pal.store];
  }

  update() {}

  draw(ctx) {
    const w = this.world, P = PARAMETERS, cs = P.cellSize, W = w.W;
    const view = P.view | 0, last = this.LEVELS - 1;
    const d = this.img.data, types = this.typeRGB;
    for (let i = 0, n = w.n; i < n; i++) {
      const t = w.type[i];
      let src, k;
      if (view === 3) { src = types[t] || types[0]; k = 0; }
      else if (view === 1) { src = this.lightRamp; k = Math.round(clamp(w.light[i], 0, 1) * last) * 3; }
      else if (view === 2) {
        if (t === CELL.AIR) { src = types[0]; k = 0; }
        else { src = this.wetRamp; k = Math.round(clamp(w.moisture[i], 0, 1) * last) * 3; }
      } else {
        if (t === CELL.AIR) { src = this.skyRamp; k = Math.round(clamp(w.light[i], 0, 1) * last) * 3; }
        else if (t >= CELL.ROOT) { src = types[t]; k = 0; }
        else { src = this.wetRamp; k = Math.round(clamp(w.moisture[i], 0, 1) * last) * 3; }
      }
      const o = i * 4;
      d[o] = src[k]; d[o + 1] = src[k + 1]; d[o + 2] = src[k + 2]; d[o + 3] = 255;
    }
    this.bctx.putImageData(this.img, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.buf, 0, 0, W * cs, w.H * cs);

    // dispersed seeds waiting in the bank — otherwise reproduction is invisible until a
    // plant suddenly appears
    ctx.fillStyle = this.css(this.pal.bank);
    for (const sd of w.seedBank) ctx.fillRect(sd.x * cs, (w.surfaceY[sd.x] - 1) * cs, cs, cs);
    // growth tips, so it is visible where development is actually happening
    ctx.fillStyle = this.css(this.pal.tip);
    for (const pl of w.plants) for (const tp of pl.tips) {
      ctx.fillRect(tp.x * cs, tp.y * cs, cs, cs);
    }
    if (this.selected) this.drawSelection(ctx, this.selected, cs);
  }

  // A dashed box round the selected plant's tissue, so the genome in the side panel and the
  // plant it grew can be read together.
  drawSelection(ctx, pl, cs) {
    const w = this.world;
    let x0 = pl.x, x1 = pl.x, y0 = pl.y, y1 = pl.y;
    for (const i of pl.cells) {
      if (w.owner[i] !== pl.id) continue;
      const x = i % w.W, y = (i / w.W) | 0;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    const pad = 2;
    ctx.save();
    ctx.strokeStyle = this.css(this.pal.select);
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect((x0 - pad) * cs, (y0 - pad) * cs, (x1 - x0 + 1 + 2 * pad) * cs, (y1 - y0 + 1 + 2 * pad) * cs);
    ctx.restore();
  }

  css(c) { return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'; }
};
