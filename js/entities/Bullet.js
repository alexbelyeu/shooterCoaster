var Bullet = function( poem, gun, vertex ) {
	this.poem = poem;
	this.gun = gun;
	this.vertex = vertex;
	
	this.speed = new THREE.Vector3(0,0,0);
	this.position = new THREE.Vector3(0,0,0);
	this.radius = 10;
	
	this.bornAt = 0;
	this.alive = false;
	};
	
	module.exports = Bullet;
	
	Bullet.prototype = {
	
	kill : function() {
		this.vertex.set(0, -10000 ,0);
		this.alive = false;
	},
	
	update : function( e ) {
		var x,y,z;
		
		this.position.x += this.speed.x;
		this.position.y += this.speed.y;
		this.position.z += this.speed.z;
		
		this.poem.coordinatesXYZ.setVector( this.vertex, this.position );
		//if (e%1000) {console.log(this.poem)};
	},
	
	fire : function(xO, xD, yO, yD, zO, zD, r, speed) {

		this.position.set(xO, yO, zO);

		this.speed.x = ((xD-xO)/r)*speed;
		this.speed.y = ((yD-yO)/r)*speed;
		this.speed.z = ((zD-zO)/r)*speed;
		
		this.bornAt = this.poem.clock.time;
		this.alive = true;
		
	}
	};