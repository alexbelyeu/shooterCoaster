var CoordinatesXYZ = require('./utils/CoordinatesXYZ');
	var Camera = require('./components/Camera');
	var RollerCoasterGenerator = require('./components/RollerCoasterGenerator');
	var Gun = require('./managers/Gun');
	var Skybox = require('./components/Skybox');
	var TreeField = require('./managers/TreeField');
	var Stats = require('./utils/Stats');
	var EventDispatcher = require('./utils/EventDispatcher');
	var ScoringAndWinning = require('./components/ScoringAndWinning');
	var Clock = require('./utils/Clock');

	var renderer, waterNormals, water, mirrorMesh;
	var mouse = new THREE.Vector2();
	var raycaster;

	var Poem = function( level, slug ) {
		
		// Loaded Objects
		this.loader = new THREE.ColladaLoader();
		this.loader.options.convertUpAxis = true;
		this.loader.load( './js/entities/models/newcoupleShade.dae', function (collada){
			//console.log(collada.scene)
			var shark   = collada.scene.children[0].children[0];
			//var minion  = collada.scene.children[1].children[0];
			var snowman = collada.scene.children[2].children[0];
			var crow  = collada.scene.children[3].children[0];

			crow.traverse(function(child){

				if (child instanceof THREE.Mesh){
					child.traverse(function(e){
						e.castShadow = true;
						e.receiveShadow = true;
						e.material.needsUpdate = true;
					})
				}
			});
			shark.traverse(function(child){

				if (child instanceof THREE.Mesh){
					child.traverse(function(e){
						e.castShadow = true;
						e.receiveShadow = true;
						e.material.needsUpdate = true;
					})
				}
			});
			snowman.traverse(function(child){

				if (child instanceof THREE.Mesh){
					child.traverse(function(e){
						e.castShadow = true;
						e.receiveShadow = true;
						e.material.needsUpdate = true;
					})
				}
			});
			poem.crow = crow;
			poem.shark = shark;
			poem.snowman = snowman;
			crow.updateMatrix();
			shark.updateMatrix();
			//snowman.updateMatrix();
			
			//Stuff
			poem.slug = slug;
	
			poem.groundWidth = level.config.groundWidth || 5000;
			poem.groundHeight = level.config.groundHeight || 5000;
			poem.groundWidthSegments = level.config.groundWidthSegments || 30;
			poem.groundHeightSegments = level.config.groundHeightSegments || 30;
			poem.groundColor = level.config.groundColor || 	0x407000;
			poem.isOcean = level.config.isOcean || "no";
			poem.isSnow = level.config.isSnow || "no";
			poem.div = document.getElementById( 'container' );
			poem.scene = new THREE.Scene();
			poem.requestedFrame = undefined;
			poem.skybox = new Skybox( poem, level.config.skybox );
			poem.started = false;
			
			poem.clock = new Clock();
			poem.coordinatesXYZ = new CoordinatesXYZ( poem );
			poem.light = new THREE.HemisphereLight( 0xfff0f0, 0x606066 );
			poem.directionalLight = new THREE.DirectionalLight( 0xffffff, 0.5 );
			poem.directionalLight.position.set( 1, 1, 1 );
			poem.scene.add( poem.directionalLight );
			
			poem.scene.add( poem.light );
			poem.camera = new Camera( poem, level.config, level.objects );
			
			//Ground
				poem.ground = new THREE.PlaneGeometry( 
					poem.groundWidth, poem.groundHeight, 
					poem.groundWidthSegments, poem.groundHeightSegments 
					);
				poem.ground.applyMatrix( new THREE.Matrix4().makeRotationX( - Math.PI / 2 ) );
				poem.material = new THREE.MeshPhongMaterial( { color: poem.groundColor, shading: THREE.FlatShading } );
				if(poem.isOcean =="no" && poem.isSnow == "no"){
					poem.scene.fog = new THREE.Fog( 0x202020, 1, 4000 );
					for ( var i = 0; i < poem.ground.vertices.length; i ++ ) {
					
						var vertex = poem.ground.vertices[ i ];
					
						vertex.x += Math.random() * 100 - 50;
						vertex.z += Math.random() * 100 - 50;
					
						var distance = ( vertex.distanceTo( poem.scene.position ) / 5 ) - 250;
					
						vertex.y = Math.random() * Math.max( 0, distance );
					}
					poem.ground.computeFaceNormals();
				} else if(poem.isSnow = "yes" && poem.isOcean == "no"){
					poem.scene.fog = new THREE.Fog( 0xd0d8ea, 1, 4000 );
					poem.scene.fogExp2 = new THREE.FogExp2( 0xffffff, 0.001 );
				}
				poem.mesh = new THREE.Mesh( poem.ground, poem.material );
				poem.scene.add( poem.mesh );

				if (poem.isSnow = "no" && poem.isOcean == "yes"){
					poem.mesh.visible = false;
					waterNormals = new THREE.ImageUtils.loadTexture('assets/images/textures/waternormals.jpg');
					waterNormals.wrapS = waterNormals.wrapT = THREE.RepeatWrapping;
					renderer = new THREE.WebGLRenderer({
						alpha : true,
						antialias: true
					});
					renderer.setPixelRatio( window.devicePixelRatio );
					renderer.setSize( window.innerWidth, window.innerHeight );
					renderer.shadowMap.enabled = true;
					renderer.shadowMap.type = THREE.PCFSoftShadowMap;
					poem.div.appendChild( renderer.domElement );
					poem.water = new THREE.Water(renderer, poem.camera.object, poem.scene, {
						textureWidth: 512,
						textureHeight: 512,
						waterNormals: waterNormals,
						alpha: 1,
						sunDirection: poem.directionalLight.position.clone().normalize(),
						sunColor: 0xffffff,
						waterColor: 0x004f41,
						distortionScale: 25,
					});
		
					mirrorMesh = new THREE.Mesh(
						new THREE.PlaneBufferGeometry(5000, 5000), poem.water.material);
					mirrorMesh.add(poem.water);
					mirrorMesh.rotation.x = (-Math.PI*0.5);
					poem.scene.add(mirrorMesh);
				}
			
			poem.gun = new Gun( poem );

			if (poem.slug == "level4") {
				poem.bulletSpeed = 200;
			} else {poem.bulletSpeed = 75;}

			
			poem.scoringAndWinning = new ScoringAndWinning( poem, level.config.scoringAndWinning );
			raycaster = new THREE.Raycaster();

			poem.parseLevel( level );
			poem.dispatch({
				type: 'levelParsed'
			});
			
			if(!renderer) {
					poem.addRenderer();
				}
				poem.addEventListeners();
			setTimeout(function() {
				poem.start();		
			}.bind(this), 5000);
		});
	};

	module.exports = Poem;

	Poem.prototype = {
	
		parseLevel : function( level ) {
			_.each( level.objects, function loadComponent( value, key ) {
				if(_.isObject( value )) {
					poem[ key ] = new value.object( poem, value.properties );
				} else {
					poem[ key ] = value;
				}
				
			}, poem);
		},
		
		addRenderer : function() {
			renderer = new THREE.WebGLRenderer({
				alpha : true,
				antialias: true
			});
			renderer.setSize( window.innerWidth, window.innerHeight );
			renderer.shadowMap.enabled = true;
			renderer.shadowMap.type = THREE.PCFSoftShadowMap;
			poem.div.appendChild( renderer.domElement );
		},
		
		getCanvas : function() {
			if( renderer ) {
				return renderer.domElement;
			}
		},
		
		addStats : function() {
			poem.stats = new Stats();
			poem.stats.domElement.style.position = 'absolute';
			poem.stats.domElement.style.top = '0px';
			$("#container").append( poem.stats.domElement );
		},
			
		addEventListeners : function() {
			$(window).on('resize', poem.resizeHandler.bind(poem));
			//$(window).on('keydown', poem.fullScreen.bind(poem));
			document.addEventListener('mousemove', poem.onMouseMove, false);
			document.addEventListener('mousedown', poem.onMouseDown, false);
			
		},

		fullScreen : function(e) {
			if( e.keyCode !== 32 ) return;
			THREEx.FullScreen.request();
		},
		
		resizeHandler : function() {
			
			poem.camera.resize();
			renderer.setSize( window.innerWidth, window.innerHeight );
	
		},
		
		start : function() {
			if( !poem.started ) {
				poem.loop();
			}
			poem.started = true;
		},
		
		loop : function() {
	
			poem.requestedFrame = requestAnimationFrame( poem.loop.bind(poem) );
			poem.update();	
		},
		
		pause : function() {
			
			window.cancelAnimationFrame( poem.requestedFrame );
			poem.started = false;
			
		},
				
		update : function() {
			try{
				poem.water.material.uniforms.time.value += 1.0/60.0;
				poem.water.render();
			} catch (e){}

			try{
				poem.dispatch({
					type: "update",
					dt: poem.clock.getDelta(),
					time: poem.clock.time
				});
				poem.scoringAndWinning.adjustTimer();		
				renderer.render( poem.scene, poem.camera.object );
				
			} catch (e){
				poem.pause();
			}
	
		},
		
		destroy : function() {
			
			window.cancelAnimationFrame( poem.requestedFrame );
			
			poem.dispatch({
				type: "destroy"
			});
		},

		onMouseMove : function(e) {
			e.preventDefault();
			mouse.x = (event.clientX / window.innerWidth)*2 -1;
			mouse.y = - (event.clientY / window.innerHeight)*2 +1;
		},

		onMouseDown : function(e) {
			e.preventDefault();
			raycaster.setFromCamera (mouse, poem.camera.object);

			var xO = poem.camera.object.position.x;
			var yO = poem.camera.object.position.y;
			var zO = poem.camera.object.position.z;

			var intersects = raycaster.intersectObjects(poem.scene.children);
			var xD = intersects[0].point.x;
			var yD = intersects[0].point.y;
			var zD = intersects[0].point.z;

			var r = Math.sqrt((xD-xO)*(xD-xO) + (yD-yO)*(yD-yO) + (zD-zO)*(zD-zO));

			poem.gun.fire( xO, xD, yO, yD, zO, zD, r, poem.bulletSpeed );
		}
	};