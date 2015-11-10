var Damage = require('../components/Damage');
	var random = require('../utils/random');
	var destroyMesh = require('../utils/destroyMesh');
	
	var Sharks = function( poem, manager, x, y, z ) {

	this.poem = poem;
	this.manager = manager;
	this.scene = poem.scene;
	this.shark = poem.shark;
	this.theta = (Math.random()*0.5)*2*Math.PI;

	this.name = "Shark";
	this.cssColor = "#0000ff";
	this.scoreValue = 25;

	this.spawnPoint = new THREE.Vector3(x,y,z);
	this.position = new THREE.Vector3(x,y,z);

	this.dead = false;
	this.radius = 50;

	this.addObject();
	this.object.position.copy(this.position);

	this.handleUpdate = this.update.bind(this);
	this.manager.on('update', this.handleUpdate );
		
	};
	
	module.exports = Sharks;
	
	Sharks.prototype = {
	
	damageSettings : {
		color: 0x0000ff
	},
	
	initSharedAssets : function( manager ) {
		var geometry = poem.shark.geometry;
		geometry.name = "sharkGeo";		
		manager.shared.geometry = geometry;
	},

	addObject : function() {
		var geometry = this.manager.shared.geometry;
		this.object = new THREE.Mesh(geometry, poem.shark.material);
		this.object.scale.x=this.object.scale.y=this.object.scale.z= 15;
		poem.scene.add( this.object );
	},

	kill : function() {
		this.dead = true;
		this.object.visible = false;
		this.damage.explode( this.object.position );
	},

	update : function( e ) {
		
		if( this.dead ) {
		
			this.damage.update( e );
			
		} else {
			this.object.position.z += 5 * Math.cos((poem.clock.time/1000)*this.theta)/this.theta;
			this.object.position.x += 5 * Math.sin((poem.clock.time/1000)*this.theta)/this.theta;
			this.object.lookAt(poem.camera.object.position);
		}
	}
	
	};