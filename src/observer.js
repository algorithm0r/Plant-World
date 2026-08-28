'use strict';
// The view. Reads world state and draws it; never mutates the model, and never touches the
// DOM — it is handed a 2d context. Keeping all rendering here is what makes the world
// headless-safe.
//
// Three views (PARAMETERS.view): 0 soil moisture, 1 light, 2 cell type. Colours are
// quantised into prebuilt palettes so the hot loop assigns an existing string rather than
// building one per cell.
var Observer = class Observer {
  constructor(world) {
    this.world = world;
    this.LEVELS = 32;
    this.wetPal = [];
    this.lightPal = [];
    this.airPal = [];
    for (let k = 0; k < this.LEVELS; k++) {
      const v = k / (this.LEVELS - 1);
      // dry soil (warm brown) → saturated (deep blue)
      this.wetPal.push(rgb(96 - 54 * v, 68 - 20 * v, 44 + 130 * v));
      // light: black → pale warm white
      this.lightPal.push(rgb(255 * v, 250 * v, 225 * v));
      // air light for the COMBINED view — dimmer, so plant tissue still reads against it
      this.airPal.push(rgb(14 + 92 * v, 18 + 96 * v, 26 + 104 * v));
    }
    this.typeColour = [
      '#0b0e13', // AIR
      '#5a442c', // SOIL
      '#1e56b4', // WATER
      '#b98a4a', // ROOT
      '#7a5a34', // STEM
      '#3fbf5f', // LEAF
      '#e0d060', // SEED
      '#d8b8e8', // STORE (cataphyll / bulb scale)
    ];
  }

  update() {}

  draw(ctx) {
    const w = this.world, P = PARAMETERS, cs = P.cellSize;
    const view = P.view | 0, last = this.LEVELS - 1;
    // view 0 puts BOTH resources on one picture: sky brightness is light (so canopy shadows
    // are visible as dark columns), ground colour is soil moisture, plants in tissue colours.
    for (let y = 0; y < w.H; y++) {
      for (let x = 0; x < w.W; x++) {
        const i = y * w.W + x, t = w.type[i];
        let col;
        if (view === 3) {
          col = this.typeColour[t] || '#f0f';
        } else if (view === 1) {
          col = this.lightPal[clamp(Math.round(w.light[i] * last), 0, last)];
        } else if (view === 2) {
          col = (t === CELL.AIR) ? '#0b0e13'
              : this.wetPal[clamp(Math.round(w.moisture[i] * last), 0, last)];
        } else {
          if (t === CELL.AIR) col = this.airPal[clamp(Math.round(w.light[i] * last), 0, last)];
          else if (t === CELL.LEAF) col = '#3fbf5f';
          else if (t === CELL.STEM) col = '#7a5a34';
          else if (t === CELL.SEED) col = '#e0d060';
          else if (t === CELL.ROOT) col = '#b98a4a';
          else if (t === CELL.STORE) col = '#d8b8e8';
          else col = this.wetPal[clamp(Math.round(w.moisture[i] * last), 0, last)];
        }
        ctx.fillStyle = col;
        ctx.fillRect(x * cs, y * cs, cs, cs);
      }
    }
    // growth tips, so it is visible where development is actually happening
    ctx.fillStyle = '#ff4fa3';
    for (const pl of w.plants) for (const tp of pl.tips) {
      ctx.fillRect(tp.x * cs - 1, tp.y * cs - 1, cs + 2, cs + 2);
    }
    // rain flash — one frame of a blue wash so episodic events are visible while watching
    if (w.raining) {
      ctx.fillStyle = 'rgba(90,150,255,0.18)';
      ctx.fillRect(0, 0, w.W * cs, w.H * cs);
    }
  }
};
