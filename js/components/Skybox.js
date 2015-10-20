var destroyMesh = require('../utils/destroyMesh');
	
var Skybox = function( poem, properties ) {

this.poem = poem;
properties = _.isObject( properties ) ? properties : {};
this.sky = properties.sky ? properties.sky : "skyboxsun5deg";
this.width = properties.width ? properties.width : 5000;
this.height = properties.height ? properties.height : 1400;
this.depth = properties.depth ? properties.depth : 5000;
var path = "./assets/images/" + this.sky + "/";
var format = '.bmp';
var urls = [
			path+'1'+format, path+'2'+format,
			path+'3'+format, path+'4'+format,
			path+'5'+format, path+'6'+format
		];
var reflectionCube = THREE.ImageUtils.loadTextureCube(urls);
reflectionCube.format = THREE.RGBFormat;
// Skybox
var shader = THREE.ShaderLib["cube"];
shader.uniforms["tCube"].value = reflectionCube;
var material = new THREE.ShaderMaterial ({
	fragmentShader: shader.fragmentShader,
	vertexShader: shader.vertexShader,
	uniforms: shader.uniforms,
	//depthWrite: false,
	side: THREE.BackSide
});
var mesh = new THREE.Mesh( new THREE.BoxGeometry( this.width, this.height, this.depth ), material );
this.name = "skybox";
this.poem.scene.add(mesh);
};

module.exports = Skybox;