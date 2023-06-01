class Plant {
	constructor() {
		// Create a box geometry
		const geometry = new THREE.BoxGeometry(1, 1, 1);
		
		// Create a material with a color and specular highlights
		const material = new THREE.MeshPhongMaterial({
			color: 0xff0000, // green color
			shininess: 100, // shininess of the material
			specular: 0xffffff // color of the highlights
		});
		// Create a mesh and add it to the scene
		this.cube = new THREE.Mesh(geometry, material);
		this.cube.position.set(0, 0, 0);
		scene.add(this.cube);

		const geometry2 = new THREE.CylinderGeometry(0.25, 0.25, 1, 32, 1, false);
		const material2 = new THREE.MeshPhongMaterial({
			color: 0x00ff00, // green color
			shininess: 100, // shininess of the material
			specular: 0xffffff // color of the highlights
		});
		this.cylinder = new THREE.Mesh(geometry2, material2);
		this.cylinder.position.set(0,1,0)
		scene.add(this.cylinder);

		const sphereGeometry = new THREE.SphereGeometry(0.5, 32, 32);
		const sphereMaterial = new THREE.MeshPhongMaterial({
			color: 0x0000ff, // blue color
			shininess: 100, // shininess of the material
			specular: 0xffffff // color of the highlights
		});
		this.sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
		this.sphere.position.set(0,2,0)
		scene.add(this.sphere);
	};

	update() {
		this.cube.rotation.y+= 0.01;
	};

}

