var Damage = require('../components/Damage');
	var random = require('../utils/random');
	var destroyMesh = require('../utils/destroyMesh');
	
	var Crows = function( poem, manager, x, y, z ) {

	this.poem = poem;
	this.manager = manager;
	this.scene = poem.scene;
	this.crow = poem.crow;
	this.movementZ = Math.random()*4 + 1;

	this.name = "Crow";
	this.color = new THREE.Color();
	this.cssColor = "#000000";
	this.scoreValue = 15;

	this.spawnPoint = new THREE.Vector3(x,y,z);
	this.position = new THREE.Vector3(x,y,z);

	this.dead = false;
	this.radius = 35;

	this.addObject();
	this.object.position.copy(this.position);
	this.handleUpdate = this.update.bind(this);
	this.manager.on('update', this.handleUpdate );
		
	};
	
	module.exports = Crows;
	
	Crows.prototype = {
	
	damageSettings : {
		color: 0x000000
	},
	
	initSharedAssets : function( manager ) {
		var geometry = poem.crow.geometry;
		geometry.name = "crowGeo";		
		manager.shared.geometry = geometry;
	},

	addObject : function() {
		var geometry = this.manager.shared.geometry;

		this.object = new THREE.Mesh(geometry, poem.crow.material);
		this.object.scale.x=this.object.scale.y=this.object.scale.z= 10;
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
			this.object.position.x += 0.01;
			this.object.position.z += this.movementZ;
			//console.log(this.object.position.z);
		}
	}
	
	};