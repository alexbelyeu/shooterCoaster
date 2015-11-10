	var routing = require('../routing');

	var Curve2 = function (varA, varB, varC, scalar) {
	
		this.vector = new THREE.Vector3();
		this.vector2 = new THREE.Vector3();
		this.PI2 = Math.PI * 2;
		
		return {
			getPointAt: function ( t ) {
				t = t * PI2;

				var x = Math.sin( t * varA ) * Math.cos( t * varC ) * varC*13;
				var y = Math.cos( t * varC*2 )*(t/2) * varC + Math.cos( t * varB ) + 15;
				var z = Math.sin( t ) * Math.sin( t * varC ) * varC*13;
				vector.set( x, y, z ).multiplyScalar( scalar );
				return vector;
			},

			getTangentAt: function ( t ) {

				var delta = 0.0001;
				var t1 = Math.max( 0, t - delta );
				var t2 = Math.min( 1, t + delta );

				return vector2.copy( this.getPointAt ( t2 ) ).sub( this.getPointAt( t1 ) ).normalize();

			}
		};
		};