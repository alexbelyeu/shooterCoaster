var localforage = require('localforage');
var EventDispatcher = require('../utils/EventDispatcher');
var dispatcher = new EventDispatcher();

console.warn('TODO: kills.js');

var kills = 0;

function dispatchChange() {
	
	dispatcher.dispatch({
		type: "change",
		kills: kills
	});
	
}

var exports = {
	
	on : dispatcher.on,
	
	off : dispatcher.off,
	
	get : function() {
				
		return kills;
		
	},
	
	set : function( slug, value ) {

		kills = value;
		localforage.setItem( 'kills', kills );
		dispatchChange();
		
	},
	
	reset : function() {
		
		kills = 0;
		localforage.setItem( 'kills', kills );
		dispatchChange();
		
	}
		
};

(function() {
	
	localforage.getItem('kills', function( err, value ) {
	
		if(err) return;
		kills = _.isNumber( value ) ? value : 0;
		
		dispatchChange();
		
	});	
	
})();


module.exports = exports;