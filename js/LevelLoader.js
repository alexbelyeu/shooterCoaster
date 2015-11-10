var Poem = null;
	var levels = null;
	var EventDispatcher = require('./utils/EventDispatcher');
	
	var currentLevel = null;
	var currentPoem = null;
	var titleHideTimeout = null;
	
	function showTitles() {
		
		$('.score').css('opacity', 0);
		$('.timer').css('opacity', 0);
		
		clearTimeout( titleHideTimeout );
		
		$('#title')
			.removeClass('transform-transition')
			.addClass('hide')
			.addClass('transform-transition')
			.show();
		
		setTimeout(function() {
			$('#title').removeClass('hide');
		}, 8000);
		
		
		
	}
	
	function hideTitles() {

		$('.score').css('opacity', 0.9);
		$('.timer').css('opacity', 0.9);
		
		if( $('#title:visible').length > 0 ) {		
		
			$('#title')
				.addClass('transform-transition')
				.addClass('hide');
	
			titleHideTimeout = setTimeout(function() {
		
				$('#title').hide();
		
			}, 1000);
		}
		$('#countdown3')
			.removeClass('hide')
			.removeClass('transform-transition')
			.addClass('transform-transition')
			.show();
		setTimeout(function(){
			$('#countdown3')
			.addClass('transform-transition')
			.addClass('hide');
		}, 750);

		setTimeout(function() {
			$('#countdown2')
			.removeClass('hide')
			.removeClass('transform-transition')
			.addClass('transform-transition')
			.show();
			setTimeout(function(){
				$('#countdown2')
				.addClass('transform-transition')
				.addClass('hide');
			}, 1000);
		}, 1500);
		setTimeout(function() {
			$('#countdownGo')
			.removeClass('hide')
			.removeClass('transform-transition')
			.addClass('transform-transition')
			.show();
			setTimeout(function(){
				$('#countdownGo')
				.addClass('transform-transition')
				.addClass('hide');
			}, 1250);
		}, 4500);
		
	}
	
	var levelLoader = {
	
	init : function( PoemClass, levelsObject ) {
		Poem = PoemClass;
		levels = levelsObject;
	},
	
	load : function( slug ) {
		
		if( !_.isObject(levels[slug]) ) {
			return false;
		}
		
		if(currentPoem) currentPoem.destroy();
		
		currentLevel = levels[slug];
		currentPoem = new Poem( currentLevel, slug );
		
		if( slug === "menu" ) {
			showTitles();
		} else {
			hideTitles();
		}
		
		this.dispatch({
			type: "newLevel",
			level: currentLevel,
			poem: currentPoem
		});
		
		window.poem = currentPoem;

		this.isFirefox = typeof InstallTrigger !== 'undefined';
		if (this.isFirefox) {
			$('.title-firefox').show();
			currentPoem.pause();
		}

		return true;
	}
		
	};