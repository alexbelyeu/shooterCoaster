/*
	Set the win conditions in the level manifest as below

		properties: {
			conditions: [
				{
					component: "jellyManager",
					properties: null
				}
			]
		}

	Psuedo-code gets called:

		jellyManager.watchForCompletion( winCheck, properties );

	Then in the jellyManager component, call the following when condition is completed:

		scoringAndWinning.reportConditionCompleted();

*/
var routing = require('../routing');
var scores = require('./scores');
var selectors = require('../utils/selectors');
var levels = require('../levels');

var ScoringAndWinning = function( poem, properties ) {
	
	properties = _.isObject( properties ) ? properties : {};
	
	this.poem = poem;
	
	this.$score = selectors( "#score", {
		value			: '.score-value',
		total			: '.score-total',
		bar				: '.score-bar-bar',
		text			: '.score-bar-number',
		enemiesCount	: '.enemies-count',
		message			: '.score-message',
	});

	this.$win = selectors( '#win', {
		score		: '.win-score',
		maxScore	: '.win-max-score',
		text		: '.win-text',
		nextLevel	: '.win-next-level',
		restart		: '.win-restart'
	});
	
	this.score = 0;
	this.enemiesCount = 0;
	this.scoreMessageId = 0;
	this.message = _.isString( properties.message ) ? properties.message : "You Win";
	this.nextLevel = properties.nextLevel ? properties.nextLevel : null;
	this.won = false;
	this.maxScore = levels[ poem.slug ].maxScore;
	
	this.$score.total.text( this.maxScore );
	this.updateScoreElements();
	
	this.conditionsRemaining = [];
	
	this.poem.on('levelParsed', function() {
		this.setConditions( properties.conditions );
	}.bind(this));
	
};

module.exports = ScoringAndWinning;

ScoringAndWinning.prototype = {
	
	setConditions : function( conditions ) {
		
		// Start watching for completion for all components
		
		_.each( conditions, function( condition ) {
		
			var component = this.poem[condition.component];
			var args = _.union( this, condition.properties );
		
			component.watchForCompletion.apply( component, args );
			
			this.conditionsRemaining.push( component );
		
		}.bind(this));
		
	},
	
	reportConditionCompleted : function( component ) {
		
		if( this.won ) return;
		
		_.defer(function() {
			
			this.conditionsRemaining = _.filter( this.conditionsRemaing, function( condition ) {
				return condition !== component;
			});
		
			if( this.conditionsRemaining.length === 0 ) {
			
				this.poem.ship.disable();
				this.won = true;
				this.conditionsCompleted();
			
			}
			
		}.bind(this));		
	},

	reportConditionIncomplete : function( component ) {

		if( this.won ) return;
				
		_.defer(function() {
			
			var index = this.conditionsRemaining.indexOf( component ) ;
			
			if( index === -1 ) {
				this.conditionsRemaining.push( component );
			}
					
		}.bind(this));		
	},
	
	
	adjustEnemies : function( count ) {
		
		// if(this.won) return;
		
		this.enemiesCount += count;
		this.$score.enemiesCount.text( this.enemiesCount );
		
		return this.enemiesCount;
	},
	
	adjustScore : function( count, message, style ) {
		
		if(this.won) return;
		
		this.score += count;
		
		this.updateScoreElements();
		
		if( message ) this.showMessage( message, style );
		
		return this.score;
	},
	
	updateScoreElements : function() {
		
		var scorePercentage = Math.round( this.score / this.maxScore * 100 );
		
		this.$score.value.text( this.score );
		this.$score.bar.width(  );
		this.$score.text.toggleClass('score-bar-left', scorePercentage >= 50 );
		this.$score.text.toggleClass('score-bar-right', scorePercentage < 50 );
		this.$score.bar.css({
			width: scorePercentage + "%",
			backgroundColor: "#f00"
		});
		
		this.updateScoreElementsTimeout = setTimeout(function() {
			
			this.$score.bar.css({
				width: scorePercentage + "%",
				backgroundColor: "#C44F4F"
			});
			
		}.bind(this), 500);
		
	},
	
	showMessage : function( message, style ) {
		
		var $span = $('<span></span>').text( message );
		
		if( style ) $span.css( style );
		
		this.$score.message.hide();
		this.$score.message.empty().append( $span );
		this.$score.message.removeClass('fadeout');
		this.$score.message.addClass('fadein');
		this.$score.message.show();
		this.$score.message.removeClass('fadein');
		
		var id = ++this.scoreMessageId;
		
		setTimeout(function() {
			
			if( id === this.scoreMessageId ) {
				this.$score.message.addClass('fadeout');
			}
			
		}.bind(this), 2000);
		
	},
	
	conditionsCompleted : function() {
				
		this.$win.score.text( this.score );
		this.$win.maxScore.text( this.maxScore );
		this.$win.text.html( this.message );
		
		this.showWinScreen();
		
		this.$win.nextLevel.off().one( 'click', function( e ) {
			
			e.preventDefault();
			
			routing.loadUpALevel( this.nextLevel );
			
			this.hideWinScreen();
			
			
		}.bind(this));
		
		this.$win.restart.off().one( 'click', function( e ) {
			
			e.preventDefault();

			routing.loadUpALevel( this.poem.slug );

			this.hideWinScreen();
			
			
		}.bind(this));
		
	},
	
	showWinScreen : function() {
		
		this.$win.scope
			.removeClass('transform-transition')
			.addClass('hide')
			.addClass('transform-transition')
			.show();
		
		$('#container canvas').css('opacity', 0.3);
		
		scores.set( this.poem.slug, this.score );
		
		setTimeout(function() {
			this.$win.scope.removeClass('hide');
		}.bind(this), 1);
		
		this.poem.on( 'destroy', this.hideWinScreen.bind(this) );
		
	},
	
	hideWinScreen : function() {
		
		this.$win.scope.addClass('hide');
		$('#container canvas').css('opacity', 1);
		
		setTimeout(function() {
			this.$win.scope.hide();
		}.bind(this), 1000);
		
	},
	
};