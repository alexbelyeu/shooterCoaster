var Tree = require('../entities/Tree');
	
var TreeField = function( poem, properties ) {

this.poem = poem;
this.trees = [];
this.maxRadius = 15;
this.maxHeight = 50;
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
	
	
	
	for( i=0; i < count; i++ ) {
		
		var x = Math.random() * 4000 - 2500;
		var z = Math.random() * 4000 - 2500;
		height = this.maxHeight * Math.random() + 30;
		radius = Math.random() * this.maxRadius + 5;
		
		this.trees.push(
			new Tree( this.poem, x, z, height, radius )
		);
				
	}	
		
},
};