var Curve1 = require("./Curve1");
var Curve2 = require("./Curve2");
var RollerCoasterGenerator = require("./RollerCoasterGenerator");

var position = new THREE.Vector3();
var tangent = new THREE.Vector3();
var iSee = new THREE.Vector3();
var velocity = 0;
var progress = 0;

var Camera = function( poem, properties, objects ) {

	this.poem = poem;
	this.polarObj = new THREE.Object3D();
	this.speed = 0.032;
	
	this.rollerSpeed = objects.rollercoastergenerator.properties.rollerSpeed;
	this.minRollerSpeed = objects.rollercoastergenerator.properties.minRollerSpeed;
	
	var varA = objects.rollercoastergenerator.properties.varA;
	var varB = objects.rollercoastergenerator.properties.varB;
	var varC = objects.rollercoastergenerator.properties.varC;
	var scalar = objects.rollercoastergenerator.properties.scalar;
	this.curve1 = Curve1(varA, varB, varC, scalar);
	this.curve2 = Curve2(varA, varB, varC, scalar);
	var curve = objects.rollercoastergenerator.properties.curve;
	this.curve = curve == "curve1" ? this.curve1 : this.curve2;

	var camTitles =new THREE.PerspectiveCamera( 
		65, window.innerWidth / window.innerHeight, 1, 5000 );
	var camGame = new THREE.PerspectiveCamera( 
		80, window.innerWidth / window.innerHeight, 1, 11000 );

	this.object = properties.isThisTitles == "yes" ? camTitles : camGame;
	if (this.object === camTitles){
		this.object.position.y = 700;
		this.object.rotation.x = 1.7*Math.PI;
		this.object.setLens(15, 35);
	} else {
		//this.object.rotation.y = Math.PI;
		//this.train = new THREE.Object3D();
		//this.poem.scene.add(this.train);
		//this.train.add(camGame);
		velocity=0;
		this.poem.on('update', this.updateCamGame.bind(this) );
	}
};

module.exports = Camera;

Camera.prototype = {

	resize : function() {
		this.object.aspect = window.innerWidth / window.innerHeight;
		this.object.updateProjectionMatrix();
	},
	updateCamGame : function (e) {
		
		progress += velocity;
		progress = progress % 1;
		
		position.copy( this.curve.getPointAt( progress ) );
		position.y += 6;		
		this.object.position.copy(position);
		//this.train.position.copy( position );
		
		tangent.copy( this.curve.getTangentAt( progress ) );
		velocity -= tangent.y * this.rollerSpeed;
		velocity = Math.max( velocity, this.minRollerSpeed );
		this.object.lookAt(iSee.copy(position).add(tangent));
		//this.train.lookAt(iSee.copy(position).add(tangent));
		//this.object.position.copy(this.train.position);	
		//this.object.position.y += 3;
	}
};