var Damage = require('../components/Damage');
	var random = require('../utils/random');
	var destroyMesh = require('../utils/destroyMesh');
	
	var Balloons = function( poem, manager, x, y, z ) {

	this.poem = poem;
	this.manager = manager;
	this.scene = poem.scene;
	this.object = null;

	this.name = "Balloon";
	this.color = new THREE.Color();
	this.cssColor = "#ffffff";
	this.scoreValue = 13;

	this.spawnPoint = new THREE.Vector3(x,y,z);
	this.position = new THREE.Vector3(x,y,z);
	
	this.dead = false;
	
	this.radius = 45;

	this.addObject();
	this.object.position.copy(this.position);

	this.handleUpdate = this.update.bind(this);
	this.manager.on('update', this.handleUpdate );
		
	};
	
	module.exports = Balloons;
	
	Balloons.prototype = {
	
	damageSettings : {
		color: new THREE.Color().setHSL(Math.random(),1.0,0.5)
	},
	
	initSharedAssets : function( manager ) {		
		var geometry = new THREE.SphereGeometry(35,32,32);
		geometry.name = "balloonGeo";
		manager.shared.geometry = geometry;
	},

	addObject : function() {
	
		var geometry, sprite;
	
		geometry = this.manager.shared.geometry;
		this.color.setHSL(Math.random(),1.0,0.5);

		this.object = new THREE.Mesh(
			geometry,
			new THREE.MeshBasicMaterial({
				alphaTest: 0.9,
				transparent: true,
				fog: false,
				color: this.color
			})
		);
		this.scene.add( this.object );
		this.poem.on( 'destroy', destroyMesh( this.object ) );
	},


	kill : function() {
		this.dead = true;
		this.object.visible = false;
		this.damage.explode( this.object.position );
	},

	reset : function() {
		this.position.copy( this.spawnPoint );	
	},

	update : function( e ) {
		
		if( this.dead ) {
		
			this.damage.update( e );
			
		} else {
			this.object.position.y += 0.3;
			this.object.position.z += 0.2;
		}
	}
	
	};