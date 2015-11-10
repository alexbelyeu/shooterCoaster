var _ = require('underscore');
	
	var ColliderXYZObjects = function( poem, getCollectionA, getCollectionB, onCollision ) {
	
	this.poem = poem;
	this.distanceYA=0;
	
	this.getCollectionA = getCollectionA;
	if (this.getCollectionA()[0].name == "Minion"){
		this.distanceYA = 60;
	}
	this.getCollectionB = getCollectionB;
	this.onCollision = onCollision;
	this.poem.on('update', this.update.bind(this) );
	};
	
	module.exports = ColliderXYZObjects;
	
	ColliderXYZObjects.prototype = {
	
	update : function( e ) {

		var collisions = [];

		_.each( this.getCollectionA(), function( itemFromA ) {
			
			var collidedItemFromB = _.find( this.getCollectionB(), function( itemFromB ) {
				
				
				var dx, dy, dz, distance;

				dx = itemFromA.object.position.x - itemFromB.position.x;
				dy = (itemFromA.object.position.y+this.distanceYA) - itemFromB.position.y;
				dz = itemFromA.object.position.z - itemFromB.position.z;
			
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