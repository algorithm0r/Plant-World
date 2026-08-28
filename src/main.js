'use strict';
// Browser entry + wiring (not loaded headlessly). reset() rebuilds the world from the
// current PARAMETERS; the boot sequence is straight — no AssetManager gate.
var gameEngine, world, dataManager, db;

function reset() {
  gameEngine.clear();
  const cv = gameEngine.ctx.canvas;
  cv.width = PARAMETERS.gridW * PARAMETERS.cellSize;
  cv.height = PARAMETERS.gridH * PARAMETERS.cellSize;
  world = new World(PARAMETERS.gridW, PARAMETERS.gridH);
  const graph = new LineGraph(10, 10, 200, 80, 'mean soil moisture');
  db = createDB(PARAMETERS.db);
  dataManager = new DataManager(world, db, graph);
  gameEngine.add(world);
  gameEngine.add(new Observer(world));
  gameEngine.add(dataManager);
  gameEngine.add(graph);
  if (typeof setStatus === 'function') {
    setStatus('Stage 1 — environment only. ' + world.W + '×' + world.H +
      ' cells, water table at row ' + world.tableY + '. No plants yet.');
  }
}

window.onload = function () {
  const canvas = document.getElementById('gameWorld');
  gameEngine = new GameEngine();
  gameEngine.init(canvas.getContext('2d'));
  buildControls();
  reset();
  gameEngine.start();
};
