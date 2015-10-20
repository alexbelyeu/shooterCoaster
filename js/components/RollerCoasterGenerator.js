var destroyMesh = require('../utils/destroyMesh');
var Curve1 = require("./Curve1");
var Curve2 = require("./Curve2");
var RollerCoaster = require("./RollerCoaster");
var RollerCoasterShadow = require("./RollerCoasterShadow");
var RollerCoasterLifters = require("./RollerCoasterLifters");

var RollerCoasterGenerator = function ( poem, properties ) {
	
	properties = _.isObject( properties ) ? properties : {};
	this.poem = poem;
	this.object = null;

	_.extend( this, properties ) ;

	this.color1 = new THREE.Color(properties.color1) ? new THREE.Color(properties.color1) : new THREE.Color(0xffffff);
	this.color2 = new THREE.Color(properties.color2) ? new THREE.Color(properties.color2) : new THREE.Color(0xffff00);		
	this.rollerSpeed = properties.rollerSpeed ? properties.rollerSpeed : 0.0000015;
	this.minRollerSpeed = properties.minRollerSpeed ? properties.minRollerSpeed : 0.00004;
	this.varA = properties.varA ? properties.varA : 3;
	this.varB = properties.varB ? properties.varB : 17;
	this.varC = properties.varC ? properties.varC : 4;
	this.scalar = properties.scalar ? properties.scalar : 20;
	
	this.curve1 = Curve1(this.varA, this.varB, this.varC, this.scalar);
	this.curve2 = Curve2(this.varA, this.varB, this.varC, this.scalar);
	this.curve = properties.curve == "curve1" ? this.curve1 : this.curve2;	

	this.rollerShadow = RollerCoasterShadow(this.curve, 500 );
	this.material = new THREE.MeshBasicMaterial( { color: 0x000000, opacity: 0.1, depthWrite: false, transparent: true} );
	this.object = new THREE.Mesh( this.rollerShadow, this.material );
	this.object.position.y = 1;
	this.poem.scene.add( this.object );

	this.rollerLifter = RollerCoasterLifters( this.curve, 100 );
	this.material = new THREE.MeshPhongMaterial( { color: this.color1, specular: 0x020202, shininess: 300 } );
	this.object = new THREE.Mesh( this.rollerLifter, this.material );
	this.object.position.y = 1;
	this.poem.scene.add( this.object );	
	
	this.roller = RollerCoaster(this.curve, 1500, this.color1, this.color2);
	this.material = new THREE.MeshPhongMaterial( { specular: 0x030303, shininess: 300, vertexColors: THREE.VertexColors } );
	this.object = new THREE.Mesh( this.roller, this.material );
	this.poem.scene.add( this.object );

	this.poem.on( 'destroy', destroyMesh( this.object ) );
};
module.exports = RollerCoasterGenerator;