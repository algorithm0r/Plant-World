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
  for (let k = 0; k < PARAMETERS.nSeeds; k++) {
    const x = Math.floor((k + 0.5) * world.W / PARAMETERS.nSeeds);
    world.plantSeed(PARAMETERS.genome, x);
  }
  const graph = new LineGraph(10, 10, 220, 80, 'live plants');
  db = createDB(PARAMETERS.db);
  dataManager = new DataManager(world, db, graph);
  gameEngine.add(world);
  gameEngine.add(new Observer(world));
  gameEngine.add(dataManager);
  gameEngine.add(graph);
  refreshStatus();
}

// The status line has to update as the run proceeds — a line written once at reset is stale
// within seconds, and was still claiming "Stage 2, no economy yet" long after Stage 4.
function refreshStatus() {
  if (typeof setStatus !== 'function' || !world) return;
  const m = world.allMetrics();
  setStatus(
    't=' + gameEngine.tick +
    '  founder "' + PARAMETERS.genome + '"' +
    '\nplants ' + m.plants + ' (' + m.alivePlants + ' alive)' +
    '   born ' + m.births + '   died ' + m.plantDeaths + '   banked ' + m.seedBank +
    '\ncells ' + m.plantCells + '  (leaf ' + m.leafCells + ', root ' + m.rootCells +
    ', stem ' + m.stemCells + ', store ' + m.storeCells + ')' +
    '\ntallest ' + m.maxHeight + '   shed ' + m.cellDeaths + '   clonal splits ' + m.clonalSplits +
    '\nmean genome ' + m.meanGenomeLen.toFixed(1) + ' symbols' +
    '   tips executing ' + (100 * m.execFraction).toFixed(1) + '%'
  );
}

window.onload = function () {
  const canvas = document.getElementById('gameWorld');
  gameEngine = new GameEngine();
  gameEngine.init(canvas.getContext('2d'));
  buildControls();
  reset();
  gameEngine.start();
  setInterval(refreshStatus, 400);
};
