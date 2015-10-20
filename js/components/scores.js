var localforage = require('localforage');
var levels = require('../levels');
var scores = {};
var EventDispatcher = require('../utils/EventDispatcher');

function dispatchChange() {
	
	exports.dispatch({
		type: "change",
		scores: scores
	});
	
}

function isRealNumber( number ) {
	return _.isNumber( number ) && !_.isNaN( number );
}

var exports = {
	
	get : function( slug ) {

		var value = isRealNumber( scores[slug] ) ? scores[slug] : 0;
		var total = _.isNumber( levels[slug].maxScore ) ? levels[slug].maxScore : 1;
		var unitI = 1;
		
		if( total > 0 ) {
			unitI = value / total;
		}
		
		var percent = Math.round(unitI * 100);
		
		var obj = {
			value	: value,
			total	: total,
			unitI	: unitI,
			percent	: percent
		};
		
		_.each( obj, function(val) {
			if( _.isNaN( val ) ) {
				debugger;
			}
		});
		return obj;
		
	},
	
	set : function( slug, score ) {
		
		if( isRealNumber( score ) ) {
			
			//Only save the higher score
			
			scores[slug] = isRealNumber( scores[slug] ) ?
				Math.max( scores[slug], score ) :
				score
			;
			localforage.setItem( 'scores', scores );
			dispatchChange();
			
		}
		
	},
	
	reset : function() {
		
		scores = {};
		localforage.setItem( 'scores', scores );
		dispatchChange();
		
	}
		
};

EventDispatcher.prototype.apply( exports );

(function() {
	
	localforage.getItem('scores', function( err, value ) {
	
		if(err) return;
		scores = _.isObject( value ) ? value : {};
		
		dispatchChange();
		
	});	
	
})();


module.exports = exports;