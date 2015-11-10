var destroyMesh = require('../utils/destroyMesh');

	var Funfairs = function( poem, properties ) {	
	
	properties = _.isObject( properties ) ? properties : {};
	this.poem = poem;
	this.object = null;
	this.name = "funfair";
	_.extend( this, properties ) ;

	this.posX1 = properties.posX ? properties.posX : 0;
	this.posZ1 = properties.posZ ? properties.posZ : -500;
	this.posX2 = properties.posX ? properties.posX : 500;
	this.posZ2 = properties.posZ ? properties.posZ : 0;

	//Funfairs
	this.funfairs = [];
	//Funfair1
	this.funfair1 = new THREE.CylinderGeometry(100, 100, 50, 15);
	this.material = new THREE.MeshLambertMaterial({color: 0xff8080});
	this.object = new THREE.Mesh(this.funfair1, this.material);
	this.object.position.set( this.posX1, 100, this.posZ1);
	this.object.rotation.x = Math.PI / 2;
	this.object.radius = 104.115;
	//this.radius = this.object.geometry.boundingSphere.radius;
	this.poem.scene.add(this.object);
	this.funfairs.push(this.object);

	//Funfair2
	this.funfair2 = new THREE.CylinderGeometry(50, 60, 40, 10);
	this.material = new THREE.MeshLambertMaterial({color: 0x8080ff});
	this.object = new THREE.Mesh(this.funfair2, this.material);
	this.object.position.set( this.posX2, 20, this.posZ2);
	this.object.radius = 63.245;
	//this.radius = this.object.geometry.boundingSphere.radius;
	this.poem.scene.add(this.object);
	this.funfairs.push(this.object);
	
	this.poem.on('destroy', destroyMesh( this.object) );
	
	this.poem.on('update', function( e ) {

		for ( var i = 0; i < this.funfairs.length; i ++ ) {
			this.funfairs[ i ].rotation.y += e.dt*0.0008;
		}

	}.bind(this));
	this.poem.gun.setBarrierCollider( this.funfairs );
	};