var routing = require('../routing');
	
	var Menu = function( poem, properties ) {
		this.poem = poem;
		this.rotateCam();
		
		this.webglCheck();
	};
	
	module.exports = Menu;
	
	Menu.prototype = {
		
		webglEnabled : ( function () { try { var canvas = document.createElement( 'canvas' ); return !! window.WebGLRenderingContext && ( canvas.getContext( 'webgl' ) || canvas.getContext( 'experimental-webgl' ) ); } catch( e ) { return false; } } )(),
		
		webglCheck : function() {
			
			if( !this.webglEnabled ) {
				$('.title-webgl-error').show();
			}
			
		},

		nextLevel : function() {
			
			routing.loadUpALevel("level1");
			
		},

		rotateCam : function() {
		
		this.poem.on('update', function(e) {
			var nowTime = performance.now();
			this.poem.camera.object.position.x = Math.sin( nowTime*0.0001) *600;
			this.poem.camera.object.position.z = Math.cos( nowTime*0.0001) *600;
			this.poem.camera.object.lookAt( this.poem.scene.position );
		}.bind(this) );
		
		}		
	};