	/**
	 * @author mrdoob / http://mrdoob.com/
	 */
	
	var destroyMesh = require('../utils/destroyMesh');
	
	var Trees = function (poem, properties) {
	
		//THREE.BufferGeometry.call( this );
		this.poem = poem;
		//this.polarObj = new THREE.Object3D();
		this.object = null;
		this.color = 0x006400;
		properties = _.isObject( properties ) ? properties : {};
		this.count = _.isNumber( properties.count ) ? properties.count : 2000;
		this.addObject();
	};
	module.exports = Trees;
	
	Trees.prototype = {
		
		addObject : function(){
			var geometry = new THREE.Geometry();
			for ( var i = 0; i < this.count; i ++ ) {
	
				var x = Math.random() * 5000 - 2500;
				var z = Math.random() * 5000 - 2500;
				var y = 0;
		
				var height = Math.random() * 40 + 25;
		
				var angle = Math.random() * Math.PI * 2;
		
				geometry.vertices.push(new THREE.Vector3( x + Math.sin( angle ) * 10, y, z + Math.cos( angle ) * 10 ));
				geometry.vertices.push(new THREE.Vector3( x, y + height, z ));
				geometry.vertices.push(new THREE.Vector3( x + Math.sin( angle + Math.PI ) * 10, y, z + Math.cos( angle + Math.PI ) * 10 ));
						
				angle += Math.PI / 2;
		
				geometry.vertices.push(new THREE.Vector3( x + Math.sin( angle ) * 10, y, z + Math.cos( angle ) * 10 ));
				geometry.vertices.push(new THREE.Vector3( x, y + height, z ));
				geometry.vertices.push(new THREE.Vector3( x + Math.sin( angle + Math.PI ) * 10, y, z + Math.cos( angle + Math.PI ) * 10 ));
		
				//var random = Math.random() * 0.1;
		
				//for ( var j = 0; j < 6; j ++ ) {
				//
				//	geometry.colors.push( 0.2 + random, 0.4 + random, 0 );
				//}	
			}
			var material = new THREE.MeshBasicMaterial( { 
					side: THREE.DoubleSide, 
					vertexColors: THREE.VertexColors,
					color: this.color
				} 
			);
			this.object = new THREE.Mesh(geometry, material);
			//this.polarObj.add( this.object );
			//console.log(this.object);
			this.poem.scene.add(this.object);
			//console.log(this.object);
			//console.log(this.polarObj);
			this.poem.on( 'destroy', destroyMesh( this.object ) );
		}
	};