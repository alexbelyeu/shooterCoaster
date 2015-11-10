var Damage = require('../components/Damage');
	var random = require('../utils/random');
	var destroyMesh = require('../utils/destroyMesh');
	
	var Snowman = function( poem, manager, x, y, z ) {

	this.poem = poem;
	this.manager = manager;
	this.scene = poem.scene;
	this.snowman = poem.snowman;
	this.theta = (Math.random()*0.5)*2*Math.PI;

	this.name = "Snowman";
	this.color = new THREE.Color();
	this.scoreValue = 30;

	this.spawnPoint = new THREE.Vector3(x,y,z);
	this.position = new THREE.Vector3(x,y,z);

	this.dead = false;
	this.radius = 115;

	this.addObject();
	this.object.position.copy(this.position);

	this.handleUpdate = this.update.bind(this);
	this.manager.on('update', this.handleUpdate );
		
	};
	
	module.exports = Snowman;
	
	Snowman.prototype = {
	
	damageSettings : {
		color: 0x0f0f0f
	},
	
	initSharedAssets : function( manager ) {
		var geometry = poem.snowman.geometry;
		geometry.name = "snowmanGeo";		
		manager.shared.geometry = geometry;
	},

	addObject : function() {
		var geometry = this.manager.shared.geometry;
		this.object = new THREE.Mesh(geometry, poem.snowman.material);
		this.object.scale.z=0.4;
		this.object.scale.x=this.object.scale.y=1.2;
		this.object.rotation.x= Math.PI;
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
			this.object.position.y += 0.75 + 20 * Math.sin((poem.clock.time/4000)*this.theta + 2000);
			//console.log(this.object.position.y);
		}
	}
	
	};