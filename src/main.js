'use strict';
// Browser entry + wiring (not loaded headlessly). reset() rebuilds the world from the
// current PARAMETERS; the boot sequence is straight — no AssetManager gate.
var gameEngine, world, dataManager, observer, db, buffer, paused = false;

function reset() {
  gameEngine.clear();
  const cv = gameEngine.ctx.canvas;
  cv.width = PARAMETERS.gridW * PARAMETERS.cellSize;
  cv.height = PARAMETERS.gridH * PARAMETERS.cellSize;
  world = new World(PARAMETERS.gridW, PARAMETERS.gridH);
  for (let k = 0; k < PARAMETERS.nSeeds; k++) {
    const x = Math.floor((k + 0.5) * world.W / PARAMETERS.nSeeds);
    world.plantSeed(PARAMETERS.genome, x);
  }
  // one pixel per cell; the Observer scales it up in a single drawImage
  buffer = document.createElement('canvas');
  buffer.width = world.W; buffer.height = world.H;
  db = createDB(PARAMETERS.db);
  dataManager = new DataManager(world, db);
  observer = new Observer(world, buffer, worldPalette());
  gameEngine.add(world);
  gameEngine.add(observer);
  gameEngine.add(dataManager);
  gameEngine.add(new UiPump());
  wireCharts(dataManager);
  inspected = null;
  renderInspector(true);
  gameEngine.draw();          // show the sown world even while paused
}

function togglePause() {
  paused = !paused;
  if (paused) gameEngine.stop(); else gameEngine.start();
}

window.onload = function () {
  $('picker').appendChild(CB.theme.picker());
  $('clock').setAttribute('period', CLOCK_PERIOD);
  gameEngine = new GameEngine();
  gameEngine.init($('gameWorld').getContext('2d'));
  buildControls();
  wireInspector();
  reset();
  // the canvas can't follow var(), so re-resolve the world's colours when the theme changes
  document.addEventListener('cb-theme', () => { if (observer) observer.setPalette(worldPalette()); });
  gameEngine.start();
};
