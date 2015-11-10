	var CoordinatesXYZ = function( poem ) {
	this.poem = poem;
	};
	
	module.exports = CoordinatesXYZ;
	
	CoordinatesXYZ.prototype = {
	
	x : function( x ) {
		return x;
	},
	
	y : function( y ) {
		return y;
	},
	
	z : function( z ) {
		return z;
	},
	
	r : function(x, y, z) {
		return Math.sqrt(x*x + y*y + z*z);
	},
	
	theta : function(x, z) {
		return Math.atan( z / x );
	},
	
	setVector : function( vector ) {
		
		var x, y, z, vector2;
		
		if( typeof arguments[1] === "number" ) {
			
			x = arguments[1];
			y = arguments[2];
			z = arguments[3];
			
			return vector.set(
				this.x(x),
				this.y(y),
				this.z(z)
			);
			
		} else {
			
			vector2 = arguments[1];
			
			return vector.set(
				this.x(vector2.x),
				this.y(vector2.y),
				this.z(vector2.z)
			);
		}
		
	},
	
	getVector : function( x, y, z ) {
		
		var vector = new THREE.Vector3();
		return this.setVector( vector, x, y, z );
		
	}
		
	};