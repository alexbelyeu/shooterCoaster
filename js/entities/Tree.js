var destroyMesh = require('../utils/destroyMesh');
	
	var Tree = function (poem, x, z, height, radius) {
	
		this.poem = poem;
		this.object = null;

		this.position = new THREE.Vector3();
		this.position.x = x || 0;
		this.position.y = height/2;
		this.position.z = z || 0;
		this.height = height || 100;		
		this.radius = radius || 50;
		
		this.color = 0x006400;
		this.name = "Tree";

		this.addObject();
		this.object.position.copy(this.position);
	};
	module.exports = Tree;
	
	Tree.prototype = {
		addObject: function (){
			var geometry = new THREE.CylinderGeometry(0,this.radius,this.height,32);
			var material = new THREE.MeshBasicMaterial({color: this.color, fog: false});
			this.object = new THREE.Mesh(geometry,material);
			this.poem.scene.add(this.object);
			this.poem.on( 'destroy', destroyMesh( this.object ) );
		}	
	};