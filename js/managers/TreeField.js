var Tree = require('../entities/Tree');
	
	var TreeField = function( poem, properties ) {
	
	this.poem = poem;
	this.trees = [];
	this.maxRadius = 50;
	//this.originClearance = 30;
	this.count = 2000;
	
	_.extend( this, properties ) ;
	
	this.generate( this.count );
	
	//this.poem.on('update', this.update.bind(this) );
	//this.poem.gun.setBarrierCollider( this.trees );
	};
	
	module.exports = TreeField;
	
	TreeField.prototype = {
	
	generate : function( count ) {
		
		var i, x, z, height, radius;
		
		height = this.poem.height /2;
		
		for( i=0; i < count; i++ ) {
			
			var x = Math.random() * 5000 - 2500;
			var z = Math.random() * 5000 - 2500;
			radius = Math.random() * this.maxRadius;
			/* Para comprobar colisiones
				do {
					
					x = Math.random() * width;
					y = Math.random() * height - (height / 2);
				
					radius = Math.random() * this.maxRadius;
					
				} while(
					this.checkCollision( x, y, radius ) &&
					this.checkFreeOfOrigin( x, y, radius )
				);
			*/
			this.trees.push(
				new Tree( this.poem, x, z, radius )
			);		
		}		
	},
	/* Seria para mover los arboles
		update : function( e ) {
		
		_.each( this.asteroids, function(asteroid) {
			
			asteroid.update( e );
			
		}, this);
		
		if( !this.poem.ship.dead && !this.poem.ship.invulnerable ) {
			var shipCollision = this.checkCollision(
				this.poem.ship.position.x,
				this.poem.ship.position.y,
				2
			);
		
			if( shipCollision ) {
				this.poem.ship.kill();
			}
		}
			
		},
		
		checkFreeOfOrigin : function( x, y, radius ) {
			return Math.sqrt(x*x + y*y) > radius + this.originClearance;
		},
		
		checkCollision : function( x, y, radius ) {
		
		var collision = _.find( this.asteroids, function( asteroid ) {
			
			var dx, dy, distance;
			
			dx = this.poem.coordinates.circumferenceDistance( x, asteroid.position.x );
			dy = y - asteroid.position.y;
			
			distance = Math.sqrt(dx * dx + dy * dy);

			return distance < radius + asteroid.radius;
			
		}, this);
		
		return !!collision;
		}
	*/
	};