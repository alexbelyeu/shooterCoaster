var Damage = require('../components/Damage');
	var random = require('../utils/random');
	var destroyMesh = require('../utils/destroyMesh');
	var color = 0xcb36ea;
	
	var Minions = function( poem, manager, x, y, z ) {

	this.poem = poem;
	this.manager = manager;
	this.scene = poem.scene;
	this.minion = poem.minion;
	this.rotation = 0.1*Math.random();

	this.name = "Minion";
	this.color = new THREE.Color();
	this.cssColor = "#CB36EA";
	this.scoreValue = 15;

	this.spawnPoint = new THREE.Vector3(x,y,z);
	this.position = new THREE.Vector3(x,y,z);

	this.dead = false;
	this.radius = 80;

	this.addObject();
	this.object.position.copy(this.position);
	this.handleUpdate = this.update.bind(this);
	this.manager.on('update', this.handleUpdate );
		
	};
	
	module.exports = Minions;
	
	Minions.prototype = {
	
	damageSettings : {
		color: 0xffff00
	},
	
	initSharedAssets : function( manager ) {
		var geometry = poem.minion.geometry;
		geometry.name = "minionGeo";		
		manager.shared.geometry = geometry;
	},

	addObject : function() {
		var geometry = this.manager.shared.geometry;

		this.object = new THREE.Mesh(geometry, poem.minion.material);
		this.object.scale.x=this.object.scale.y=this.object.scale.z= 5;
		poem.scene.add( this.object );
	},

	kill : function() {
		this.dead = true;
		this.object.visible = false;
		this.object.position.y += 60;
		this.damage.explode( this.object.position );
	},

	update : function( e ) {
		
		if( this.dead ) {
		
			this.damage.update( e );
			
		} else {
			this.object.position.y += 0.3;
			this.object.position.z += 0.2;
			this.object.rotation.y += this.rotation;
		}
	}
	
	};