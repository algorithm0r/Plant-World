function GameEngine() {
    this.entities = [];
};

GameEngine.prototype.init = function (ctx) {
 
	// Create a camera
	camera = new THREE.PerspectiveCamera(75, 1200 / 800, 0.1, 1000);
	camera.position.z = 5;
	camera.translateY(1);
	camera.translateX(1);
	camera.rotateY(Math.PI / 8);

	// Create a renderer
	renderer = new THREE.WebGLRenderer();
	renderer.setSize(1200, 800);
	document.body.appendChild(renderer.domElement);

	// Create a directional light
	const light = new THREE.PointLight(0xffffff, 1, 100);
	light.position.set(-2, 12,2);

	// Add the light to the scene
	scene.add(light);

	const ambientLight = new THREE.AmbientLight(0xffffff, 0.1); // set the color and intensity of the light
	scene.add(ambientLight);

	// Set the background color of the scene
	scene.background = new THREE.Color(0x808080);
};

GameEngine.prototype.start = function () {
    console.log("starting game");
    var that = this;
    (function gameLoop() {
        that.loop();
        requestAnimationFrame(gameLoop);
    })();
};

GameEngine.prototype.addEntity = function (entity) {
    console.log('added entity');
    this.entities.push(entity);
};

GameEngine.prototype.draw = function () {
	// Render the scene
	renderer.render(scene, camera);
};

GameEngine.prototype.update = function () {
    var entitiesCount = this.entities.length;

    for (var i = 0; i < entitiesCount; i++) {
        var entity = this.entities[i];

        if (!entity.removeFromWorld) {
            entity.update();
        }
    }

    for (var i = this.entities.length - 1; i >= 0; --i) {
        if (this.entities[i].removeFromWorld) {
            this.entities.splice(i, 1);
        }
    }
};

GameEngine.prototype.loop = function () {
    this.update();
    this.draw();
};