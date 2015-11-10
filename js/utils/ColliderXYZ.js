	var _ = require('underscore');
	
	var ColliderXYZ = function( poem, getCollectionA, getCollectionB, onCollision ) {
	
	this.poem = poem;
	
	this.getCollectionA = getCollectionA;
	this.getCollectionB = getCollectionB;
	this.onCollision = onCollision;
	this.poem.on('update', this.update.bind(this) );
	};
	
	module.exports = ColliderXYZ;
	
	ColliderXYZ.prototype = {
	
	update : function( e ) {

		var collisions = [];

		_.each( this.getCollectionA(), function( itemFromA ) {
			
			var collidedItemFromB = _.find( this.getCollectionB(), function( itemFromB ) {
				
				
				var dx, dy, dz, distance;

				dx = itemFromA.position.x - itemFromB.position.x;
				dy = itemFromA.position.y - itemFromB.position.y;
				dz = itemFromA.position.z - itemFromB.position.z;
			
				distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
				
			
				return distance < itemFromA.radius + itemFromB.radius;
				
			}, this);
			
			
			if( collidedItemFromB ) {
				collisions.push([itemFromA, collidedItemFromB]);
			}
			
		}, this);
		
		_.each( collisions, function( items ) {
			this.onCollision( items[0], items[1] );
		}, this);
	}
		
	};