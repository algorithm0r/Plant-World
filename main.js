var gameEngine = new GameEngine();
var scene = new THREE.Scene();

var ASSET_MANAGER = new AssetManager();

var socket = null;
if (window.io !== undefined) {
	console.log("Database connected!");

	socket = io.connect('http://73.225.31.4:8888');

	socket.addEventListener("log", console.log);
}

function reset() {

};

ASSET_MANAGER.downloadAll(function () {
	// var canvas = document.getElementById('gameWorld');
	// var ctx = canvas.getContext('webgl');
	const plant = new Plant();
	gameEngine.addEntity(plant);

	gameEngine.init();
	gameEngine.start();
});
