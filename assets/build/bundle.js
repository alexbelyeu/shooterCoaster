//FUNCTION TO READ MODULES
(function e(t,n,r){
	function s(o,u){
		if(!n[o]){
			if(!t[o]){
				var a=typeof require=="function"&&require;
				if(!u&&a)return a(o,!0);
				if(i)return i(o,!0);
				var f=new Error("Cannot find module '"+o+"'");
				throw f.code="MODULE_NOT_FOUND",
				f}
		var l=n[o]={exports:{}};
		t[o][0].call(l.exports,function(e){
			var n=t[o][1][e];
			return s(n?n:e)
			},
		l,l.exports,e,t,n,r
		)}
		return n[o].exports
	}
	var i=typeof require=="function"&&require;
	for(var o=0;o<r.length;o++)
		s(r[o]);
	return s
})

({
"./js":[function(require,module,exports){
	var routing = require('./routing');
	var ui = require('./ui');

	routing.start(
		require('./Poem'),
		require('./levels')
	);
	},
	{"./Poem":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/Poem.js",
	"./levels":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/levels/index.js",
	"./routing":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/routing.js",
	"./ui":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/ui/index.js"}],

"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/Poem.js":[function(require,module,exports){
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

	EventDispatcher.prototype.apply( Poem.prototype );
	},
	{"./components/Camera":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/components/Camera.js",
	"./components/RollerCoasterGenerator":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/components/RollerCoasterGenerator.js",
	"./components/ScoringAndWinning":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/components/ScoringAndWinning.js",
	"./components/Skybox":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/components/Skybox.js",
	"./managers/TreeField":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/managers/TreeField.js",
	"./managers/Gun":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/managers/Gun.js",
	"./utils/Clock":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/utils/Clock.js",
	"./utils/CoordinatesXYZ":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/utils/CoordinatesXYZ.js",
	"./utils/EventDispatcher":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/utils/EventDispatcher.js",
	"./utils/Stats":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/utils/Stats.js"}],

"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/components/Camera.js":[function(require,module,exports){
	var Curve1 = require("./Curve1");
	var Curve2 = require("./Curve2");
	var RollerCoasterGenerator = require("./RollerCoasterGenerator");
	
	var position = new THREE.Vector3();
	var tangent = new THREE.Vector3();
	var iSee = new THREE.Vector3();
	var velocity = 0;
	var progress = 0;

	var Camera = function( poem, properties, objects ) {
	
		this.poem = poem;
		this.speed = 0.032;
		
		this.rollerSpeed = objects.rollercoastergenerator.properties.rollerSpeed;
		this.minRollerSpeed = objects.rollercoastergenerator.properties.minRollerSpeed;
		

		var varA = objects.rollercoastergenerator.properties.varA;
		var varB = objects.rollercoastergenerator.properties.varB;
		var varC = objects.rollercoastergenerator.properties.varC;
		var scalar = objects.rollercoastergenerator.properties.scalar;
		this.curve1 = Curve1(varA, varB, varC, scalar);
		this.curve2 = Curve2(varA, varB, varC, scalar);
		var curve = objects.rollercoastergenerator.properties.curve;
		this.curve = curve == "curve1" ? this.curve1 : this.curve2;
	
		var camTitles =new THREE.PerspectiveCamera( 
			65, window.innerWidth / window.innerHeight, 1, 5000 );
		var camGame = new THREE.PerspectiveCamera( 
			80, window.innerWidth / window.innerHeight, 1, 11000 );
	
		this.object = properties.isThisTitles == "yes" ? camTitles : camGame;

		if (this.object === camTitles){
			this.object.position.y = 700;
			this.object.rotation.x = 1.7*Math.PI;
			this.object.setLens(15, 35);
		} else {
			velocity=0;
			this.poem.on('update', this.updateCamGame.bind(this) );
		}
		};
	
		module.exports = Camera;
	
		Camera.prototype = {
		
		resize : function() {
			this.object.aspect = window.innerWidth / window.innerHeight;
			this.object.updateProjectionMatrix();
		},

		updateCamGame : function (e) {
			
			progress += velocity;
			progress = progress % 1;
			
			position.copy( this.curve.getPointAt( progress ) );
			position.y += 6;		
			this.object.position.copy(position);
			
			tangent.copy( this.curve.getTangentAt( progress ) );
			velocity -= tangent.y * this.rollerSpeed;
			velocity = Math.max( velocity, this.minRollerSpeed );

			this.object.lookAt(iSee.copy(position).add(tangent));
		}
		};
		},
		{"./Curve1":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/components/Curve1.js",
		"./Curve2":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/components/Curve2.js",
		"./RollerCoasterGenerator":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/components/RollerCoasterGenerator.js"}],
	
"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/components/Skybox.js":[function(require,module,exports){
	var destroyMesh = require('../utils/destroyMesh');
	
	var Skybox = function( poem, properties ) {
	
	this.poem = poem;

	properties = _.isObject( properties ) ? properties : {};
	this.sky = properties.sky ? properties.sky : "skyboxsun5deg";
	this.width = properties.width ? properties.width : 5000;
	this.height = properties.height ? properties.height : 1400;
	this.depth = properties.depth ? properties.depth : 5000;

	var path = "./assets/images/" + this.sky + "/";
	var format = '.bmp';
	var urls = [
				path+'1'+format, path+'2'+format,
				path+'3'+format, path+'4'+format,
				path+'5'+format, path+'6'+format
			];
	var reflectionCube = THREE.ImageUtils.loadTextureCube(urls);
	reflectionCube.format = THREE.RGBFormat;

	// Skybox
	var shader = THREE.ShaderLib["cube"];
	shader.uniforms["tCube"].value = reflectionCube;
	var material = new THREE.ShaderMaterial ({
		fragmentShader: shader.fragmentShader,
		vertexShader: shader.vertexShader,
		uniforms: shader.uniforms,
		side: THREE.BackSide
	});
	var mesh = new THREE.Mesh( new THREE.BoxGeometry( this.width, this.height, this.depth ), material );
	this.name = "skybox";
	this.poem.scene.add(mesh);
	};
	
	module.exports = Skybox;
	},
	{"../utils/destroyMesh":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/utils/destroyMesh.js"}],

"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/components/Damage.js":[function(require,module,exports){
	var _ = require('underscore');
	var random = require('../utils/random.js');
	var Bullet = require('../entities/Bullet');
	var SoundGenerator = require('../sound/SoundGenerator');
	var destroyMesh = require('../utils/destroyMesh');

	var Damage = function( poem, settings ) {
	
	this.poem = poem;
	this.color = null;
	this.perExplosion = 100;
	this.retainExplosionsCount = 3;
	this.bullets = [];
	this.explodeSpeed = 3;
	this.transparent = false;
	this.opacity = 1;
	
	this.explosionCount = 0;
	this.explosionSound = null;
	
	if( _.isObject( settings ) ) {
		_.extend( this, settings );
	}
	
	this.count = this.perExplosion * this.retainExplosionsCount;
	
	this.addObject();
	this.addSound();
	};
		
	Damage.prototype = {
	
	generateGeometry : function() {
		
		var vertex, bullet;
		
		var geometry = new THREE.Geometry();
		
		for(var i=0; i < this.count; i++) {
			
			vertex = new THREE.Vector3();
			bullet = new Bullet( this.poem, this, vertex );
			
			geometry.vertices.push( vertex );
			this.bullets.push( bullet );
			
			bullet.kill();
			bullet.position.y = 1000;
					
		}
		
		return geometry;
	},
	
	addObject : function() {
		
		var geometry, lineMaterial;
		
		geometry = this.generateGeometry();
		
		this.object = new THREE.Points(
			geometry,
			new THREE.PointsMaterial({
				 size: 1,
				 color: this.color,
				 transparent: this.transparent,
				 opacity: this.opacity
			}
		));
		this.object.frustumCulled = false;
		this.poem.scene.add( this.object ) ;
		this.poem.on( 'destroy', destroyMesh( this.object ) );
	},
	
	addSound : function() {
		
		var sound = this.explosionSound = new SoundGenerator();
		
		sound.connectNodes([
			sound.makeOscillator( "sawtooth" ),
			sound.makeGain(),
			sound.getDestination()
		]);
		
		sound.setGain(0,0,0);
		sound.start();
		
	},
	
	reset : function() {
		
		_.each( this.bullets, function( bullet ) {
			bullet.kill();
		});
		
	},
	
	explode : function( position ) {
		
		this.playExplosionSound();
		
		_.each( _.sample( this.bullets, this.perExplosion ), function( bullet) {

			var theta = random.range(0, 2 * Math.PI);
			var r = random.rangeLow( 0, this.explodeSpeed );
			
			bullet.alive = true;
			bullet.position.copy( position );
			
			bullet.speed.x = r * Math.cos( theta );
			bullet.speed.y = r * Math.sin( theta );
						
		}.bind(this));
		
	},
	
	playExplosionSound : function() {
		
		var freq = 500;
		var sound = this.explosionSound;

		//Start sound
		sound.setGain(0.3, 0, 0.001);
		sound.setFrequency(freq, 0, 0);
		
		var step = 0.02;
		var times = 6;
		var i=1;
		
		for(i=1; i < times; i++) {
			sound.setFrequency(freq * Math.random(), step * i, step);
		}

		//End sound
		sound.setGain(0, step * times, 0.2);
		sound.setFrequency(freq * 0.21, step * times, 0.05);
	},
	
	update : function( e )  {
		
		_.each( this.bullets, function( bullet ) {
			bullet.update( e );
			bullet.speed.multiplyScalar(0.999);
		});
		
		this.object.geometry.verticesNeedUpdate = true;
		
	},
	
	};

	module.exports = Damage;
	},
	{"../entities/Bullet":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/entities/Bullet.js",
	"../sound/SoundGenerator":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/sound/SoundGenerator.js",
	"../utils/destroyMesh":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/utils/destroyMesh.js",
	"../utils/random.js":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/utils/random.js",
	"underscore":"node_modules/underscore/underscore.js"}],

"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/components/ScoringAndWinning.js":[function(require,module,exports){
	/*
		Set the win conditions in the level manifest as below
	
			properties: {
				conditions: [
					{
						component: "manager",
						properties: null
					}
				]
			}
	
		Psuedo-code gets called:
	
			manager.watchForCompletion( winCheck, properties );
	
		Then in the manager component, call the following when condition is completed:
	
			scoringAndWinning.reportConditionCompleted();
	
	*/
	var routing = require('../routing');
	var scores = require('./scores');
	var selectors = require('../utils/selectors');
	var menu = require('../ui/menu');
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

		this.$timer = selectors( "#timer", {
			timerCount	: '.timer-count'
			//message			: '.score-message',
		});
	
		this.$win = selectors( '#win', {
			score		: '.win-score',
			maxScore	: '.win-max-score',
			text		: '.win-text',
			nextLevel	: '.win-next-level',
			restart		: '.win-restart'
		});
		
		this.score = 0;
		//this.timer = 60;
		this.enemiesCount = 0;
		this.timerCount = properties.timerCount ? properties.timerCount : 60;
		//this.winPercent = properties.winPercent ? properties.winPercent : 100;
		this.contador = 1;
		this.scoreMessageId = 0;
		this.message = _.isString( properties.message ) ? properties.message : "You Win";
		this.nextLevel = properties.nextLevel ? properties.nextLevel : null;
		this.won = false;
		this.maxScore = levels[ poem.slug ].maxScore;
		
		this.$score.total.text( this.maxScore );
		this.updateScoreElements();
		//this.adjustTimer(this.timerCount);
		
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
					this.won = true;
					this.conditionsCompleted();
					this.adjustTimer;				
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

		adjustTimer : function() {
			if (this.poem.slug === "menu" || this.contador == 0 || this.won) return;

			this.contador = Math.round(this.timerCount - this.poem.clock.time/1000);
			this.$timer.timerCount.text( this.contador );
			
			if (this.contador == 0){
				//this.conditionsCompleted();
				this.conditionsRemaining.length = 0;
				this.reportConditionCompleted();
				this.$timer.timerCount.text( 0 );
				return;
			}

			return this.contador;
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
			
			if( this.maxScore==this.score ) {
				this.conditionsRemaining.length === 0;
				this.reportConditionCompleted();
			}

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
			if (this.poem.slug === "menu") return;		
			this.$win.score.text( this.score );
			this.$win.maxScore.text( this.maxScore );
			this.$win.text.html( this.message );
			this.isOpen = false;
			
			this.showWinScreen();
			this.$win.nextLevel.off().click( 'click', function( e ) {

				e.preventDefault();
				
				if( this.isOpen ) {
					menu.close();
				} else {
					menu.open();
				}
				this.isOpen = !this.isOpen;

				//routing.loadUpALevel( this.nextLevel );
				//this.hideWinScreen();
				
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
	},
	{"../levels":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/levels/index.js",
	"../routing":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/routing.js",
	"../utils/selectors":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/utils/selectors.js",
	"../ui/menu":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/ui/menu.js",
	"./scores":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/components/scores.js"}],

"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/components/Funfairs.js":[function(require,module,exports){

	var destroyMesh = require('../utils/destroyMesh');

	var Funfairs = function( poem, properties ) {	
	
	properties = _.isObject( properties ) ? properties : {};
	this.poem = poem;
	this.object = null;
	this.name = "funfair";
	_.extend( this, properties ) ;

	this.posX1 = properties.posX ? properties.posX : 0;
	this.posZ1 = properties.posZ ? properties.posZ : -500;
	this.posX2 = properties.posX ? properties.posX : 500;
	this.posZ2 = properties.posZ ? properties.posZ : 0;

	//Funfairs
	this.funfairs = [];
	//Funfair1
	this.funfair1 = new THREE.CylinderGeometry(100, 100, 50, 15);
	this.material = new THREE.MeshLambertMaterial({color: 0xff8080});
	this.object = new THREE.Mesh(this.funfair1, this.material);
	this.object.position.set( this.posX1, 100, this.posZ1);
	this.object.rotation.x = Math.PI / 2;
	this.object.radius = 104.115;
	this.poem.scene.add(this.object);
	this.funfairs.push(this.object);

	//Funfair2
	this.funfair2 = new THREE.CylinderGeometry(50, 60, 40, 10);
	this.material = new THREE.MeshLambertMaterial({color: 0x8080ff});
	this.object = new THREE.Mesh(this.funfair2, this.material);
	this.object.position.set( this.posX2, 20, this.posZ2);
	this.object.radius = 63.245;
	this.poem.scene.add(this.object);
	this.funfairs.push(this.object);
	
	this.poem.on('destroy', destroyMesh( this.object) );
	
	this.poem.on('update', function( e ) {

		for ( var i = 0; i < this.funfairs.length; i ++ ) {
			this.funfairs[ i ].rotation.y += e.dt*0.0008;
		}

	}.bind(this));
	this.poem.gun.setBarrierCollider( this.funfairs );
	};

	module.exports = Funfairs;
	},
	{"../utils/destroyMesh":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/utils/destroyMesh.js"}],

"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/components/Curve1.js":[function(require,module,exports){
	var routing = require('../routing');

	var Curve1 = function (varA, varB, varC, scalar) {
	
		this.vector = new THREE.Vector3();
		this.vector2 = new THREE.Vector3();
		this.PI2 = Math.PI * 2;
		
		return {
			getPointAt: function ( t ) {
				t = t * PI2;

				var x = Math.sin( t * varA ) * Math.cos( t * varC ) * varC*13;
				var y = Math.cos( t * varC*2 ) * varC + Math.cos( t * varB ) + 5;
				var z = Math.sin( t ) * Math.sin( t * varC ) * varC*13;
				vector.set( x, y, z ).multiplyScalar( scalar );
				return vector;
			},

			getTangentAt: function ( t ) {

				var delta = 0.0001;
				var t1 = Math.max( 0, t - delta );
				var t2 = Math.min( 1, t + delta );

				return vector2.copy( this.getPointAt ( t2 ) ).sub( this.getPointAt( t1 ) ).normalize();

			}
		};
		};
		module.exports = Curve1;
	},
	{"../routing":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/routing.js"}],

"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/components/Curve2.js":[function(require,module,exports){
	var routing = require('../routing');

	var Curve2 = function (varA, varB, varC, scalar) {
	
		this.vector = new THREE.Vector3();
		this.vector2 = new THREE.Vector3();
		this.PI2 = Math.PI * 2;
		
		return {
			getPointAt: function ( t ) {
				t = t * PI2;

				var x = Math.sin( t * varA ) * Math.cos( t * varC ) * varC*13;
				var y = Math.cos( t * varC*2 )*(t/2) * varC + Math.cos( t * varB ) + 15;
				var z = Math.sin( t ) * Math.sin( t * varC ) * varC*13;
				vector.set( x, y, z ).multiplyScalar( scalar );
				return vector;
			},

			getTangentAt: function ( t ) {

				var delta = 0.0001;
				var t1 = Math.max( 0, t - delta );
				var t2 = Math.min( 1, t + delta );

				return vector2.copy( this.getPointAt ( t2 ) ).sub( this.getPointAt( t1 ) ).normalize();

			}
		};
		};
		module.exports = Curve2;
	},
	{"../routing":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/routing.js"}],	

"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/components/RollerCoaster.js":[function(require,module,exports){
	/**
	 * @author mrdoob / http://mrdoob.com/
	 */
	var routing = require('../routing');
	
	var RollerCoaster = function ( curve, size, color1, color2 ) {

		var geometry = new THREE.Geometry();
		var vertices = geometry.vertices;
		var normals = [];
		var colors = geometry.colors;
		var faces = geometry.faces;
	
		var colorC1 = color1;
		var colorC2 = color2;
		//var color3 = [ 1, 0, 0 ]; //red
	
		var up = new THREE.Vector3( 0, 1, 0 );
		var forward = new THREE.Vector3();
		var right = new THREE.Vector3();
	
		var quaternion = new THREE.Quaternion();
		var prevQuaternion = new THREE.Quaternion();
		prevQuaternion.setFromAxisAngle( up , Math.PI / 2 );
	
		var point = new THREE.Vector3();
		var prevPoint = new THREE.Vector3();
		prevPoint.copy(curve.getPointAt( 0 ) );
	
		// shapes
	
		var step = [
			new THREE.Vector3( -2.25,  0, 0 ),
			new THREE.Vector3(  0,  -0.5, 0 ),
			new THREE.Vector3(  0, -1.75, 0 ),
	
			new THREE.Vector3(  0,  -0.5, 0 ),
			new THREE.Vector3(  2.25,  0, 0 ),
			new THREE.Vector3(  0, -1.75, 0 )
		];
	
		var PI2 = Math.PI * 2;
	
		var sides = 5;
		var tube1 = [];
	
		for ( var i = 0; i < sides; i ++ ) {
	
			var angle = ( i / sides ) * PI2;
			tube1.push( new THREE.Vector3( Math.sin( angle ) * 0.6, Math.cos( angle ) * 0.6, 0 ) );
	
		}
	
		var sides = 6;
		var tube2 = [];
	
		for ( var i = 0; i < sides; i ++ ) {
	
			var angle = ( i / sides ) * PI2;
			tube2.push( new THREE.Vector3( Math.sin( angle ) * 0.25, Math.cos( angle ) * 0.25, 0 ) );
	
		}
	
		var vector = new THREE.Vector3();
		var normal = new THREE.Vector3();
	
		var drawShape = function ( shape, color ) {
			
			var arrayFaceUp = [];
			normal.set( 0, 0, -1 ).applyQuaternion( quaternion );			
			for ( var j = 0; j < shape.length; j ++ ) {
				
				vector.copy( shape[ j ] );
				vector.applyQuaternion( quaternion );
				vector.add( point );

				arrayFaceUp[j] = vertices.push( new THREE.Vector3( vector.x, vector.y, vector.z )) -1;

				normals.push( new THREE.Vector3( normal.x, normal.y, normal.z ));
				//colors.push( color[ 0 ], color[ 1 ], color[ 2 ] );
				
			}
			
			var fU1 = new THREE.Face3( arrayFaceUp[0], arrayFaceUp[1], arrayFaceUp[2] );
			fU1.color = color;
			var fU2 = new THREE.Face3( arrayFaceUp[3], arrayFaceUp[4], arrayFaceUp[5] );
			fU2.color = color;
			faces.push(fU1,fU2);
		};
	
		var vector1 = new THREE.Vector3();
		var vector2 = new THREE.Vector3();
		var vector3 = new THREE.Vector3();
		var vector4 = new THREE.Vector3();
	
		var normal1 = new THREE.Vector3();
		var normal2 = new THREE.Vector3();
		var normal3 = new THREE.Vector3();
		var normal4 = new THREE.Vector3();
	
		var extrudeShape = function ( shape, offset, color ) {
	
			for ( var j = 0, jl = shape.length; j < jl; j ++ ) {
	
				var point1 = shape[ j ];
				var point2 = shape[ ( j + 1 ) % jl ];
	
				vector1.copy( point1 ).add( offset );
				vector1.applyQuaternion( quaternion );
				vector1.add( point );
	
				vector2.copy( point2 ).add( offset );
				vector2.applyQuaternion( quaternion );
				vector2.add( point );
	
				vector3.copy( point2 ).add( offset );
				vector3.applyQuaternion( prevQuaternion );
				vector3.add( prevPoint );
	
				vector4.copy( point1 ).add( offset );
				vector4.applyQuaternion( prevQuaternion );
				vector4.add( prevPoint );
	
				ai = vertices.push(new THREE.Vector3( vector1.x, vector1.y, vector1.z )) -1;
				bi = vertices.push(new THREE.Vector3( vector2.x, vector2.y, vector2.z )) -1;
				ci = vertices.push(new THREE.Vector3( vector4.x, vector4.y, vector4.z )) -1;

				di = vertices.push(new THREE.Vector3( vector2.x, vector2.y, vector2.z )) -1;
				ei = vertices.push(new THREE.Vector3( vector3.x, vector3.y, vector3.z )) -1;
				fi = vertices.push(new THREE.Vector3( vector4.x, vector4.y, vector4.z )) -1;

				var f1 = new THREE.Face3( ai, bi, ci );
				var f2 = new THREE.Face3( di, ei, fi );
				f1.color = color;
				f2.color = color;
				
				faces.push(
				f1, f2	
				);
			}
	
		};
	
		var offset = new THREE.Vector3();
	
		for ( var i = 1; i <= size; i ++ ) {
	
			point.copy( curve.getPointAt( i / size ) );
	
			up.set( 0, 1, 0 );
	
			forward.subVectors( point, prevPoint ).normalize();
			right.crossVectors( up, forward ).normalize();
			up.crossVectors( forward, right );
	
			var angle = Math.atan2( forward.x, forward.z );
	
			quaternion.setFromAxisAngle( up, angle );
	
			if ( i % 2 === 0 ) {
	
				drawShape( step, color2 );
				//if(i%4 === 0){drawShape( step, color3 )}
	
			}
	
			extrudeShape( tube1, offset.set( 0, -1.25, 0 ), color2 );
			extrudeShape( tube2, offset.set( 2, 0, 0 ), color1 );
			extrudeShape( tube2, offset.set( -2, 0, 0 ), color1 );
	
			prevPoint.copy( point );
			prevQuaternion.copy( quaternion );
	
		}
		
		geometry.mergeVertices();
		geometry.computeVertexNormals(true);
		geometry.computeFaceNormals();

		return geometry;
	};
	module.exports = RollerCoaster;
	},
	{"../routing":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/routing.js"}],

"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/components/RollerCoasterShadow.js":[function(require,module,exports){

	var RollerCoasterShadow = function (curve, size){
		var geometry = new THREE.Geometry();
		var vertices = geometry.vertices;
		var faces = geometry.faces;
		var up = new THREE.Vector3( 0, 1, 0 );
		var forward = new THREE.Vector3();
	
		var quaternion = new THREE.Quaternion();
		var prevQuaternion = new THREE.Quaternion();
		prevQuaternion.setFromAxisAngle( up , Math.PI / 2 );
	
		var point = new THREE.Vector3();	
		var prevPoint = new THREE.Vector3();
		prevPoint.copy( curve.getPointAt( 0 ) );
		prevPoint.y = 0;
	
		var vector1 = new THREE.Vector3();
		var vector2 = new THREE.Vector3();
		var vector3 = new THREE.Vector3();
		var vector4 = new THREE.Vector3();
	
		for ( var i = 1; i <= size; i ++ ) {

		point.copy( curve.getPointAt( i / size ) );
		point.y = 0;

		forward.subVectors( point, prevPoint );

		var angle = Math.atan2( forward.x, forward.z );

		quaternion.setFromAxisAngle( up, angle );

		vector1.set( -3, 0, 0 );
		vector1.applyQuaternion( quaternion );
		vector1.add( point );

		vector2.set(  3, 0, 0 );
		vector2.applyQuaternion( quaternion );
		vector2.add( point );

		vector3.set(  3, 0, 0 );
		vector3.applyQuaternion( prevQuaternion );
		vector3.add( prevPoint );

		vector4.set( -3, 0, 0 );
		vector4.applyQuaternion( prevQuaternion );
		vector4.add( prevPoint );

		ai = vertices.push( new THREE.Vector3(vector1.x, vector1.y, vector1.z ))-1;
		bi = vertices.push( new THREE.Vector3(vector2.x, vector2.y, vector2.z ))-1;
		ci = vertices.push( new THREE.Vector3(vector4.x, vector4.y, vector4.z ))-1;
		di = vertices.push( new THREE.Vector3(vector2.x, vector2.y, vector2.z ))-1;
		ei = vertices.push( new THREE.Vector3(vector3.x, vector3.y, vector3.z ))-1;
		fi = vertices.push( new THREE.Vector3(vector4.x, vector4.y, vector4.z ))-1;
		faces.push(
			new THREE.Face3( ai, bi, ci ),
			new THREE.Face3( di, ei, fi )
		);

		prevPoint.copy( point );
		prevQuaternion.copy( quaternion );
	
		}
		geometry.mergeVertices();
		geometry.computeVertexNormals();
		geometry.computeFaceNormals();
		return geometry;
	};	
	module.exports = RollerCoasterShadow;
	},
	{}],	

"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/components/RollerCoasterLifters.js":[function(require,module,exports){
	
	var RollerCoasterLifters = function ( curve, size ) {
		var geometry = new THREE.Geometry();
		var vertices = geometry.vertices;
		var faces = geometry.faces;
		var normals = [];
	
		var quaternion = new THREE.Quaternion();
	
		var up = new THREE.Vector3( 0, 1, 0 );
	
		var point = new THREE.Vector3();
		var tangent = new THREE.Vector3();
	
		// shapes
	
		var tube1 = [
			new THREE.Vector3(  0,  0.5, -0.5 ),
			new THREE.Vector3(  0,  0.5,  0.5 ),
			new THREE.Vector3(  0, -0.5,  0 )
		];
	
		var tube2 = [
			new THREE.Vector3( -0.5, 0,  0.5 ),
			new THREE.Vector3( -0.5, 0, -0.5 ),
			new THREE.Vector3(  0.5, 0,  0 )
		];
	
		var tube3 = [
			new THREE.Vector3(  0.5, 0, -0.5 ),
			new THREE.Vector3(  0.5, 0,  0.5 ),
			new THREE.Vector3( -0.5, 0,  0 )
		];
	
		var vector1 = new THREE.Vector3();
		var vector2 = new THREE.Vector3();
		var vector3 = new THREE.Vector3();
		var vector4 = new THREE.Vector3();
	
		var normal1 = new THREE.Vector3();
		var normal2 = new THREE.Vector3();
		var normal3 = new THREE.Vector3();
		var normal4 = new THREE.Vector3();
	
		var extrudeShape = function ( shape, fromPoint, toPoint ) {
	
			for ( var j = 0, jl = shape.length; j < jl; j ++ ) {
	
				var point1 = shape[ j ];
				var point2 = shape[ ( j + 1 ) % jl ];
	
				vector1.copy( point1 )
				vector1.applyQuaternion( quaternion );
				vector1.add( fromPoint );
	
				vector2.copy( point2 )
				vector2.applyQuaternion( quaternion );
				vector2.add( fromPoint );
	
				vector3.copy( point2 )
				vector3.applyQuaternion( quaternion );
				vector3.add( toPoint );
	
				vector4.copy( point1 )
				vector4.applyQuaternion( quaternion );
				vector4.add( toPoint );
	
				ai = vertices.push( new THREE.Vector3(vector1.x, vector1.y, vector1.z ))-1;
				bi = vertices.push( new THREE.Vector3(vector2.x, vector2.y, vector2.z ))-1;
				ci = vertices.push( new THREE.Vector3(vector4.x, vector4.y, vector4.z ))-1;
	
				di = vertices.push( new THREE.Vector3(vector2.x, vector2.y, vector2.z ))-1;
				ei = vertices.push( new THREE.Vector3(vector3.x, vector3.y, vector3.z ))-1;
				fi = vertices.push( new THREE.Vector3(vector4.x, vector4.y, vector4.z ))-1;

				//
	
				normal1.copy( point1 );
				normal1.applyQuaternion( quaternion );
				normal1.normalize();
	
				normal2.copy( point2 );
				normal2.applyQuaternion( quaternion );
				normal2.normalize();
	
				normal3.copy( point2 );
				normal3.applyQuaternion( quaternion );
				normal3.normalize();
	
				normal4.copy( point1 );
				normal4.applyQuaternion( quaternion );
				normal4.normalize();

				faces.push(
				new THREE.Face3( ai, bi, ci ),
				new THREE.Face3( di, ei, fi )
				);
		
			}
	
		};
	
		var fromPoint = new THREE.Vector3();
		var toPoint = new THREE.Vector3();
	
		for ( var i = 1; i <= size; i ++ ) {
	
			point.copy( curve.getPointAt( i / size ) );
			tangent.copy( curve.getTangentAt( i / size ) );
	
			var angle = Math.atan2( tangent.x, tangent.z );
	
			quaternion.setFromAxisAngle( up, angle );
	
			//
	
			if ( point.y > 100 ) {
	
				fromPoint.set( -7.5, -3.5, 0 );
				fromPoint.applyQuaternion( quaternion );
				fromPoint.add( point );
	
				toPoint.set( 7.5, -3.5, 0 );
				toPoint.applyQuaternion( quaternion );
				toPoint.add( point );
	
				extrudeShape( tube1, fromPoint, toPoint );
				
				fromPoint.set( -7, -3, 0 );
				fromPoint.applyQuaternion( quaternion );
				fromPoint.add( point );
	
				toPoint.set( -7, -point.y, 0 );
				toPoint.applyQuaternion( quaternion );
				toPoint.add( point );
	
				extrudeShape( tube2, fromPoint, toPoint );
	
				fromPoint.set( 7, -3, 0 );
				fromPoint.applyQuaternion( quaternion );
				fromPoint.add( point );
	
				toPoint.set( 7, -point.y, 0 );
				toPoint.applyQuaternion( quaternion );
				toPoint.add( point );
	
				extrudeShape( tube3, fromPoint, toPoint );
	
			} else {
	
				fromPoint.set( 0, -2, 0 );
				fromPoint.applyQuaternion( quaternion );
				fromPoint.add( point );
	
				toPoint.set( 0, -point.y, 0 );
				toPoint.applyQuaternion( quaternion );
				toPoint.add( point );
	
				extrudeShape( tube3, fromPoint, toPoint );
	
			}
	
		}
		geometry.mergeVertices();
		geometry.computeVertexNormals(true);
		geometry.computeFaceNormals();
		return geometry;
	};
	module.exports = RollerCoasterLifters;
	},
	{"../routing":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/routing.js"}],	

"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/components/RollerCoasterGenerator.js":[function(require,module,exports){

	var destroyMesh = require('../utils/destroyMesh');
	var Curve1 = require("./Curve1");
	var Curve2 = require("./Curve2");
	var RollerCoaster = require("./RollerCoaster");
	var RollerCoasterShadow = require("./RollerCoasterShadow");
	var RollerCoasterLifters = require("./RollerCoasterLifters");
	
	var RollerCoasterGenerator = function ( poem, properties ) {
		
		properties = _.isObject( properties ) ? properties : {};
		this.poem = poem;
		this.object = null;

		_.extend( this, properties ) ;

		this.color1 = new THREE.Color(properties.color1) ? new THREE.Color(properties.color1) : new THREE.Color(0xffffff);
		this.color2 = new THREE.Color(properties.color2) ? new THREE.Color(properties.color2) : new THREE.Color(0xffff00);		
		this.rollerSpeed = properties.rollerSpeed ? properties.rollerSpeed : 0.0000015;
		this.minRollerSpeed = properties.minRollerSpeed ? properties.minRollerSpeed : 0.00004;
		this.varA = properties.varA ? properties.varA : 3;
		this.varB = properties.varB ? properties.varB : 17;
		this.varC = properties.varC ? properties.varC : 4;
		this.scalar = properties.scalar ? properties.scalar : 20;
		
		this.curve1 = Curve1(this.varA, this.varB, this.varC, this.scalar);
		this.curve2 = Curve2(this.varA, this.varB, this.varC, this.scalar);
		this.curve = properties.curve == "curve1" ? this.curve1 : this.curve2;	

		this.rollerShadow = RollerCoasterShadow(this.curve, 500 );
		this.material = new THREE.MeshBasicMaterial( { color: 0x000000, opacity: 0.1, depthWrite: false, transparent: true} );
		this.object = new THREE.Mesh( this.rollerShadow, this.material );
		this.object.position.y = 1;
		this.poem.scene.add( this.object );

		this.rollerLifter = RollerCoasterLifters( this.curve, 100 );
		this.material = new THREE.MeshPhongMaterial( { color: this.color1, specular: 0x020202, shininess: 300 } );
		this.object = new THREE.Mesh( this.rollerLifter, this.material );
		this.object.position.y = 1;
		this.poem.scene.add( this.object );	
		
		this.roller = RollerCoaster(this.curve, 1500, this.color1, this.color2);
		this.material = new THREE.MeshPhongMaterial( { specular: 0x030303, shininess: 300, vertexColors: THREE.VertexColors } );
		this.object = new THREE.Mesh( this.roller, this.material );
		this.poem.scene.add( this.object );

		this.poem.on( 'destroy', destroyMesh( this.object ) );
	};
	module.exports = RollerCoasterGenerator;

	},
	{"./Curve1":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/components/Curve1.js",
	"./Curve2":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/components/Curve2.js",
	"./RollerCoaster":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/components/RollerCoaster.js",
	"./RollerCoasterShadow":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/components/RollerCoasterShadow.js",
	"./RollerCoasterLifters":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/components/RollerCoasterLifters.js",
	"../utils/destroyMesh":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/utils/destroyMesh.js"}],	

"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/managers/TreeField.js":[function(require,module,exports){
	var Tree = require('../entities/Tree');
	
	var TreeField = function( poem, properties ) {
	
	this.poem = poem;
	this.trees = [];
	this.maxRadius = 15;
	this.maxHeight = 50;
	this.count = 2000;
	
	_.extend( this, properties ) ;
	
	this.generate( this.count );

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
	},
	{"../entities/Tree":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/entities/Tree.js"}],

"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/entities/Tree.js":[function(require,module,exports){
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
	},
	{"../utils/destroyMesh":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/utils/destroyMesh.js"}],

"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/components/Menu.js":[function(require,module,exports){
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
	},
	{"../routing":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/routing.js"}],

"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/components/scores.js":[function(require,module,exports){
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
	},
	{"../levels":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/levels/index.js",
	"../utils/EventDispatcher":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/utils/EventDispatcher.js",
	"localforage":"node_modules/localforage/src/localforage.js"}],

"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/entities/Bullet.js":[function(require,module,exports){
	var Bullet = function( poem, gun, vertex ) {
	this.poem = poem;
	this.gun = gun;
	this.vertex = vertex;
	
	this.speed = new THREE.Vector3(0,0,0);
	this.position = new THREE.Vector3(0,0,0);
	this.radius = 10;
	
	this.bornAt = 0;
	this.alive = false;
	};
	
	module.exports = Bullet;
	
	Bullet.prototype = {
	
	kill : function() {
		this.vertex.set(0, -10000 ,0);
		this.alive = false;
	},
	
	update : function( e ) {
		var x,y,z;
		
		this.position.x += this.speed.x;
		this.position.y += this.speed.y;
		this.position.z += this.speed.z;
		
		this.poem.coordinatesXYZ.setVector( this.vertex, this.position );
	},
	
	fire : function(xO, xD, yO, yD, zO, zD, r, speed) {

		this.position.set(xO, yO, zO);

		this.speed.x = ((xD-xO)/r)*speed;
		this.speed.y = ((yD-yO)/r)*speed;
		this.speed.z = ((zD-zO)/r)*speed;
		
		this.bornAt = this.poem.clock.time;
		this.alive = true;
		
	}
	};
	},
	{}],

"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/managers/Manager.js":[function(require,module,exports){
	var ColliderXYZObjects = require('../utils/ColliderXYZObjects');
	var DefaultBalloon = require('../entities/Balloons');
	var DefaultMinion = require('../entities/Minions');
	var DefaultCrow = require('../entities/Crows');
	var DefaultShark = require('../entities/Sharks');
	var DefaultSnowman = require('../entities/Snowman');
	var EventDispatcher = require('../utils/EventDispatcher');
	var Damage = require('../components/Damage');
	
	var Manager = function( poem, properties ) {
	
	this.poem = poem;
	this.entityType = DefaultMinion;
	this.count = 20;
	this.entities = [];
	this.liveEntities = [];
	this.shared = {};
	this.winCheck = null;
		
	_.extend( this, properties );

	this.damage = new Damage( this.poem, this.entityType.prototype.damageSettings );
	
	if( _.isFunction( this.entityType.prototype.initSharedAssets ) ) {
		this.entityType.prototype.initSharedAssets( this );
	}

	this.generate( this.count );
	this.configureCollider();
	
	this.boundUpdate = this.update.bind(this);
	
	this.poem.on('update', this.boundUpdate );
	};
	
	module.exports = Manager;
	
	Manager.prototype = {
	
	generate : function( count ) {
		
		var i, x, y, height, width, entity;

		if (this.shared.geometry.name == "crowGeo") {
			for( i=0; i < count; i++ ) {
				
				r = Math.random()*2500;
				theta = Math.random()*2*Math.PI;
	
				x = Math.cos(theta) * r;
				z = -2000;
				y = Math.random()*200 + 200;
	
				entity = new this.entityType( this.poem, this, x, y, z );
				entity.damage = this.damage;
				
				this.entities.push( entity );
				this.liveEntities.push( entity );
			}

		} else if (this.shared.geometry.name == "sharkGeo"){
			for( i=0; i < count; i++ ) {
				
				r = Math.random()*2500;
				theta = Math.random()*2*Math.PI;
	
				x = Math.cos(theta) * r;
				z = Math.sin(theta) * r;
				y = 2;
	
				entity = new this.entityType( this.poem, this, x, y, z );
				entity.damage = this.damage;
				
				this.entities.push( entity );
				this.liveEntities.push( entity );
			}

		} else if (this.shared.geometry.name == "snowmanGeo") {
			for( i=0; i < count; i++ ) {
				r = Math.random()*6000;
				theta = Math.random()*2*Math.PI;
	
				x = Math.cos(theta) * r;
				z = Math.sin(theta) * r;
				y = (0.5 - Math.random())*50;
	
				entity = new this.entityType( this.poem, this, x, y, z );
				entity.damage = this.damage;
				
				this.entities.push( entity );
				this.liveEntities.push( entity );
			}
		} else {
			for( i=0; i < count; i++ ) {
				r = Math.random()*2300;
				theta = Math.random()*2*Math.PI;
	
				x = Math.cos(theta) * r;
				z = Math.sin(theta) * r;
				y = (0.5 - Math.random())*50;
	
				entity = new this.entityType( this.poem, this, x, y, z );
				entity.damage = this.damage;
				
				this.entities.push( entity );
				this.liveEntities.push( entity );
			}
		}

		this.poem.scoringAndWinning.adjustEnemies( count );
		
	},
	
	add : function( x, y, theta ) {
		
		var entity = new this.entityType( this.poem, this, x, y, theta );
		
		entity.bank = theta;
		entity.update({
			dt: 0
		});
		
		this.entities.push( entity );
		this.liveEntities.push( entity );
		
		this.poem.scoringAndWinning.adjustEnemies( 1 );
		
	},
	
	update : function( e ) {
		
		this.dispatch( e );
		
		
	},
	
	killEntity : function( entity ) {
		
		var i = this.liveEntities.indexOf( entity );
		
		if( i >= 0 ) {
			this.liveEntities.splice( i, 1 );
		}
		
		entity.kill();
		
		if( this.winCheck && this.liveEntities.length === 0 ) {
			this.winCheck.reportConditionCompleted();
			this.winCheck = null;
		}
	},
	
	configureCollider : function() {
		new ColliderXYZObjects(
			
			this.poem,
			
			function() {
				return this.liveEntities;
			}.bind(this),
			
			function() {
				return this.poem.gun.liveBullets;
			}.bind(this),
			
			function(entity, bullet) {
				
				this.killEntity( entity );
				this.poem.gun.killBullet( bullet );
				
				var sign = (entity.scoreValue > 0) ? "+" : "";
				var color = (entity.scoreValue > 0) ? entity.cssColor : "#ff0000";
				
				if( entity.scoreValue !== 0 ) {
					
					this.poem.scoringAndWinning.adjustScore(
						entity.scoreValue,
						sign + entity.scoreValue + " " + entity.name, 
						{
							"color" : color
						}
					);
					
				}
				this.poem.scoringAndWinning.adjustEnemies( -1 );
				
			}.bind(this)
			
		);
	},
	
	watchForCompletion : function( winCheck, properties ) {
		this.winCheck = winCheck;
	}
	};
	
	EventDispatcher.prototype.apply( Manager.prototype );
	},
	{"../components/Damage":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/components/Damage.js",
	"../entities/Balloons":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/entities/Balloons.js",
	"../entities/Minions":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/entities/Minions.js",
	"../entities/Crows":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/entities/Crows.js",
	"../entities/Sharks":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/entities/Sharks.js",
	"../entities/Snowman":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/entities/Snowman.js",
	"../utils/ColliderXYZObjects":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/utils/ColliderXYZObjects.js",
	"../utils/EventDispatcher":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/utils/EventDispatcher.js"}],

"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/entities/Balloons.js":[function(require,module,exports){
	var Damage = require('../components/Damage');
	var random = require('../utils/random');
	var destroyMesh = require('../utils/destroyMesh');
	
	var Balloons = function( poem, manager, x, y, z ) {

	this.poem = poem;
	this.manager = manager;
	this.scene = poem.scene;
	this.object = null;

	this.name = "Balloon";
	this.color = new THREE.Color();
	this.cssColor = "#ffffff";
	this.scoreValue = 13;

	this.spawnPoint = new THREE.Vector3(x,y,z);
	this.position = new THREE.Vector3(x,y,z);
	
	this.dead = false;
	
	this.radius = 45;

	this.addObject();
	this.object.position.copy(this.position);

	this.handleUpdate = this.update.bind(this);
	this.manager.on('update', this.handleUpdate );
		
	};
	
	module.exports = Balloons;
	
	Balloons.prototype = {
	
	damageSettings : {
		color: new THREE.Color().setHSL(Math.random(),1.0,0.5)
	},
	
	initSharedAssets : function( manager ) {		
		var geometry = new THREE.SphereGeometry(35,32,32);
		geometry.name = "balloonGeo";
		manager.shared.geometry = geometry;
	},

	addObject : function() {
	
		var geometry, sprite;
	
		geometry = this.manager.shared.geometry;
		this.color.setHSL(Math.random(),1.0,0.5);

		this.object = new THREE.Mesh(
			geometry,
			new THREE.MeshBasicMaterial({
				alphaTest: 0.9,
				transparent: true,
				fog: false,
				color: this.color
			})
		);
		this.scene.add( this.object );
		this.poem.on( 'destroy', destroyMesh( this.object ) );
	},


	kill : function() {
		this.dead = true;
		this.object.visible = false;
		this.damage.explode( this.object.position );
	},

	reset : function() {
		this.position.copy( this.spawnPoint );	
	},

	update : function( e ) {
		
		if( this.dead ) {
		
			this.damage.update( e );
			
		} else {
			this.object.position.y += 0.3;
			this.object.position.z += 0.2;
		}
	}
	
	};
	},
	{"../components/Damage":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/components/Damage.js",
	"../utils/destroyMesh":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/utils/destroyMesh.js",
	"../utils/random":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/utils/random.js"}],

"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/entities/Minions.js":[function(require,module,exports){
	var Damage = require('../components/Damage');
	var random = require('../utils/random');
	var destroyMesh = require('../utils/destroyMesh');
	var color = 0xcb36ea;
	
	var Minions = function( poem, manager, x, y, z ) {

	this.poem = poem;
	this.manager = manager;
	this.scene = poem.scene;
	this.minion = poem.minion;
	this.rotation = 0.1*Math.random();

	this.name = "Minion";
	this.color = new THREE.Color();
	this.cssColor = "#CB36EA";
	this.scoreValue = 15;

	this.spawnPoint = new THREE.Vector3(x,y,z);
	this.position = new THREE.Vector3(x,y,z);

	this.dead = false;
	this.radius = 80;

	this.addObject();
	this.object.position.copy(this.position);
	this.handleUpdate = this.update.bind(this);
	this.manager.on('update', this.handleUpdate );
		
	};
	
	module.exports = Minions;
	
	Minions.prototype = {
	
	damageSettings : {
		color: 0xffff00
	},
	
	initSharedAssets : function( manager ) {
		var geometry = poem.minion.geometry;
		geometry.name = "minionGeo";		
		manager.shared.geometry = geometry;
	},

	addObject : function() {
		var geometry = this.manager.shared.geometry;

		this.object = new THREE.Mesh(geometry, poem.minion.material);
		this.object.scale.x=this.object.scale.y=this.object.scale.z= 5;
		poem.scene.add( this.object );
	},

	kill : function() {
		this.dead = true;
		this.object.visible = false;
		this.object.position.y += 60;
		this.damage.explode( this.object.position );
	},

	update : function( e ) {
		
		if( this.dead ) {
		
			this.damage.update( e );
			
		} else {
			this.object.position.y += 0.3;
			this.object.position.z += 0.2;
			this.object.rotation.y += this.rotation;
		}
	}
	
	};
	},
	{"../components/Damage":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/components/Damage.js",
	"../utils/destroyMesh":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/utils/destroyMesh.js",
	"../utils/random":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/utils/random.js"}],

"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/entities/Crows.js":[function(require,module,exports){
	var Damage = require('../components/Damage');
	var random = require('../utils/random');
	var destroyMesh = require('../utils/destroyMesh');
	
	var Crows = function( poem, manager, x, y, z ) {

	this.poem = poem;
	this.manager = manager;
	this.scene = poem.scene;
	this.crow = poem.crow;
	this.movementZ = Math.random()*4 + 1;

	this.name = "Crow";
	this.color = new THREE.Color();
	this.cssColor = "#000000";
	this.scoreValue = 15;

	this.spawnPoint = new THREE.Vector3(x,y,z);
	this.position = new THREE.Vector3(x,y,z);

	this.dead = false;
	this.radius = 35;

	this.addObject();
	this.object.position.copy(this.position);
	this.handleUpdate = this.update.bind(this);
	this.manager.on('update', this.handleUpdate );
		
	};
	
	module.exports = Crows;
	
	Crows.prototype = {
	
	damageSettings : {
		color: 0x000000
	},
	
	initSharedAssets : function( manager ) {
		var geometry = poem.crow.geometry;
		geometry.name = "crowGeo";		
		manager.shared.geometry = geometry;
	},

	addObject : function() {
		var geometry = this.manager.shared.geometry;

		this.object = new THREE.Mesh(geometry, poem.crow.material);
		this.object.scale.x=this.object.scale.y=this.object.scale.z= 10;
		poem.scene.add( this.object );
	},

	kill : function() {
		this.dead = true;
		this.object.visible = false;
		this.damage.explode( this.object.position );
	},

	update : function( e ) {
		
		if( this.dead ) {
		
			this.damage.update( e );
			
		} else {
			this.object.position.x += 0.01;
			this.object.position.z += this.movementZ;
		}
	}
	
	};
	},
	{"../components/Damage":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/components/Damage.js",
	"../utils/destroyMesh":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/utils/destroyMesh.js",
	"../utils/random":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/utils/random.js"}],

"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/entities/Sharks.js":[function(require,module,exports){
	var Damage = require('../components/Damage');
	var random = require('../utils/random');
	var destroyMesh = require('../utils/destroyMesh');
	
	var Sharks = function( poem, manager, x, y, z ) {

	this.poem = poem;
	this.manager = manager;
	this.scene = poem.scene;
	this.shark = poem.shark;
	this.theta = (Math.random()*0.5)*2*Math.PI;

	this.name = "Shark";
	this.cssColor = "#0000ff";
	this.scoreValue = 25;

	this.spawnPoint = new THREE.Vector3(x,y,z);
	this.position = new THREE.Vector3(x,y,z);

	this.dead = false;
	this.radius = 50;

	this.addObject();
	this.object.position.copy(this.position);

	this.handleUpdate = this.update.bind(this);
	this.manager.on('update', this.handleUpdate );
		
	};
	
	module.exports = Sharks;
	
	Sharks.prototype = {
	
	damageSettings : {
		color: 0x0000ff
	},
	
	initSharedAssets : function( manager ) {
		var geometry = poem.shark.geometry;
		geometry.name = "sharkGeo";		
		manager.shared.geometry = geometry;
	},

	addObject : function() {
		var geometry = this.manager.shared.geometry;
		this.object = new THREE.Mesh(geometry, poem.shark.material);
		this.object.scale.x=this.object.scale.y=this.object.scale.z= 15;
		poem.scene.add( this.object );
	},

	kill : function() {
		this.dead = true;
		this.object.visible = false;
		this.damage.explode( this.object.position );
	},

	update : function( e ) {
		
		if( this.dead ) {
		
			this.damage.update( e );
			
		} else {
			this.object.position.z += 5 * Math.cos((poem.clock.time/1000)*this.theta)/this.theta;
			this.object.position.x += 5 * Math.sin((poem.clock.time/1000)*this.theta)/this.theta;
			this.object.lookAt(poem.camera.object.position);
		}
	}
	
	};
	},
	{"../components/Damage":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/components/Damage.js",
	"../utils/destroyMesh":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/utils/destroyMesh.js",
	"../utils/random":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/utils/random.js"}],

"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/entities/Snowman.js":[function(require,module,exports){
	var Damage = require('../components/Damage');
	var random = require('../utils/random');
	var destroyMesh = require('../utils/destroyMesh');
	
	var Snowman = function( poem, manager, x, y, z ) {

	this.poem = poem;
	this.manager = manager;
	this.scene = poem.scene;
	this.snowman = poem.snowman;
	this.theta = (Math.random()*0.5)*2*Math.PI;

	this.name = "Snowman";
	this.color = new THREE.Color();
	this.scoreValue = 30;

	this.spawnPoint = new THREE.Vector3(x,y,z);
	this.position = new THREE.Vector3(x,y,z);

	this.dead = false;
	this.radius = 115;

	this.addObject();
	this.object.position.copy(this.position);

	this.handleUpdate = this.update.bind(this);
	this.manager.on('update', this.handleUpdate );
		
	};
	
	module.exports = Snowman;
	
	Snowman.prototype = {
	
	damageSettings : {
		color: 0x0f0f0f
	},
	
	initSharedAssets : function( manager ) {
		var geometry = poem.snowman.geometry;
		geometry.name = "snowmanGeo";		
		manager.shared.geometry = geometry;
	},

	addObject : function() {
		var geometry = this.manager.shared.geometry;
		this.object = new THREE.Mesh(geometry, poem.snowman.material);
		this.object.scale.z=0.4;
		this.object.scale.x=this.object.scale.y=1.2;
		this.object.rotation.x= Math.PI;
		poem.scene.add( this.object );
	},

	kill : function() {
		this.dead = true;
		this.object.visible = false;
		this.damage.explode( this.object.position );
	},

	update : function( e ) {
		
		if( this.dead ) {
		
			this.damage.update( e );
			
		} else {
			this.object.position.z += 5 * Math.cos((poem.clock.time/1000)*this.theta)/this.theta;
			this.object.position.x += 5 * Math.sin((poem.clock.time/1000)*this.theta)/this.theta;
			this.object.position.y += 0.75 + 20 * Math.sin((poem.clock.time/4000)*this.theta + 2000);
		}
	}
	
	};
	},
	{"../components/Damage":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/components/Damage.js",
	"../utils/destroyMesh":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/utils/destroyMesh.js",
	"../utils/random":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/utils/random.js"}],

"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/levelLoader.js":[function(require,module,exports){
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
	
	EventDispatcher.prototype.apply( levelLoader );
	
	module.exports = levelLoader;
	
	},
	{"./utils/EventDispatcher":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/utils/EventDispatcher.js"}],

"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/levels/index.js":[function(require,module,exports){
	module.exports = {
	menu : require("./menu"),
	level1 : require("./level1"),
	level2 : require("./level2"),
	level3 : require("./level3"),
	level4 : require("./level4"),
	};
	},
	{"./level2":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/levels/level2.js",
	"./level1":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/levels/level1.js",
	"./menu":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/levels/menu.js",
	"./level3":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/levels/level3.js",
	"./level4":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/levels/level4.js"}],

"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/levels/menu.js":[function(require,module,exports){
	var numberOfBalloons =20;

	module.exports = {
	maxScore : 13 * numberOfBalloons,
	config : {
		scoringAndWinning: {
			message: "Well, that was easy...",
			nextLevel: "level2",
			conditions: [
				{
					component: "manager",
					properties: null
				}
			]
		},
		skybox: {
			sky: "skyboxsun5deg"
		},
		isThisTitles: "yes"
	},
	objects : {
		menu : {
			object: require("../components/Menu"),
			properties: {}
		},
		treeField : {
			object: require("../managers/TreeField"),
			properties: {
				count : 200
			}
		},
		manager : {
			object: require("../managers/Manager"),
			properties: {
				entityType: require('../entities/Balloons'),
				count: numberOfBalloons
			}
		},
		rollercoastergenerator: {
			object: require("../components/RollerCoasterGenerator"),
			properties: {
				color1: 0xffffff,
				color2: 0xffff00,
				varA: 3,
				varB: 17,
				varC: 4, 
				scalar: 20,
				curve: "curve1"
			}
		},
		funfairs: {
			object: require("../components/Funfairs"),
			properties: {}
		},
		music : {
			object: require("../sound/Music"),
			properties: {
				url: "https://soundcloud.com/legendarryl/state-of-massachusetts",
				startTime: 15,
				volume: 1
			}
		}
	}
	};
	},
	{"../components/Menu":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/components/Menu.js",
	"../managers/TreeField":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/managers/TreeField.js",
	//
	"../managers/Manager":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/managers/Manager.js",
	"../entities/Balloons":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/entities/Balloons.js",
	"../entities/Minions":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/entities/Minions.js",
	//
	"../components/RollerCoasterGenerator":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/components/RollerCoasterGenerator.js",
	"../components/Funfairs":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/components/Funfairs.js",
	"../sound/Music":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/sound/Music.js"}],

"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/levels/level1.js":[function(require,module,exports){
	var numberOfBalloons = 30;
	
	module.exports = {
	name : "Theme Park",
	description : "Fun at the fair",
	order : 1,
	maxScore : 13 * numberOfBalloons,
	config : {
		scoringAndWinning: {
			message: "Well, that was sooo easy...",
			nextLevel: "level2",
			timerCount: 45,
			conditions: [
				{
					component: "manager",
					properties: null
				}
			]
		}
		,
		skybox: {
			sky: "skyboxsun25degtest"
		}
	},
	objects : {
		treeField : {
			object: require("../managers/TreeField"),
			properties: {
				count : 200
			}
		},
		manager : {
			object: require("../managers/Manager"),
			properties: {
				entityType: require('../entities/Balloons'),
				count: numberOfBalloons
			}
		},
		rollercoastergenerator: {
			object: require("../components/RollerCoasterGenerator"),
			properties: {
				color1: 0xffffff,
				color2: 0xffff00,
				rollerSpeed: 0.00001,
				minRollerSpeed: 0.00008,
				varA: 3,
				varB: 17,
				varC: 4,
				scalar: 20,
				curve: "curve1"
			}
		},
		funfairs: {
			object: require("../components/Funfairs"),
			properties: {}
		},
		music : {
			object: require("../sound/Music"),
			properties: {
				url: "https://soundcloud.com/bns-1/kid-cudi-cudderisback",
				startTime: 0,
				volume: 1
			}
		}
	}
	};
	},
	{"../entities/Balloons":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/entities/Balloons.js",
	"../managers/TreeField":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/managers/TreeField.js",
	"../managers/Manager":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/managers/Manager.js",
	"../components/RollerCoasterGenerator":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/components/RollerCoasterGenerator.js",
	"../components/Funfairs":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/components/Funfairs.js",
	"../sound/Music":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/sound/Music.js"}],

"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/levels/level2.js":[function(require,module,exports){
	var numberOfObjects = 60;
	
	module.exports = {
	name : "Dessert",
	description : "A murder of Crows",
	order : 2,
	maxScore : (numberOfObjects * 15)/2,
	config : {
		scoringAndWinning: {
			message: "Ready for this one?",
			nextLevel: "level3",
			timerCount: 40,
			conditions: [
				{
					component: "manager",
					properties: null
				}		
			]
		}
		,
		groundColor : 0x473500,
		groundWidthSegments: 70,
		groundHeightSegments: 10,
		skybox: {
			sky: "devilpunch"
		}
	},
	objects : {
		treeField : {
			object: require("../managers/TreeField"),
			properties: {
				count : 0
			}
		},
		manager : {
			object: require("../managers/Manager"),
			properties: {
				entityType: require('../entities/Crows'),
				count: numberOfObjects
			}
		},
		rollercoastergenerator: {
			object: require("../components/RollerCoasterGenerator"),
			properties: {
				color1: 0x51411a,
				color2: 0x812a2a,
				rollerSpeed: 0.000005,
				minRollerSpeed: 0.00009,
				varA: 5,
				varB: 27,
				varC: 2, 
				scalar: 60,
				curve: "curve1"
			}
		},
		music : {
			object: require("../sound/Music"),
			properties: {
				url: "https://soundcloud.com/flume/lorde-tennis-court-flume-remix",
				startTime: 90
			}
		}
	}
	};
	},
	{"../managers/TreeField":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/managers/TreeField.js",
	"../entities/Crows":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/entities/Crows.js",
	"../managers/Manager":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/managers/Manager.js",
	"../components/RollerCoasterGenerator":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/components/RollerCoasterGenerator.js",
	"../components/Funfairs":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/components/Funfairs.js",
	"../sound/Music":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/sound/Music.js"}],

"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/levels/level3.js":[function(require,module,exports){
	var numberOfSharks = 40;
	
	module.exports = {
	name : "Ocean",
	description : "Aim for the snout!",
	maxScore : (25 * numberOfSharks)*0.75,
	order: 3,
	config : {
		isOcean: "yes",
		isSnow: "no",
		groundColor : 0x294c48,
		scoringAndWinning: {
			message: "Have you ever been alone in the middle of nowhere...<br/>And surronded by enemies?<br/>",
			nextLevel: "level4",
			timerCount: 40,
			conditions: [
				{
					component: "manager",
					properties: null
				}
			]
		}
		,
		skybox: {
			sky: "emerald",
			width: 5800,
			depth: 5800, 
			height: 2800
		}
	},
	objects : {
		treeField : {
			object: require("../managers/TreeField"),
			properties: {
				count : 0
			}
		},
		manager : {
			object: require("../managers/Manager"),
			properties: {
				entityType: require('../entities/Sharks'),
				count: numberOfSharks
			}
		},
		rollercoastergenerator: {
			object: require("../components/RollerCoasterGenerator"),
			properties: {
				color1: 0x416fa0,
				color2: 0x31ffd5,
				rollerSpeed: 0.000013,
				minRollerSpeed: 0.00013,
				varA: 3,
				varB: 36,
				varC: 4,
				scalar: 20,
				curve: "curve1"
			}
		},
		music : {
			object: require("../sound/Music"),
			properties: {
				url: "https://soundcloud.com/edmtunestv/funxion-something-different",
				startTime: 42,
				volume: 1
			}
		}
	}
	};
	},
	{"../managers/TreeField":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/managers/TreeField.js",
	"../entities/Sharks":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/entities/Sharks.js",
	"../managers/Manager":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/managers/Manager.js",
	"../components/RollerCoasterGenerator":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/components/RollerCoasterGenerator.js",
	"../components/Funfairs":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/components/Funfairs.js",
	"../sound/Music":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/sound/Music.js"}],

"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/levels/level4.js":[function(require,module,exports){
	var numberOfSnowmen = 45;
	
	module.exports = {
	name : "Antarctica",
	description : "The living snowmen",
	maxScore : (30 * numberOfSnowmen)/1.5,
	order: 4,
	config : {
		isSnow: "yes",
		isOcean: "no",
		groundWidth : 10000,
		groundHeight: 10000,
		groundColor : 0xffffff,
		scoringAndWinning: {
			message: "You've made it!. Congrats!",
			nextLevel: "menu",
			timerCount: 85,
			conditions: [
				{
					component: "manager",
					properties: null
				}
			]
		}
		,
		skybox: {
			sky: "iceflow",
			width: 10800,
			depth: 10800, 
			height: 6500
		}
	},
	objects : {
		treeField : {
			object: require("../managers/TreeField"),
			properties: {
				count : 0
			}
		},
		manager : {
			object: require("../managers/Manager"),
			properties: {
				entityType: require('../entities/Snowman'),
				count: numberOfSnowmen
			}
		},
		rollercoastergenerator: {
			object: require("../components/RollerCoasterGenerator"),
			properties: {
				color1: 0x909090,
				color2: 0xffffff,
				rollerSpeed: 0.000006,
				minRollerSpeed: 0.00006,
				varA: 3,
				varB: 36,
				varC: 4,
				scalar: 70,
				curve: "curve2"
			}
		},
		music : {
			object: require("../sound/Music"),
			properties: {
				url: "https://soundcloud.com/ukf/the-prodigy-nasty-spor-remix",
				startTime: 1,
				volume: 1
			}
		}
	}
	};
	},
	{"../entities/Snowman":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/entities/Snowman.js",
	"../managers/TreeField":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/managers/TreeField.js",
	"../managers/Manager":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/managers/Manager.js",
	"../components/RollerCoasterGenerator":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/components/RollerCoasterGenerator.js",
	"../components/Funfairs":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/components/Funfairs.js",
	"../sound/Music":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/sound/Music.js"}],

"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/managers/Gun.js":[function(require,module,exports){
	var Bullet = require('../entities/Bullet');
	var ColliderXYZ = require('../utils/ColliderXYZ');
	var SoundGenerator = require('../sound/SoundGenerator');
	var destroyMesh = require('../utils/destroyMesh');
	
	var Gun = function( poem ) {
	this.poem = poem;
	this.object = null;
	this.sound = null;
	
	this.count = 350;
	this.bulletAge = 5000;
	this.fireDelayMilliseconds = 100;
	this.lastFireTimestamp = this.poem.clock.time;
	this.liveBullets = [];
	this.bullets = [];
	this.bornAt = 0;

	if (this.poem.slug == "level4") {
		this.bulletSize = 40;
		this.bulletColor = 0x000000;
	} else {
		this.bulletSize = 10;
		this.bulletColor = 0xff0000;
	}

	this.addObject();
	this.addSound();
	
	this.poem.on('update', this.update.bind(this) );
	};
	
	module.exports = Gun;
	
	Gun.prototype = {
	
	fire : function() {
		
		var isDead = function( bullet ) {
			return !bullet.alive;
		};
		
		return function(xO, xD, yO, yD, zO, zD, r, speed) {
			
			var now = this.poem.clock.time;
			
			if( now - this.lastFireTimestamp < this.fireDelayMilliseconds ) {
				return;
			}
			
			this.lastFireTimestamp = now;
		
			var bullet = _.find( this.bullets, isDead );
		
			if( !bullet ) return;
		
			this.liveBullets.push( bullet );
		
			bullet.fire(xO, xD, yO, yD, zO, zD, r, speed);


			var freq = 1900;
			
			//Start sound
			this.sound.setGain(0.1, 0, 0.001);
			this.sound.setFrequency(freq, 0, 0);
			

			//End sound
			this.sound.setGain(0, 0.01, 0.05);
			this.sound.setFrequency(freq * 0.1, 0.01, 0.05);
			
		};
	}(),
	
	generateGeometry : function() {
		
		var vertex, bullet;
		
		var geometry = new THREE.Geometry();
		
		for(var i=0; i < this.count; i++) {
			
			vertex = new THREE.Vector3();
			bullet = new Bullet( this.poem, this, vertex );
			
			geometry.vertices.push( vertex );
			this.bullets.push( bullet );
			
			bullet.kill();
					
		}
		
		return geometry;
	},
	
	killBullet : function( bullet ) {

		var i = this.liveBullets.indexOf( bullet );
		
		if( i >= 0 ) {
			this.liveBullets.splice( i, 1 );
		}
		
		bullet.kill();
		
		if( this.object ) this.object.geometry.verticesNeedUpdate = true;
		
	},
	
	addObject : function() {
		
		var geometry, sprite, lineMaterial;
		
		geometry = this.generateGeometry();
		sprite = THREE.ImageUtils.loadTexture( "./assets/images/disc.png" );
		
		this.object = new THREE.Points(
			geometry,
			new THREE.PointsMaterial({
				 size: this.bulletSize,
				 map: sprite,
				 alphaTest: 0.9,
				 transparent: true,
				 color: this.bulletColor
			}
		));
		this.object.frustumCulled = false;
		this.poem.scene.add( this.object ) ;
		this.poem.on('destroy', destroyMesh( this.object ) );
	},
	
	update : function( e )  {
		var bullet, time;

		for(var i=0; i<this.liveBullets.length; i++) {
			bullet = this.liveBullets[i];
			
			if(bullet.bornAt + this.bulletAge < e.time) {
				this.killBullet( bullet );
				i--;
				
			} else {
				bullet.update( e.dt );
			}
		}
		if(this.liveBullets.length > 0) {
			this.object.geometry.verticesNeedUpdate = true;
		}
		
	},
	
	setBarrierCollider : function( collection ) {
		
		//Collide bullets with funfairs
		new ColliderXYZ(
			
			this.poem,
			
			function() {
				return collection;
			}.bind(this),
			
			function() {
				return this.liveBullets;
			}.bind(this),
			
			function(barrier, bullet) {
				this.killBullet( bullet );
			}.bind(this)
			
		);
	},
	
	addSound : function() {
		
		var sound = this.sound = new SoundGenerator();
		
		sound.connectNodes([
			sound.makeOscillator( "square" ),
			sound.makeGain(),
			sound.getDestination()
		]);
		
		sound.setGain(0,0,0);
		sound.start();
		
	}
	};
	},
	{"../entities/Bullet":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/entities/Bullet.js",
	"../sound/SoundGenerator":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/sound/SoundGenerator.js",
	"../utils/ColliderXYZ":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/utils/ColliderXYZ.js",
	"../utils/destroyMesh":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/utils/destroyMesh.js"}],

"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/routing.js":[function(require,module,exports){
	var crossroads = require('crossroads');
	var hasher = require('hasher');
	var levelLoader = require('./levelLoader');
	
	var baseUrl = '/shooterCoaster';
	var defaultLevel = "menu";
	var currentLevel = "";
	
	var routing = {
	
	start : function( Poem, levels ) {
		
		levelLoader.init( Poem, levels );
		
		function parseHash( newHash, oldHash ){
			crossroads.parse( newHash );
		}
		
		crossroads.addRoute( '/',				routing.showMainTitles );
		crossroads.addRoute( 'level/{name}',	routing.loadUpALevel );
	
		crossroads.addRoute( /.*/, function reRouteToMainTitlesIfNoMatch() {
			hasher.replaceHash('');
		});
	
		hasher.initialized.add(parseHash); // parse initial hash
		hasher.changed.add(parseHash); //parse hash changes
		hasher.init(); //start listening for history change
		
	},
	
	showMainTitles : function() {

		_gaq.push( [ '_trackPageview', baseUrl ] );
	
		levelLoader.load( defaultLevel );		

	},

	loadUpALevel : function( levelName ) {

		_gaq.push( [ '_trackPageview', baseUrl+'/#level/'+levelName ] );
	
		var levelFound = levelLoader.load( levelName );
	
		if( !levelFound ) {
			levelLoader.load( defaultLevel );
		}
		
	},
	
	on : levelLoader.on.bind( levelLoader ),
	off : levelLoader.off.bind( levelLoader )
		
	};
	
	module.exports = routing;
	},
	{"./levelLoader":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/levelLoader.js",
	"crossroads":"node_modules/crossroads/dist/crossroads.js",
	"hasher":"node_modules/hasher/dist/js/hasher.js"}],

"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/sound/Music.js":[function(require,module,exports){
	var soundcloud = require('soundcloud-badge');
	var muter = require('./muter');
	
	var soundOff = false;
	
	var audio = null;
	var fetchAndPlaySong = null;
	var timesCalledSoundcloud = 0;
	
	var Music = function( poem, properties ) {
	
		fetchAndPlaySong = function() {
			
			var currentTime = ++timesCalledSoundcloud;
			
			soundcloud({
				
				client_id: '6057c9af862bf245d4c402179e317f52',
				song: properties.url,
				dark: false,
				getFonts: false
				
			}, function( err, src, data, div ) {
				
				//Nullify callbacks that are out of order
				if( currentTime !== timesCalledSoundcloud ) return;
				if( muter.muted ) return;
	
				if( err ) throw err;
	
				audio = new Audio();
				audio.src = src;
				audio.play();
				audio.loop = true;
				audio.volume = properties.volume || 0.6;
			
				$(audio).on('loadedmetadata', function() {
					if( audio )	audio.currentTime = properties.startTime || 0;
				});
			
	
			});
		
			poem.on('destroy', function() {
				
				if( audio ) {
					audio.pause();
					audio = null;
				}
				
				$('.npm-scb-white').remove();
				
			});
			
		};
		
		if( !muter.muted ) {
			
			fetchAndPlaySong();
			fetchAndPlaySong = null;
			
		}
		
	};
	
	Music.prototype.muted = false;
	
	muter.on('mute', function muteMusic( e ) {
	
		if( audio ) audio.pause();
		
		$('.npm-scb-white').hide();
	
	});
	
	muter.on('unmute', function unmuteMusic( e ) {

	if( audio ) audio.play();

	if( fetchAndPlaySong ) {
		fetchAndPlaySong();
		fetchAndPlaySong = null;
	}
	
	$('.npm-scb-white').show();
		
	
	});
	
	module.exports = Music;
	},
	{"./muter":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/sound/muter.js",
	"soundcloud-badge":"node_modules/soundcloud-badge/index.js"}],

"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/sound/SoundGenerator.js":[function(require,module,exports){
	var _ = require('underscore');
	var context = window.AudioContext || window.webkitAudioContext || null;
	var muter = require('./muter');
	
	var SoundGenerator = function() {
	
	this.enabled = context !== undefined;
	
	if(!this.enabled) return;
	
	this.lastGainValue = null;
	
	this.totalCreated++;
	this.totalCreatedSq = this.totalCreated * this.totalCreated;
	
	muter.on('mute', this.handleMute.bind(this));
	muter.on('unmute', this.handleUnMute.bind(this));
		
	};
	
	module.exports = SoundGenerator;
	
	SoundGenerator.prototype = {
	
	handleMute : function() {
		if( this.gain ) {
			this.gain.gain.value = 0;
		}
	},
	
	handleUnMute : function() {
		if( this.gain && _.isNumber( this.lastGainValue ) ) {
			this.gain.gain.value = this.lastGainValue;
		}
	},
	
	context : context ? new context() : undefined,
	
	makePinkNoise : function( bufferSize ) {
	
		var b0, b1, b2, b3, b4, b5, b6, node; 
		
		b0 = b1 = b2 = b3 = b4 = b5 = b6 = 0.0;
		node = this.pinkNoise = this.context.createScriptProcessor(bufferSize, 1, 1);
		
		node.onaudioprocess = function(e) {
			
			// http://noisehack.com/generate-noise-web-audio-api/
			var output = e.outputBuffer.getChannelData(0);
			
			for (var i = 0; i < bufferSize; i++) {
				var white = Math.random() * 2 - 1;
				b0 = 0.99886 * b0 + white * 0.0555179;
				b1 = 0.99332 * b1 + white * 0.0750759;
				b2 = 0.96900 * b2 + white * 0.1538520;
				b3 = 0.86650 * b3 + white * 0.3104856;
				b4 = 0.55000 * b4 + white * 0.5329522;
				b5 = -0.7616 * b5 - white * 0.0168980;
				output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
				output[i] *= 0.11; // (roughly) compensate for gain
				b6 = white * 0.115926;
			}
		};
		
		return node;
	
	},
	
	makeOscillator : function( type, frequency ) {
		/*
			enum OscillatorType {
			  "sine",
			  "square",
			  "sawtooth",
			  "triangle",
			  "custom"
			}
		*/
		
		var node = this.oscillator = this.context.createOscillator();
		
		node.type = type || "sawtooth";
		node.frequency.value = frequency || 2000;
		
		return node;
	},
	
	makeGain : function() {
		var node = this.gain = this.context.createGain();
		
		node.gain.value = 0;
		
		return node;
	},
	
	makePanner : function() {
		
		this.context.listener.setPosition(0, 0, 0);
		
		var node = this.panner = this.context.createPanner();
		
		node.panningModel = 'equalpower';
		node.coneOuterGain = 0.1;
		node.coneOuterAngle = 180;
		node.coneInnerAngle = 0;
		
		return node;
	},
	
	makeBandpass : function() {

		var node = this.bandpass = this.context.createBiquadFilter();
		
		node.type = "bandpass";
		node.frequency.value = 440;
		node.Q.value = 0.5;
		
		return node;

	},
	
	getDestination : function() {
		return this.context.destination;
	},
	
	connectNodes : function( nodes ) {
		_.each( _.rest( nodes ), function(node, i, list) {
			var prevNode = nodes[i];
			
			prevNode.connect( node );
		});
	},
	
	start : function() {
		this.oscillator.start(0);
	},
	
	totalCreated : 0,
	
	setFrequency : function ( frequency, delay, speed ) {
		if(!this.enabled) return;
		
		this.oscillator.frequency.setTargetAtTime(frequency, this.context.currentTime + delay, speed);
	},
	
	setPosition : function ( x, y, z ) {
		if(!this.enabled) return;
		this.panner.setPosition( x, y, z );
	},
	
	setGain : function ( gain, delay, speed ) {
		
		this.lastGainValue = gain;
		
		if( !this.enabled || muter.muted ) return;
		// Math.max( Math.abs( gain ), 1);
		// gain / this.totalCreatedSq;
				
		this.gain.gain.setTargetAtTime(
			gain,
			this.context.currentTime + delay,
			speed
		);
	},
	
	setBandpassQ : function ( Q ) {
		if(!this.enabled) return;
		this.bandpass.Q.setTargetAtTime(Q, this.context.currentTime, 0.1);
	},
	
	setBandpassFrequency : function ( frequency ) {
		if(!this.enabled) return;
		this.bandpass.frequency.setTargetAtTime(frequency, this.context.currentTime, 0.1);
	}
	};
	},
	{"./muter":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/sound/muter.js",
	"underscore":"node_modules/underscore/underscore.js"}],

"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/sound/muter.js":[function(require,module,exports){
	var EventDispatcher = require('../utils/EventDispatcher');
	var localforage = require('localforage');
	var muter;
	
	var Muter = function() {
	
	this.muted = true;
	
	localforage.getItem('muted', function( err, value ) {

		if( err || value === null ) {
			this.muted = false;
		} else {
			this.muted = value;
		}
		
		this.dispatchChanged();
		
	}.bind(this));
		
	};
	
	Muter.prototype = {
	
	mute : function() {
		this.muted = true;
		this.dispatchChanged();
		this.save();
	},
	
	unmute : function() {
		this.muted = false;
		this.dispatchChanged();
		this.save();
	},
	
	save : function() {
		localforage.setItem( 'muted', this.muted );
	},
	
	dispatchChanged : function() {
		
		if( this.muted ) {
			muter.dispatch({
				type: 'mute'
			});
			
		} else {
			muter.dispatch({
				type: 'unmute'
			});
		}
	}
		
	};
	
	EventDispatcher.prototype.apply( Muter.prototype );
	
	muter = new Muter();
	
	$(window).on('keydown', function muteAudioOnHittingS( e ) {
	
	if( e.keyCode !== 83 ) return;
	
	if( muter.muted ) {
		muter.unmute();
	} else {
		muter.mute();
	}
		
	});
	
	module.exports = muter;
	
	},
	{"../utils/EventDispatcher":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/utils/EventDispatcher.js",
	"localforage":"node_modules/localforage/src/localforage.js"}],

"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/ui/index.js":[function(require,module,exports){
	var menu = require('./menu');
	var mute = require('./mute');
	var menuLevels = require('./menuLevels');
	
	jQuery(function($) {
		
		menu.setHandlers();
		mute.setHandlers();
		
	});
	},
	{"./menu":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/ui/menu.js",
	"./menuLevels":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/ui/menuLevels.js",
	"./mute":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/ui/mute.js"}],

"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/ui/menu.js":[function(require,module,exports){
	var	EventDispatcher	= require('../utils/EventDispatcher');
	var	routing			= require('../routing');
	var	scores			= require('../components/scores');
	
	var poem;
	var isOpen = false;
	var $body;
	
	routing.on( 'newLevel', function( e ) {

	poem = e.poem;
		
	});
	
	
	var menu = {
	
	setHandlers : function() {
		
		$body = $('body');
		
		$('#menu a, #container-blocker').click( menu.close );
		
		$('#menu-button').off().click( this.toggle );
		$('#menu-reset-score').off().click( this.resetScores );
		
		routing.on( 'newLevel', menu.close );
		
		$(window).on('keydown', function toggleMenuHandler( e ) {
	
			if( e.keyCode !== 27 ) return;
			menu.toggle(e);
	
		});
		
		
	},
	
	resetScores : function(e) {
		
		e.preventDefault();
		
		if( confirm( "Are you sure you want to reset your scores?" ) ) {
			scores.reset();
		}
		
	},
	
	toggle : function( e ) {

		e.preventDefault();
		
		if( isOpen ) {
			menu.close();
		} else {
			menu.open();
		}
		
		isOpen = !isOpen;
		
	},
	
	close : function() {
		$body.removeClass('menu-open');
		if( poem ) poem.start();
	},
	
	open : function() {
		$body.addClass('menu-open');
		if( poem ) poem.pause();
	}
		
	};
	
	EventDispatcher.prototype.apply( menu );
	module.exports = menu;
	},
	{"../components/scores":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/components/scores.js",
	"../routing":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/routing.js",
	"../utils/EventDispatcher":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/utils/EventDispatcher.js"}],

"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/ui/menuLevels.js":[function(require,module,exports){
	var scores = require('../components/scores');
	var levelKeyPairs = (function sortAndFilterLevels( levels ) {
		
	return _.chain(levels)
		.pairs()
		.filter(function( keypair ) {
			return keypair[1].order;
		})
		.sortBy(function( keypair ) {
			return keypair[1].order;
		})
	.value();
		
	})( require('../levels') );
	
	function reactiveLevels( $scope, template ) {
	
	$scope.children().remove();
	
	var templateData = _.map( levelKeyPairs, function( keypair ) {
		
		var slug = keypair[0];
		var level = keypair[1];
		
		var score = scores.get( slug );
		return {
			name : level.name,
			description : level.description,
			slug : slug,
			percent : score ? score.percent : 0,
			score : score ? score.value : 0,
			total : score ? score.total : 1,
			leftOrRight : score && score.unitI < 0.5 ? "right" : "left"
		};
		
	});
	
	$scope.append( _.reduce( templateData, function( memo, text) {
		
		return memo + template( text );
		
	}, "") );
	}
	
	(function init() {
	
	var template = _.template( $('#menu-level-template').text() );
	var $scope = $('#menu-levels');

	function updateReactiveLevels() {
		reactiveLevels( $scope, template );
		
	}
	scores.on( 'change', updateReactiveLevels );
	updateReactiveLevels();
		
	})();
	
	},
	{"../components/scores":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/components/scores.js",
	"../levels":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/levels/index.js"}],

"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/ui/mute.js":[function(require,module,exports){
	var muter = require('../sound/muter');
	
	var mutedSrc = 'assets/images/sound-mute.png';
	var unMutedSrc = 'assets/images/sound-unmute.png';
	var mutedSrcHover = 'assets/images/sound-mute-hover.png';
	var unMutedSrcHover = 'assets/images/sound-unmute-hover.png';
	
	new Image().src = mutedSrc;
	new Image().src = unMutedSrc;
	new Image().src = mutedSrcHover;
	new Image().src = unMutedSrcHover;
	
	
	var $mute;
	var $img;
	
	module.exports = {
	
	setHandlers : function() {
		
		$mute = $('#mute');
		$img = $mute.find('img');
		
		muter.on('mute', function() {
			$img.attr( 'src', mutedSrc );
		});
		
		muter.on('unmute', function() {
			$img.attr( 'src', unMutedSrc );
		});
		
		$img.attr( 'src', muter.muted ? mutedSrc : unMutedSrc );
		
		$mute.off().click( function( e ) {
			
			e.preventDefault();
		
			if( muter.muted ) {
			
				$img.attr('src', unMutedSrcHover);
				muter.unmute();
			
			} else {
			
				$img.attr('src', mutedSrcHover);
				muter.mute();
			
			}
			e.stopImmediatePropagation();
		
		});

		$mute.on('mouseover', function( e ) {
			
			e.preventDefault();
		
			if( muter.muted ) {
				$img.attr('src', mutedSrcHover);
			} else {
				$img.attr('src', unMutedSrcHover);
			}
		
		});
		
		$mute.on('mouseout', function( e ) {
			
			if( muter.muted ) {
				$img.attr('src', mutedSrc);
			} else {
				$img.attr('src', unMutedSrc);
			}		
		});
		
	}
		
	};
	},
	{"../sound/muter":"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/sound/muter.js"}],

"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/utils/Clock.js":[function(require,module,exports){
	var Clock = function( autostart ) {

	this.maxDt = 60;
	this.minDt = 16;
	this.pTime = 0;
	this.time = 0;
	
	if(autostart !== false) {
		this.start();
	}
		
	};
	
	module.exports = Clock;
	
	Clock.prototype = {

	start : function() {
		this.pTime = Date.now();
	},
	
	getDelta : function() {
		var now, dt;
		
		now = Date.now();
		dt = now - this.pTime;
		
		dt = Math.min( dt, this.maxDt );
		dt = Math.max( dt, this.minDt );
		
		this.time += dt;
		this.pTime = now;
		
		return dt;
	}
		
	};
	},
	{}],

"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/utils/ColliderXYZ.js":[function(require,module,exports){
	var _ = require('underscore');
	
	var ColliderXYZ = function( poem, getCollectionA, getCollectionB, onCollision ) {
	
	this.poem = poem;
	
	this.getCollectionA = getCollectionA;
	this.getCollectionB = getCollectionB;
	this.onCollision = onCollision;
	this.poem.on('update', this.update.bind(this) );
	};
	
	module.exports = ColliderXYZ;
	
	ColliderXYZ.prototype = {
	
	update : function( e ) {

		var collisions = [];

		_.each( this.getCollectionA(), function( itemFromA ) {
			
			var collidedItemFromB = _.find( this.getCollectionB(), function( itemFromB ) {
				
				
				var dx, dy, dz, distance;

				dx = itemFromA.position.x - itemFromB.position.x;
				dy = itemFromA.position.y - itemFromB.position.y;
				dz = itemFromA.position.z - itemFromB.position.z;
			
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
	},
	{"underscore":"node_modules/underscore/underscore.js"}],	

"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/utils/ColliderXYZObjects.js":[function(require,module,exports){
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
	},
	{"underscore":"node_modules/underscore/underscore.js"}],	

"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/utils/CoordinatesXYZ.js":[function(require,module,exports){
	
	var CoordinatesXYZ = function( poem ) {
	this.poem = poem;
	};
	
	module.exports = CoordinatesXYZ;
	
	CoordinatesXYZ.prototype = {
	
	x : function( x ) {
		return x;
	},
	
	y : function( y ) {
		return y;
	},
	
	z : function( z ) {
		return z;
	},
	
	r : function(x, y, z) {
		return Math.sqrt(x*x + y*y + z*z);
	},
	
	theta : function(x, z) {
		return Math.atan( z / x );
	},
	
	setVector : function( vector ) {
		
		var x, y, z, vector2;
		
		if( typeof arguments[1] === "number" ) {
			
			x = arguments[1];
			y = arguments[2];
			z = arguments[3];
			
			return vector.set(
				this.x(x),
				this.y(y),
				this.z(z)
			);
			
		} else {
			
			vector2 = arguments[1];
			
			return vector.set(
				this.x(vector2.x),
				this.y(vector2.y),
				this.z(vector2.z)
			);
		}
		
	},
	
	getVector : function( x, y, z ) {
		
		var vector = new THREE.Vector3();
		return this.setVector( vector, x, y, z );
		
	}
		
	};
	
	},
	{}],

"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/utils/EventDispatcher.js":[function(require,module,exports){
	/**
 * @author mrdoob / http://mrdoob.com/
 *
 * Modifications: Greg Tatum
 *
 * usage:
 * 
 * 		EventDispatcher.prototype.apply( MyObject.prototype );
 * 
 * 		MyObject.dispatch({
 * 			type: "click",
 * 			datum1: "foo",
 * 			datum2: "bar"
 * 		});
 * 
 * 		MyObject.on( "click", function( event ) {
 * 			event.datum1; //Foo
 * 			event.target; //MyObject
 * 		});
 * 
 *
 */
	
	var EventDispatcher = function () {};
	
	EventDispatcher.prototype = {

	constructor: EventDispatcher,

	apply: function ( object ) {

		object.on					= EventDispatcher.prototype.on;
		object.hasEventListener		= EventDispatcher.prototype.hasEventListener;
		object.off					= EventDispatcher.prototype.off;
		object.dispatch				= EventDispatcher.prototype.dispatch;

	},

	on: function ( type, listener ) {

		if ( this._listeners === undefined ) this._listeners = {};

		var listeners = this._listeners;

		if ( listeners[ type ] === undefined ) {

			listeners[ type ] = [];

		}

		if ( listeners[ type ].indexOf( listener ) === - 1 ) {

			listeners[ type ].push( listener );

		}

	},

	hasEventListener: function ( type, listener ) {

		if ( this._listeners === undefined ) return false;

		var listeners = this._listeners;

		if ( listeners[ type ] !== undefined && listeners[ type ].indexOf( listener ) !== - 1 ) {

			return true;

		}

		return false;

	},

	off: function ( type, listener ) {

		if ( this._listeners === undefined ) return;

		var listeners = this._listeners;
		var listenerArray = listeners[ type ];

		if ( listenerArray !== undefined ) {

			var index = listenerArray.indexOf( listener );

			if ( index !== - 1 ) {

				listenerArray.splice( index, 1 );

			}

		}

	},

	dispatch: function ( event ) {
			
		if ( this._listeners === undefined ) return;

		var listeners = this._listeners;
		var listenerArray = listeners[ event.type ];

		if ( listenerArray !== undefined ) {

			event.target = this;

			var array = [];
			var length = listenerArray.length;
			var i;

			for ( i = 0; i < length; i ++ ) {

				array[ i ] = listenerArray[ i ];

			}

			for ( i = 0; i < length; i ++ ) {

				array[ i ].call( this, event );

			}

		}

	}
	
	};
	
	if ( typeof module === 'object' ) {

	module.exports = EventDispatcher;
	
	}
	},
	{}],

"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/utils/Stats.js":[function(require,module,exports){
	/**
 * @author mrdoob / http://mrdoob.com/
 */
	
	var Stats = function () {

	var startTime = Date.now(), prevTime = startTime;
	var ms = 0, msMin = Infinity, msMax = 0;
	var fps = 0, fpsMin = Infinity, fpsMax = 0;
	var frames = 0, mode = 0;

	var container = document.createElement( 'div' );
	container.id = 'stats';
	container.addEventListener( 'mousedown', function ( event ) { event.preventDefault(); setMode( ++ mode % 2 ); }, false );
	container.style.cssText = 'width:80px;opacity:0.9;cursor:pointer';

	var fpsDiv = document.createElement( 'div' );
	fpsDiv.id = 'fps';
	fpsDiv.style.cssText = 'padding:0 0 3px 3px;text-align:left;background-color:#002';
	container.appendChild( fpsDiv );

	var fpsText = document.createElement( 'div' );
	fpsText.id = 'fpsText';
	fpsText.style.cssText = 'color:#0ff;font-family:Helvetica,Arial,sans-serif;font-size:9px;font-weight:bold;line-height:15px';
	fpsText.innerHTML = 'FPS';
	fpsDiv.appendChild( fpsText );

	var fpsGraph = document.createElement( 'div' );
	fpsGraph.id = 'fpsGraph';
	fpsGraph.style.cssText = 'position:relative;width:74px;height:30px;background-color:#0ff';
	fpsDiv.appendChild( fpsGraph );

	while ( fpsGraph.children.length < 74 ) {

		var bar = document.createElement( 'span' );
		bar.style.cssText = 'width:1px;height:30px;float:left;background-color:#113';
		fpsGraph.appendChild( bar );

	}

	var msDiv = document.createElement( 'div' );
	msDiv.id = 'ms';
	msDiv.style.cssText = 'padding:0 0 3px 3px;text-align:left;background-color:#020;display:none';
	container.appendChild( msDiv );

	var msText = document.createElement( 'div' );
	msText.id = 'msText';
	msText.style.cssText = 'color:#0f0;font-family:Helvetica,Arial,sans-serif;font-size:9px;font-weight:bold;line-height:15px';
	msText.innerHTML = 'MS';
	msDiv.appendChild( msText );

	var msGraph = document.createElement( 'div' );
	msGraph.id = 'msGraph';
	msGraph.style.cssText = 'position:relative;width:74px;height:30px;background-color:#0f0';
	msDiv.appendChild( msGraph );

	while ( msGraph.children.length < 74 ) {

		var bar2 = document.createElement( 'span' );
		bar2.style.cssText = 'width:1px;height:30px;float:left;background-color:#131';
		msGraph.appendChild( bar2 );

	}

	var setMode = function ( value ) {

		mode = value;

		switch ( mode ) {

			case 0:
				fpsDiv.style.display = 'block';
				msDiv.style.display = 'none';
				break;
			case 1:
				fpsDiv.style.display = 'none';
				msDiv.style.display = 'block';
				break;
		}

	};

	var updateGraph = function ( dom, value ) {

		var child = dom.appendChild( dom.firstChild );
		child.style.height = value + 'px';

	};

	return {

		REVISION: 12,

		domElement: container,

		setMode: setMode,

		begin: function () {

			startTime = Date.now();

		},

		end: function () {

			var time = Date.now();

			ms = time - startTime;
			msMin = Math.min( msMin, ms );
			msMax = Math.max( msMax, ms );

			msText.textContent = ms + ' MS (' + msMin + '-' + msMax + ')';
			updateGraph( msGraph, Math.min( 30, 30 - ( ms / 200 ) * 30 ) );

			frames ++;

			if ( time > prevTime + 1000 ) {

				fps = Math.round( ( frames * 1000 ) / ( time - prevTime ) );
				fpsMin = Math.min( fpsMin, fps );
				fpsMax = Math.max( fpsMax, fps );

				fpsText.textContent = fps + ' FPS (' + fpsMin + '-' + fpsMax + ')';
				updateGraph( fpsGraph, Math.min( 30, 30 - ( fps / 100 ) * 30 ) );

				prevTime = time;
				frames = 0;

			}

			return time;

		},

		update: function () {

			startTime = this.end();

		}

	};
	
	};
	
	if ( typeof module === 'object' ) {

	module.exports = Stats;
	
	}
	},
	{}],

"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/utils/destroyMesh.js":[function(require,module,exports){
	module.exports = function destroyMesh( obj ) {
	return function() {
		if( obj.geometry ) obj.geometry.dispose();
		if( obj.material ) obj.material.dispose();
	};
	};
	},
	{}],

"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/utils/random.js":[function(require,module,exports){
	var random = {
	
	flip : function() {
		return Math.random() > 0.5 ? true: false;
	},
	
	range : function(min, max) {
		return Math.random() * (max - min) + min;
	},
	
	rangeInt : function(min, max) {
		return Math.floor( this.range(min, max + 1) );
	},
	
	rangeLow : function(min, max) {
		//More likely to return a low value
	  return Math.random() * Math.random() * (max - min) + min;
	},
	
	rangeHigh : function(min, max) {
		//More likely to return a high value
		return (1 - Math.random() * Math.random()) * (max - min) + min;
	}
		 
	};
	
	module.exports = random;
	
	},
	{}],

"/Users/abely_000/Documents/Programacion/Threejs/shooterCoaster/js/utils/selectors.js":[function(require,module,exports){
	var selectors = function( scopeOrSelector, selectors, allowEmptySelections ) {
	
	var $scope = $( scopeOrSelector );
	
	return _.reduce( selectors, function( memo, selector, key ) {
		
		memo[key] = $( selector, $scope );
		
		if( !allowEmptySelections ) {
			if( memo[key].length === 0 ) {
				throw new Error("Empty selections are not allowed");
			}
		}
		
		return memo;
		
	}, { "scope" : $scope } );
		
	};
	
	module.exports = selectors;
	
	},
	{}],

// NODE MODULES

	"node_modules/crossroads/dist/crossroads.js":[function(require,module,exports){
		/** @license
		* crossroads <http://millermedeiros.github.com/crossroads.js/>
		* Author: Miller Medeiros | MIT License
		* v0.12.0 (2013/01/21 13:47)
		*/
		
		(function () {
		var factory = function (signals) {

		var crossroads,
		    _hasOptionalGroupBug,
		    UNDEF;

		// Helpers -----------
		//====================

		// IE 7-8 capture optional groups as empty strings while other browsers
		// capture as `undefined`
		_hasOptionalGroupBug = (/t(.+)?/).exec('t')[1] === '';

		function arrayIndexOf(arr, val) {
		    if (arr.indexOf) {
		        return arr.indexOf(val);
		    } else {
		        //Array.indexOf doesn't work on IE 6-7
		        var n = arr.length;
		        while (n--) {
		            if (arr[n] === val) {
		                return n;
		            }
		        }
		        return -1;
		    }
		}

		function arrayRemove(arr, item) {
		    var i = arrayIndexOf(arr, item);
		    if (i !== -1) {
		        arr.splice(i, 1);
		    }
		}

		function isKind(val, kind) {
		    return '[object '+ kind +']' === Object.prototype.toString.call(val);
		}

		function isRegExp(val) {
		    return isKind(val, 'RegExp');
		}

		function isArray(val) {
		    return isKind(val, 'Array');
		}

		function isFunction(val) {
		    return typeof val === 'function';
		}

		//borrowed from AMD-utils
		function typecastValue(val) {
		    var r;
		    if (val === null || val === 'null') {
		        r = null;
		    } else if (val === 'true') {
		        r = true;
		    } else if (val === 'false') {
		        r = false;
		    } else if (val === UNDEF || val === 'undefined') {
		        r = UNDEF;
		    } else if (val === '' || isNaN(val)) {
		        //isNaN('') returns false
		        r = val;
		    } else {
		        //parseFloat(null || '') returns NaN
		        r = parseFloat(val);
		    }
		    return r;
		}

		function typecastArrayValues(values) {
		    var n = values.length,
		        result = [];
		    while (n--) {
		        result[n] = typecastValue(values[n]);
		    }
		    return result;
		}

		//borrowed from AMD-Utils
		function decodeQueryString(str, shouldTypecast) {
		    var queryArr = (str || '').replace('?', '').split('&'),
		        n = queryArr.length,
		        obj = {},
		        item, val;
		    while (n--) {
		        item = queryArr[n].split('=');
		        val = shouldTypecast ? typecastValue(item[1]) : item[1];
		        obj[item[0]] = (typeof val === 'string')? decodeURIComponent(val) : val;
		    }
		    return obj;
		}


		// Crossroads --------
		//====================

		/**
		 * @constructor
		 */
		function Crossroads() {
		    this.bypassed = new signals.Signal();
		    this.routed = new signals.Signal();
		    this._routes = [];
		    this._prevRoutes = [];
		    this._piped = [];
		    this.resetState();
		}

		Crossroads.prototype = {

		    greedy : false,

		    greedyEnabled : true,

		    ignoreCase : true,

		    ignoreState : false,

		    shouldTypecast : false,

		    normalizeFn : null,

		    resetState : function(){
		        this._prevRoutes.length = 0;
		        this._prevMatchedRequest = null;
		        this._prevBypassedRequest = null;
		    },

		    create : function () {
		        return new Crossroads();
		    },

		    addRoute : function (pattern, callback, priority) {
		        var route = new Route(pattern, callback, priority, this);
		        this._sortedInsert(route);
		        return route;
		    },

		    removeRoute : function (route) {
		        arrayRemove(this._routes, route);
		        route._destroy();
		    },

		    removeAllRoutes : function () {
		        var n = this.getNumRoutes();
		        while (n--) {
		            this._routes[n]._destroy();
		        }
		        this._routes.length = 0;
		    },

		    parse : function (request, defaultArgs) {
		        request = request || '';
		        defaultArgs = defaultArgs || [];

		        // should only care about different requests if ignoreState isn't true
		        if ( !this.ignoreState &&
		            (request === this._prevMatchedRequest ||
		             request === this._prevBypassedRequest) ) {
		            return;
		        }

		        var routes = this._getMatchedRoutes(request),
		            i = 0,
		            n = routes.length,
		            cur;

		        if (n) {
		            this._prevMatchedRequest = request;

		            this._notifyPrevRoutes(routes, request);
		            this._prevRoutes = routes;
		            //should be incremental loop, execute routes in order
		            while (i < n) {
		                cur = routes[i];
		                cur.route.matched.dispatch.apply(cur.route.matched, defaultArgs.concat(cur.params));
		                cur.isFirst = !i;
		                this.routed.dispatch.apply(this.routed, defaultArgs.concat([request, cur]));
		                i += 1;
		            }
		        } else {
		            this._prevBypassedRequest = request;
		            this.bypassed.dispatch.apply(this.bypassed, defaultArgs.concat([request]));
		        }

		        this._pipeParse(request, defaultArgs);
		    },

		    _notifyPrevRoutes : function(matchedRoutes, request) {
		        var i = 0, prev;
		        while (prev = this._prevRoutes[i++]) {
		            //check if switched exist since route may be disposed
		            if(prev.route.switched && this._didSwitch(prev.route, matchedRoutes)) {
		                prev.route.switched.dispatch(request);
		            }
		        }
		    },

		    _didSwitch : function (route, matchedRoutes){
		        var matched,
		            i = 0;
		        while (matched = matchedRoutes[i++]) {
		            // only dispatch switched if it is going to a different route
		            if (matched.route === route) {
		                return false;
		            }
		        }
		        return true;
		    },

		    _pipeParse : function(request, defaultArgs) {
		        var i = 0, route;
		        while (route = this._piped[i++]) {
		            route.parse(request, defaultArgs);
		        }
		    },

		    getNumRoutes : function () {
		        return this._routes.length;
		    },

		    _sortedInsert : function (route) {
		        //simplified insertion sort
		        var routes = this._routes,
		            n = routes.length;
		        do { --n; } while (routes[n] && route._priority <= routes[n]._priority);
		        routes.splice(n+1, 0, route);
		    },

		    _getMatchedRoutes : function (request) {
		        var res = [],
		            routes = this._routes,
		            n = routes.length,
		            route;
		        //should be decrement loop since higher priorities are added at the end of array
		        while (route = routes[--n]) {
		            if ((!res.length || this.greedy || route.greedy) && route.match(request)) {
		                res.push({
		                    route : route,
		                    params : route._getParamsArray(request)
		                });
		            }
		            if (!this.greedyEnabled && res.length) {
		                break;
		            }
		        }
		        return res;
		    },

		    pipe : function (otherRouter) {
		        this._piped.push(otherRouter);
		    },

		    unpipe : function (otherRouter) {
		        arrayRemove(this._piped, otherRouter);
		    },

		    toString : function () {
		        return '[crossroads numRoutes:'+ this.getNumRoutes() +']';
		    }
		};

		//"static" instance
		crossroads = new Crossroads();
		crossroads.VERSION = '0.12.0';

		crossroads.NORM_AS_ARRAY = function (req, vals) {
		    return [vals.vals_];
		};

		crossroads.NORM_AS_OBJECT = function (req, vals) {
		    return [vals];
		};


		// Route --------------
		//=====================

		/**
		 * @constructor
		 */
		function Route(pattern, callback, priority, router) {
		    var isRegexPattern = isRegExp(pattern),
		        patternLexer = router.patternLexer;
		    this._router = router;
		    this._pattern = pattern;
		    this._paramsIds = isRegexPattern? null : patternLexer.getParamIds(pattern);
		    this._optionalParamsIds = isRegexPattern? null : patternLexer.getOptionalParamsIds(pattern);
		    this._matchRegexp = isRegexPattern? pattern : patternLexer.compilePattern(pattern, router.ignoreCase);
		    this.matched = new signals.Signal();
		    this.switched = new signals.Signal();
		    if (callback) {
		        this.matched.add(callback);
		    }
		    this._priority = priority || 0;
		}

		Route.prototype = {

		    greedy : false,

		    rules : void(0),

		    match : function (request) {
		        request = request || '';
		        return this._matchRegexp.test(request) && this._validateParams(request); //validate params even if regexp because of `request_` rule.
		    },

		    _validateParams : function (request) {
		        var rules = this.rules,
		            values = this._getParamsObject(request),
		            key;
		        for (key in rules) {
		            // normalize_ isn't a validation rule... (#39)
		            if(key !== 'normalize_' && rules.hasOwnProperty(key) && ! this._isValidParam(request, key, values)){
		                return false;
		            }
		        }
		        return true;
		    },

		    _isValidParam : function (request, prop, values) {
		        var validationRule = this.rules[prop],
		            val = values[prop],
		            isValid = false,
		            isQuery = (prop.indexOf('?') === 0);

		        if (val == null && this._optionalParamsIds && arrayIndexOf(this._optionalParamsIds, prop) !== -1) {
		            isValid = true;
		        }
		        else if (isRegExp(validationRule)) {
		            if (isQuery) {
		                val = values[prop +'_']; //use raw string
		            }
		            isValid = validationRule.test(val);
		        }
		        else if (isArray(validationRule)) {
		            if (isQuery) {
		                val = values[prop +'_']; //use raw string
		            }
		            isValid = this._isValidArrayRule(validationRule, val);
		        }
		        else if (isFunction(validationRule)) {
		            isValid = validationRule(val, request, values);
		        }

		        return isValid; //fail silently if validationRule is from an unsupported type
		    },

		    _isValidArrayRule : function (arr, val) {
		        if (! this._router.ignoreCase) {
		            return arrayIndexOf(arr, val) !== -1;
		        }

		        if (typeof val === 'string') {
		            val = val.toLowerCase();
		        }

		        var n = arr.length,
		            item,
		            compareVal;

		        while (n--) {
		            item = arr[n];
		            compareVal = (typeof item === 'string')? item.toLowerCase() : item;
		            if (compareVal === val) {
		                return true;
		            }
		        }
		        return false;
		    },

		    _getParamsObject : function (request) {
		        var shouldTypecast = this._router.shouldTypecast,
		            values = this._router.patternLexer.getParamValues(request, this._matchRegexp, shouldTypecast),
		            o = {},
		            n = values.length,
		            param, val;
		        while (n--) {
		            val = values[n];
		            if (this._paramsIds) {
		                param = this._paramsIds[n];
		                if (param.indexOf('?') === 0 && val) {
		                    //make a copy of the original string so array and
		                    //RegExp validation can be applied properly
		                    o[param +'_'] = val;
		                    //update vals_ array as well since it will be used
		                    //during dispatch
		                    val = decodeQueryString(val, shouldTypecast);
		                    values[n] = val;
		                }
		                // IE will capture optional groups as empty strings while other
		                // browsers will capture `undefined` so normalize behavior.
		                // see: #gh-58, #gh-59, #gh-60
		                if ( _hasOptionalGroupBug && val === '' && arrayIndexOf(this._optionalParamsIds, param) !== -1 ) {
		                    val = void(0);
		                    values[n] = val;
		                }
		                o[param] = val;
		            }
		            //alias to paths and for RegExp pattern
		            o[n] = val;
		        }
		        o.request_ = shouldTypecast? typecastValue(request) : request;
		        o.vals_ = values;
		        return o;
		    },

		    _getParamsArray : function (request) {
		        var norm = this.rules? this.rules.normalize_ : null,
		            params;
		        norm = norm || this._router.normalizeFn; // default normalize
		        if (norm && isFunction(norm)) {
		            params = norm(request, this._getParamsObject(request));
		        } else {
		            params = this._getParamsObject(request).vals_;
		        }
		        return params;
		    },

		    interpolate : function(replacements) {
		        var str = this._router.patternLexer.interpolate(this._pattern, replacements);
		        if (! this._validateParams(str) ) {
		            throw new Error('Generated string doesn\'t validate against `Route.rules`.');
		        }
		        return str;
		    },

		    dispose : function () {
		        this._router.removeRoute(this);
		    },

		    _destroy : function () {
		        this.matched.dispose();
		        this.switched.dispose();
		        this.matched = this.switched = this._pattern = this._matchRegexp = null;
		    },

		    toString : function () {
		        return '[Route pattern:"'+ this._pattern +'", numListeners:'+ this.matched.getNumListeners() +']';
		    }

		};



		// Pattern Lexer ------
		//=====================

		Crossroads.prototype.patternLexer = (function () {

		    var
		        //match chars that should be escaped on string regexp
		        ESCAPE_CHARS_REGEXP = /[\\.+*?\^$\[\](){}\/'#]/g,

		        //trailing slashes (begin/end of string)
		        LOOSE_SLASHES_REGEXP = /^\/|\/$/g,
		        LEGACY_SLASHES_REGEXP = /\/$/g,

		        //params - everything between `{ }` or `: :`
		        PARAMS_REGEXP = /(?:\{|:)([^}:]+)(?:\}|:)/g,

		        //used to save params during compile (avoid escaping things that
		        //shouldn't be escaped).
		        TOKENS = {
		            'OS' : {
		                //optional slashes
		                //slash between `::` or `}:` or `\w:` or `:{?` or `}{?` or `\w{?`
		                rgx : /([:}]|\w(?=\/))\/?(:|(?:\{\?))/g,
		                save : '$1{{id}}$2',
		                res : '\\/?'
		            },
		            'RS' : {
		                //required slashes
		                //used to insert slash between `:{` and `}{`
		                rgx : /([:}])\/?(\{)/g,
		                save : '$1{{id}}$2',
		                res : '\\/'
		            },
		            'RQ' : {
		                //required query string - everything in between `{? }`
		                rgx : /\{\?([^}]+)\}/g,
		                //everything from `?` till `#` or end of string
		                res : '\\?([^#]+)'
		            },
		            'OQ' : {
		                //optional query string - everything in between `:? :`
		                rgx : /:\?([^:]+):/g,
		                //everything from `?` till `#` or end of string
		                res : '(?:\\?([^#]*))?'
		            },
		            'OR' : {
		                //optional rest - everything in between `: *:`
		                rgx : /:([^:]+)\*:/g,
		                res : '(.*)?' // optional group to avoid passing empty string as captured
		            },
		            'RR' : {
		                //rest param - everything in between `{ *}`
		                rgx : /\{([^}]+)\*\}/g,
		                res : '(.+)'
		            },
		            // required/optional params should come after rest segments
		            'RP' : {
		                //required params - everything between `{ }`
		                rgx : /\{([^}]+)\}/g,
		                res : '([^\\/?]+)'
		            },
		            'OP' : {
		                //optional params - everything between `: :`
		                rgx : /:([^:]+):/g,
		                res : '([^\\/?]+)?\/?'
		            }
		        },

		        LOOSE_SLASH = 1,
		        STRICT_SLASH = 2,
		        LEGACY_SLASH = 3,

		        _slashMode = LOOSE_SLASH;


		    function precompileTokens(){
		        var key, cur;
		        for (key in TOKENS) {
		            if (TOKENS.hasOwnProperty(key)) {
		                cur = TOKENS[key];
		                cur.id = '__CR_'+ key +'__';
		                cur.save = ('save' in cur)? cur.save.replace('{{id}}', cur.id) : cur.id;
		                cur.rRestore = new RegExp(cur.id, 'g');
		            }
		        }
		    }
		    precompileTokens();


		    function captureVals(regex, pattern) {
		        var vals = [], match;
		        // very important to reset lastIndex since RegExp can have "g" flag
		        // and multiple runs might affect the result, specially if matching
		        // same string multiple times on IE 7-8
		        regex.lastIndex = 0;
		        while (match = regex.exec(pattern)) {
		            vals.push(match[1]);
		        }
		        return vals;
		    }

		    function getParamIds(pattern) {
		        return captureVals(PARAMS_REGEXP, pattern);
		    }

		    function getOptionalParamsIds(pattern) {
		        return captureVals(TOKENS.OP.rgx, pattern);
		    }

		    function compilePattern(pattern, ignoreCase) {
		        pattern = pattern || '';

		        if(pattern){
		            if (_slashMode === LOOSE_SLASH) {
		                pattern = pattern.replace(LOOSE_SLASHES_REGEXP, '');
		            }
		            else if (_slashMode === LEGACY_SLASH) {
		                pattern = pattern.replace(LEGACY_SLASHES_REGEXP, '');
		            }

		            //save tokens
		            pattern = replaceTokens(pattern, 'rgx', 'save');
		            //regexp escape
		            pattern = pattern.replace(ESCAPE_CHARS_REGEXP, '\\$&');
		            //restore tokens
		            pattern = replaceTokens(pattern, 'rRestore', 'res');

		            if (_slashMode === LOOSE_SLASH) {
		                pattern = '\\/?'+ pattern;
		            }
		        }

		        if (_slashMode !== STRICT_SLASH) {
		            //single slash is treated as empty and end slash is optional
		            pattern += '\\/?';
		        }
		        return new RegExp('^'+ pattern + '$', ignoreCase? 'i' : '');
		    }

		    function replaceTokens(pattern, regexpName, replaceName) {
		        var cur, key;
		        for (key in TOKENS) {
		            if (TOKENS.hasOwnProperty(key)) {
		                cur = TOKENS[key];
		                pattern = pattern.replace(cur[regexpName], cur[replaceName]);
		            }
		        }
		        return pattern;
		    }

		    function getParamValues(request, regexp, shouldTypecast) {
		        var vals = regexp.exec(request);
		        if (vals) {
		            vals.shift();
		            if (shouldTypecast) {
		                vals = typecastArrayValues(vals);
		            }
		        }
		        return vals;
		    }

		    function interpolate(pattern, replacements) {
		        if (typeof pattern !== 'string') {
		            throw new Error('Route pattern should be a string.');
		        }

		        var replaceFn = function(match, prop){
		                var val;
		                prop = (prop.substr(0, 1) === '?')? prop.substr(1) : prop;
		                if (replacements[prop] != null) {
		                    if (typeof replacements[prop] === 'object') {
		                        var queryParts = [];
		                        for(var key in replacements[prop]) {
		                            queryParts.push(encodeURI(key + '=' + replacements[prop][key]));
		                        }
		                        val = '?' + queryParts.join('&');
		                    } else {
		                        // make sure value is a string see #gh-54
		                        val = String(replacements[prop]);
		                    }

		                    if (match.indexOf('*') === -1 && val.indexOf('/') !== -1) {
		                        throw new Error('Invalid value "'+ val +'" for segment "'+ match +'".');
		                    }
		                }
		                else if (match.indexOf('{') !== -1) {
		                    throw new Error('The segment '+ match +' is required.');
		                }
		                else {
		                    val = '';
		                }
		                return val;
		            };

		        if (! TOKENS.OS.trail) {
		            TOKENS.OS.trail = new RegExp('(?:'+ TOKENS.OS.id +')+$');
		        }

		        return pattern
		                    .replace(TOKENS.OS.rgx, TOKENS.OS.save)
		                    .replace(PARAMS_REGEXP, replaceFn)
		                    .replace(TOKENS.OS.trail, '') // remove trailing
		                    .replace(TOKENS.OS.rRestore, '/'); // add slash between segments
		    }

		    //API
		    return {
		        strict : function(){
		            _slashMode = STRICT_SLASH;
		        },
		        loose : function(){
		            _slashMode = LOOSE_SLASH;
		        },
		        legacy : function(){
		            _slashMode = LEGACY_SLASH;
		        },
		        getParamIds : getParamIds,
		        getOptionalParamsIds : getOptionalParamsIds,
		        getParamValues : getParamValues,
		        compilePattern : compilePattern,
		        interpolate : interpolate
		    };

		}());


		return crossroads;
		};
		
		if (typeof define === 'function' && define.amd) {
		define(['signals'], factory);
		} else if (typeof module !== 'undefined' && module.exports) { //Node
		module.exports = factory(require('signals'));
		} else {
		/*jshint sub:true */
		window['crossroads'] = factory(window['signals']);
		}
		
		}());
		
		
		},
		{"signals":"node_modules/crossroads/node_modules/signals/dist/signals.js"}],
	
	"node_modules/crossroads/node_modules/signals/dist/signals.js":[function(require,module,exports){
		/*jslint onevar:true, undef:true, newcap:true, regexp:true, bitwise:true, maxerr:50, indent:4, white:false, nomen:false, plusplus:false */
		/*global define:false, require:false, exports:false, module:false, signals:false */
		
		/** @license
		 * JS Signals <http://millermedeiros.github.com/js-signals/>
		 * Released under the MIT license
		 * Author: Miller Medeiros
		 * Version: 1.0.0 - Build: 268 (2012/11/29 05:48 PM)
		 */
		
		(function(global){
	
	    // SignalBinding -------------------------------------------------
	    //================================================================
	
	    /**
	     * Object that represents a binding between a Signal and a listener function.
	     * <br />- <strong>This is an internal constructor and shouldn't be called by regular users.</strong>
	     * <br />- inspired by Joa Ebert AS3 SignalBinding and Robert Penner's Slot classes.
	     * @author Miller Medeiros
	     * @constructor
	     * @internal
	     * @name SignalBinding
	     * @param {Signal} signal Reference to Signal object that listener is currently bound to.
	     * @param {Function} listener Handler function bound to the signal.
	     * @param {boolean} isOnce If binding should be executed just once.
	     * @param {Object} [listenerContext] Context on which listener will be executed (object that should represent the `this` variable inside listener function).
	     * @param {Number} [priority] The priority level of the event listener. (default = 0).
	     */
	    function SignalBinding(signal, listener, isOnce, listenerContext, priority) {
	
	        /**
	         * Handler function bound to the signal.
	         * @type Function
	         * @private
	         */
	        this._listener = listener;
	
	        /**
	         * If binding should be executed just once.
	         * @type boolean
	         * @private
	         */
	        this._isOnce = isOnce;
	
	        /**
	         * Context on which listener will be executed (object that should represent the `this` variable inside listener function).
	         * @memberOf SignalBinding.prototype
	         * @name context
	         * @type Object|undefined|null
	         */
	        this.context = listenerContext;
	
	        /**
	         * Reference to Signal object that listener is currently bound to.
	         * @type Signal
	         * @private
	         */
	        this._signal = signal;
	
	        /**
	         * Listener priority
	         * @type Number
	         * @private
	         */
	        this._priority = priority || 0;
	    }
	
	    SignalBinding.prototype = {
	
	        /**
	         * If binding is active and should be executed.
	         * @type boolean
	         */
	        active : true,
	
	        /**
	         * Default parameters passed to listener during `Signal.dispatch` and `SignalBinding.execute`. (curried parameters)
	         * @type Array|null
	         */
	        params : null,
	
	        /**
	         * Call listener passing arbitrary parameters.
	         * <p>If binding was added using `Signal.addOnce()` it will be automatically removed from signal dispatch queue, this method is used internally for the signal dispatch.</p>
	         * @param {Array} [paramsArr] Array of parameters that should be passed to the listener
	         * @return {*} Value returned by the listener.
	         */
	        execute : function (paramsArr) {
	            var handlerReturn, params;
	            if (this.active && !!this._listener) {
	                params = this.params? this.params.concat(paramsArr) : paramsArr;
	                handlerReturn = this._listener.apply(this.context, params);
	                if (this._isOnce) {
	                    this.detach();
	                }
	            }
	            return handlerReturn;
	        },
	
	        /**
	         * Detach binding from signal.
	         * - alias to: mySignal.remove(myBinding.getListener());
	         * @return {Function|null} Handler function bound to the signal or `null` if binding was previously detached.
	         */
	        detach : function () {
	            return this.isBound()? this._signal.remove(this._listener, this.context) : null;
	        },
	
	        /**
	         * @return {Boolean} `true` if binding is still bound to the signal and have a listener.
	         */
	        isBound : function () {
	            return (!!this._signal && !!this._listener);
	        },
	
	        /**
	         * @return {boolean} If SignalBinding will only be executed once.
	         */
	        isOnce : function () {
	            return this._isOnce;
	        },
	
	        /**
	         * @return {Function} Handler function bound to the signal.
	         */
	        getListener : function () {
	            return this._listener;
	        },
	
	        /**
	         * @return {Signal} Signal that listener is currently bound to.
	         */
	        getSignal : function () {
	            return this._signal;
	        },
	
	        /**
	         * Delete instance properties
	         * @private
	         */
	        _destroy : function () {
	            delete this._signal;
	            delete this._listener;
	            delete this.context;
	        },
	
	        /**
	         * @return {string} String representation of the object.
	         */
	        toString : function () {
	            return '[SignalBinding isOnce:' + this._isOnce +', isBound:'+ this.isBound() +', active:' + this.active + ']';
	        }
	
	    };
		
		
		/*global SignalBinding:false*/
	
	    // Signal --------------------------------------------------------
	    //================================================================
	
	    function validateListener(listener, fnName) {
	        if (typeof listener !== 'function') {
	            throw new Error( 'listener is a required param of {fn}() and should be a Function.'.replace('{fn}', fnName) );
	        }
	    }
	
	    /**
	     * Custom event broadcaster
	     * <br />- inspired by Robert Penner's AS3 Signals.
	     * @name Signal
	     * @author Miller Medeiros
	     * @constructor
	     */
	    function Signal() {
	        /**
	         * @type Array.<SignalBinding>
	         * @private
	         */
	        this._bindings = [];
	        this._prevParams = null;
	
	        // enforce dispatch to aways work on same context (#47)
	        var self = this;
	        this.dispatch = function(){
	            Signal.prototype.dispatch.apply(self, arguments);
	        };
	    }
	
	    Signal.prototype = {
	
	        /**
	         * Signals Version Number
	         * @type String
	         * @const
	         */
	        VERSION : '1.0.0',
	
	        /**
	         * If Signal should keep record of previously dispatched parameters and
	         * automatically execute listener during `add()`/`addOnce()` if Signal was
	         * already dispatched before.
	         * @type boolean
	         */
	        memorize : false,
	
	        /**
	         * @type boolean
	         * @private
	         */
	        _shouldPropagate : true,
	
	        /**
	         * If Signal is active and should broadcast events.
	         * <p><strong>IMPORTANT:</strong> Setting this property during a dispatch will only affect the next dispatch, if you want to stop the propagation of a signal use `halt()` instead.</p>
	         * @type boolean
	         */
	        active : true,
	
	        /**
	         * @param {Function} listener
	         * @param {boolean} isOnce
	         * @param {Object} [listenerContext]
	         * @param {Number} [priority]
	         * @return {SignalBinding}
	         * @private
	         */
	        _registerListener : function (listener, isOnce, listenerContext, priority) {
	
	            var prevIndex = this._indexOfListener(listener, listenerContext),
	                binding;
	
	            if (prevIndex !== -1) {
	                binding = this._bindings[prevIndex];
	                if (binding.isOnce() !== isOnce) {
	                    throw new Error('You cannot add'+ (isOnce? '' : 'Once') +'() then add'+ (!isOnce? '' : 'Once') +'() the same listener without removing the relationship first.');
	                }
	            } else {
	                binding = new SignalBinding(this, listener, isOnce, listenerContext, priority);
	                this._addBinding(binding);
	            }
	
	            if(this.memorize && this._prevParams){
	                binding.execute(this._prevParams);
	            }
	
	            return binding;
	        },
	
	        /**
	         * @param {SignalBinding} binding
	         * @private
	         */
	        _addBinding : function (binding) {
	            //simplified insertion sort
	            var n = this._bindings.length;
	            do { --n; } while (this._bindings[n] && binding._priority <= this._bindings[n]._priority);
	            this._bindings.splice(n + 1, 0, binding);
	        },
	
	        /**
	         * @param {Function} listener
	         * @return {number}
	         * @private
	         */
	        _indexOfListener : function (listener, context) {
	            var n = this._bindings.length,
	                cur;
	            while (n--) {
	                cur = this._bindings[n];
	                if (cur._listener === listener && cur.context === context) {
	                    return n;
	                }
	            }
	            return -1;
	        },
	
	        /**
	         * Check if listener was attached to Signal.
	         * @param {Function} listener
	         * @param {Object} [context]
	         * @return {boolean} if Signal has the specified listener.
	         */
	        has : function (listener, context) {
	            return this._indexOfListener(listener, context) !== -1;
	        },
	
	        /**
	         * Add a listener to the signal.
	         * @param {Function} listener Signal handler function.
	         * @param {Object} [listenerContext] Context on which listener will be executed (object that should represent the `this` variable inside listener function).
	         * @param {Number} [priority] The priority level of the event listener. Listeners with higher priority will be executed before listeners with lower priority. Listeners with same priority level will be executed at the same order as they were added. (default = 0)
	         * @return {SignalBinding} An Object representing the binding between the Signal and listener.
	         */
	        add : function (listener, listenerContext, priority) {
	            validateListener(listener, 'add');
	            return this._registerListener(listener, false, listenerContext, priority);
	        },
	
	        /**
	         * Add listener to the signal that should be removed after first execution (will be executed only once).
	         * @param {Function} listener Signal handler function.
	         * @param {Object} [listenerContext] Context on which listener will be executed (object that should represent the `this` variable inside listener function).
	         * @param {Number} [priority] The priority level of the event listener. Listeners with higher priority will be executed before listeners with lower priority. Listeners with same priority level will be executed at the same order as they were added. (default = 0)
	         * @return {SignalBinding} An Object representing the binding between the Signal and listener.
	         */
	        addOnce : function (listener, listenerContext, priority) {
	            validateListener(listener, 'addOnce');
	            return this._registerListener(listener, true, listenerContext, priority);
	        },
	
	        /**
	         * Remove a single listener from the dispatch queue.
	         * @param {Function} listener Handler function that should be removed.
	         * @param {Object} [context] Execution context (since you can add the same handler multiple times if executing in a different context).
	         * @return {Function} Listener handler function.
	         */
	        remove : function (listener, context) {
	            validateListener(listener, 'remove');
	
	            var i = this._indexOfListener(listener, context);
	            if (i !== -1) {
	                this._bindings[i]._destroy(); //no reason to a SignalBinding exist if it isn't attached to a signal
	                this._bindings.splice(i, 1);
	            }
	            return listener;
	        },
	
	        /**
	         * Remove all listeners from the Signal.
	         */
	        removeAll : function () {
	            var n = this._bindings.length;
	            while (n--) {
	                this._bindings[n]._destroy();
	            }
	            this._bindings.length = 0;
	        },
	
	        /**
	         * @return {number} Number of listeners attached to the Signal.
	         */
	        getNumListeners : function () {
	            return this._bindings.length;
	        },
	
	        /**
	         * Stop propagation of the event, blocking the dispatch to next listeners on the queue.
	         * <p><strong>IMPORTANT:</strong> should be called only during signal dispatch, calling it before/after dispatch won't affect signal broadcast.</p>
	         * @see Signal.prototype.disable
	         */
	        halt : function () {
	            this._shouldPropagate = false;
	        },
	
	        /**
	         * Dispatch/Broadcast Signal to all listeners added to the queue.
	         * @param {...*} [params] Parameters that should be passed to each handler.
	         */
	        dispatch : function (params) {
	            if (! this.active) {
	                return;
	            }
	
	            var paramsArr = Array.prototype.slice.call(arguments),
	                n = this._bindings.length,
	                bindings;
	
	            if (this.memorize) {
	                this._prevParams = paramsArr;
	            }
	
	            if (! n) {
	                //should come after memorize
	                return;
	            }
	
	            bindings = this._bindings.slice(); //clone array in case add/remove items during dispatch
	            this._shouldPropagate = true; //in case `halt` was called before dispatch or during the previous dispatch.
	
	            //execute all callbacks until end of the list or until a callback returns `false` or stops propagation
	            //reverse loop since listeners with higher priority will be added at the end of the list
	            do { n--; } while (bindings[n] && this._shouldPropagate && bindings[n].execute(paramsArr) !== false);
	        },
	
	        /**
	         * Forget memorized arguments.
	         * @see Signal.memorize
	         */
	        forget : function(){
	            this._prevParams = null;
	        },
	
	        /**
	         * Remove all bindings from signal and destroy any reference to external objects (destroy Signal object).
	         * <p><strong>IMPORTANT:</strong> calling any method on the signal instance after calling dispose will throw errors.</p>
	         */
	        dispose : function () {
	            this.removeAll();
	            delete this._bindings;
	            delete this._prevParams;
	        },
	
	        /**
	         * @return {string} String representation of the object.
	         */
	        toString : function () {
	            return '[Signal active:'+ this.active +' numListeners:'+ this.getNumListeners() +']';
	        }
	
	    };
	
	
	    // Namespace -----------------------------------------------------
	    //================================================================
	
	    /**
	     * Signals namespace
	     * @namespace
	     * @name signals
	     */
	    var signals = Signal;
	
	    /**
	     * Custom event broadcaster
	     * @see Signal
	     */
	    // alias for backwards compatibility (see #gh-44)
	    signals.Signal = Signal;
	
	
	
	    //exports to multiple environments
	    if(typeof define === 'function' && define.amd){ //AMD
	        define(function () { return signals; });
	    } else if (typeof module !== 'undefined' && module.exports){ //node
	        module.exports = signals;
	    } else { //browser
	        //use string because of Google closure compiler ADVANCED_MODE
	        /*jslint sub:true */
	        global['signals'] = signals;
	    }
		
		}(this));
		
		},
		{}],
	
	"node_modules/glslify/browser.js":[function(require,module,exports){
		module.exports = noop
		
		function noop() {
 		throw new Error(
 		    'You should bundle your code ' +
 		    'using `glslify` as a transform.'
 		)
		}
		
		},
		{}],
	
	"node_modules/glslify/simple-adapter.js":[function(require,module,exports){
		module.exports = programify
		
		function programify(vertex, fragment, uniforms, attributes) {
 		return {
 		  vertex: vertex, 
 		  fragment: fragment,
 		  uniforms: uniforms, 
 		  attributes: attributes
 		};
		}
		
		},
		{}],
	
	"node_modules/gulpfile/node_modules/browserify/lib/_empty.js":[function(require,module,exports){
	
		},
		{}],
	
	"node_modules/gulpfile/node_modules/browserify/node_modules/process/browser.js":[function(require,module,exports){
		// shim for using process in browser
		
		var process = module.exports = {};
		
		process.nextTick = (function () {
	    var canSetImmediate = typeof window !== 'undefined'
	    && window.setImmediate;
	    var canMutationObserver = typeof window !== 'undefined'
	    && window.MutationObserver;
	    var canPost = typeof window !== 'undefined'
	    && window.postMessage && window.addEventListener
	    ;
	
	    if (canSetImmediate) {
	        return function (f) { return window.setImmediate(f) };
	    }
	
	    var queue = [];
	
	    if (canMutationObserver) {
	        var hiddenDiv = document.createElement("div");
	        var observer = new MutationObserver(function () {
	            var queueList = queue.slice();
	            queue.length = 0;
	            queueList.forEach(function (fn) {
	                fn();
	            });
	        });
	
	        observer.observe(hiddenDiv, { attributes: true });
	
	        return function nextTick(fn) {
	            if (!queue.length) {
	                hiddenDiv.setAttribute('yes', 'no');
	            }
	            queue.push(fn);
	        };
	    }
	
	    if (canPost) {
	        window.addEventListener('message', function (ev) {
	            var source = ev.source;
	            if ((source === window || source === null) && ev.data === 'process-tick') {
	                ev.stopPropagation();
	                if (queue.length > 0) {
	                    var fn = queue.shift();
	                    fn();
	                }
	            }
	        }, true);
	
	        return function nextTick(fn) {
	            queue.push(fn);
	            window.postMessage('process-tick', '*');
	        };
	    }
	
	    return function nextTick(fn) {
	        setTimeout(fn, 0);
	    };
		})();
		
		process.title = 'browser';
		process.browser = true;
		process.env = {};
		process.argv = [];
		
		function noop() {}
		
		process.on = noop;
		process.addListener = noop;
		process.once = noop;
		process.off = noop;
		process.removeListener = noop;
		process.removeAllListeners = noop;
		process.emit = noop;
		
		process.binding = function (name) {
	    throw new Error('process.binding is not supported');
		};
		
		// TODO(shtylman)
		process.cwd = function () { return '/' };
		process.chdir = function (dir) {
	    throw new Error('process.chdir is not supported');
		};
		
		},
		{}],
		
	"node_modules/gulpfile/node_modules/browserify/node_modules/querystring-es3/decode.js":[function(require,module,exports){
		// Copyright Joyent, Inc. and other Node contributors.
		//
		// Permission is hereby granted, free of charge, to any person obtaining a
		// copy of this software and associated documentation files (the
		// "Software"), to deal in the Software without restriction, including
		// without limitation the rights to use, copy, modify, merge, publish,
		// distribute, sublicense, and/or sell copies of the Software, and to permit
		// persons to whom the Software is furnished to do so, subject to the
		// following conditions:
		//
		// The above copyright notice and this permission notice shall be included
		// in all copies or substantial portions of the Software.
		//
		// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
		// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
		// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
		// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
		// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
		// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
		// USE OR OTHER DEALINGS IN THE SOFTWARE.
		
		'use strict';
		
		// If obj.hasOwnProperty has been overridden, then calling
		// obj.hasOwnProperty(prop) will break.
		// See: https://github.com/joyent/node/issues/1707
		function hasOwnProperty(obj, prop) {
		  return Object.prototype.hasOwnProperty.call(obj, prop);
			}
			
			module.exports = function(qs, sep, eq, options) {
		  sep = sep || '&';
		  eq = eq || '=';
		  var obj = {};
		
		  if (typeof qs !== 'string' || qs.length === 0) {
		    return obj;
		  }
		
		  var regexp = /\+/g;
		  qs = qs.split(sep);
		
		  var maxKeys = 1000;
		  if (options && typeof options.maxKeys === 'number') {
		    maxKeys = options.maxKeys;
		  }
		
		  var len = qs.length;
		  // maxKeys <= 0 means that we should not limit keys count
		  if (maxKeys > 0 && len > maxKeys) {
		    len = maxKeys;
		  }
		
		  for (var i = 0; i < len; ++i) {
		    var x = qs[i].replace(regexp, '%20'),
		        idx = x.indexOf(eq),
		        kstr, vstr, k, v;
		
		    if (idx >= 0) {
		      kstr = x.substr(0, idx);
		      vstr = x.substr(idx + 1);
		    } else {
		      kstr = x;
		      vstr = '';
		    }
		
		    k = decodeURIComponent(kstr);
		    v = decodeURIComponent(vstr);
		
		    if (!hasOwnProperty(obj, k)) {
		      obj[k] = v;
		    } else if (isArray(obj[k])) {
		      obj[k].push(v);
		    } else {
		      obj[k] = [obj[k], v];
		    }
		  }
		
		  return obj;
			};
			
			var isArray = Array.isArray || function (xs) {
		  return Object.prototype.toString.call(xs) === '[object Array]';
		};
		
		},
		{}],
	
	"node_modules/gulpfile/node_modules/browserify/node_modules/querystring-es3/encode.js":[function(require,module,exports){
		// Copyright Joyent, Inc. and other Node contributors.
		//
		// Permission is hereby granted, free of charge, to any person obtaining a
		// copy of this software and associated documentation files (the
		// "Software"), to deal in the Software without restriction, including
		// without limitation the rights to use, copy, modify, merge, publish,
		// distribute, sublicense, and/or sell copies of the Software, and to permit
		// persons to whom the Software is furnished to do so, subject to the
		// following conditions:
		//
		// The above copyright notice and this permission notice shall be included
		// in all copies or substantial portions of the Software.
		//
		// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
		// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
		// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
		// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
		// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
		// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
		// USE OR OTHER DEALINGS IN THE SOFTWARE.
		
		'use strict';
		
		var stringifyPrimitive = function(v) {
		  switch (typeof v) {
		    case 'string':
		      return v;
		
		    case 'boolean':
		      return v ? 'true' : 'false';
		
		    case 'number':
		      return isFinite(v) ? v : '';
		
		    default:
		      return '';
		  }
			};
			
			module.exports = function(obj, sep, eq, name) {
		  sep = sep || '&';
		  eq = eq || '=';
		  if (obj === null) {
		    obj = undefined;
		  }
		
		  if (typeof obj === 'object') {
		    return map(objectKeys(obj), function(k) {
		      var ks = encodeURIComponent(stringifyPrimitive(k)) + eq;
		      if (isArray(obj[k])) {
		        return map(obj[k], function(v) {
		          return ks + encodeURIComponent(stringifyPrimitive(v));
		        }).join(sep);
		      } else {
		        return ks + encodeURIComponent(stringifyPrimitive(obj[k]));
		      }
		    }).join(sep);
		
		  }
		
		  if (!name) return '';
		  return encodeURIComponent(stringifyPrimitive(name)) + eq +
		         encodeURIComponent(stringifyPrimitive(obj));
			};
			
			var isArray = Array.isArray || function (xs) {
		  return Object.prototype.toString.call(xs) === '[object Array]';
			};
			
			function map (xs, f) {
		  if (xs.map) return xs.map(f);
		  var res = [];
		  for (var i = 0; i < xs.length; i++) {
		    res.push(f(xs[i], i));
		  }
		  return res;
			}
			
			var objectKeys = Object.keys || function (obj) {
		  var res = [];
		  for (var key in obj) {
		    if (Object.prototype.hasOwnProperty.call(obj, key)) res.push(key);
		  }
		  return res;
		};
		
		},{}],
	
	"node_modules/gulpfile/node_modules/browserify/node_modules/querystring-es3/index.js":[function(require,module,exports){
		'use strict';
	
		exports.decode = exports.parse = require('./decode');
		exports.encode = exports.stringify = require('./encode');
	
		},
		{"./decode":"node_modules/gulpfile/node_modules/browserify/node_modules/querystring-es3/decode.js",
		"./encode":"node_modules/gulpfile/node_modules/browserify/node_modules/querystring-es3/encode.js"}],
	
	"node_modules/hasher/dist/js/hasher.js":[function(require,module,exports){
		/*!!
	 * Hasher <http://github.com/millermedeiros/hasher>
	 * @author Miller Medeiros
	 * @version 1.2.0 (2013/11/11 03:18 PM)
	 * Released under the MIT License
	 */
		
		;(function () {
		var factory = function(signals){
		
		/*jshint white:false*/
		/*global signals:false, window:false*/
		
		/**
	 * Hasher
	 * @namespace History Manager for rich-media applications.
	 * @name hasher
	 */
		var hasher = (function(window){
	
	    //--------------------------------------------------------------------------------------
	    // Private Vars
	    //--------------------------------------------------------------------------------------
	
	    var
	
	        // frequency that it will check hash value on IE 6-7 since it doesn't
	        // support the hashchange event
	        POOL_INTERVAL = 25,
	
	        // local storage for brevity and better compression --------------------------------
	
	        document = window.document,
	        history = window.history,
	        Signal = signals.Signal,
	
	        // local vars ----------------------------------------------------------------------
	
	        hasher,
	        _hash,
	        _checkInterval,
	        _isActive,
	        _frame, //iframe used for legacy IE (6-7)
	        _checkHistory,
	        _hashValRegexp = /#(.*)$/,
	        _baseUrlRegexp = /(\?.*)|(\#.*)/,
	        _hashRegexp = /^\#/,
	
	        // sniffing/feature detection -------------------------------------------------------
	
	        //hack based on this: http://webreflection.blogspot.com/2009/01/32-bytes-to-know-if-your-browser-is-ie.html
	        _isIE = (!+"\v1"),
	        // hashchange is supported by FF3.6+, IE8+, Chrome 5+, Safari 5+ but
	        // feature detection fails on IE compatibility mode, so we need to
	        // check documentMode
	        _isHashChangeSupported = ('onhashchange' in window) && document.documentMode !== 7,
	        //check if is IE6-7 since hash change is only supported on IE8+ and
	        //changing hash value on IE6-7 doesn't generate history record.
	        _isLegacyIE = _isIE && !_isHashChangeSupported,
	        _isLocal = (location.protocol === 'file:');
	
	
	    //--------------------------------------------------------------------------------------
	    // Private Methods
	    //--------------------------------------------------------------------------------------
	
	    function _escapeRegExp(str){
	        return String(str || '').replace(/\W/g, "\\$&");
	    }
	
	    function _trimHash(hash){
	        if (!hash) return '';
	        var regexp = new RegExp('^' + _escapeRegExp(hasher.prependHash) + '|' + _escapeRegExp(hasher.appendHash) + '$', 'g');
	        return hash.replace(regexp, '');
	    }
	
	    function _getWindowHash(){
	        //parsed full URL instead of getting window.location.hash because Firefox decode hash value (and all the other browsers don't)
	        //also because of IE8 bug with hash query in local file [issue #6]
	        var result = _hashValRegexp.exec( hasher.getURL() );
	        var path = (result && result[1]) || '';
	        try {
	          return hasher.raw? path : decodeURIComponent(path);
	        } catch (e) {
	          // in case user did not set `hasher.raw` and decodeURIComponent
	          // throws an error (see #57)
	          return path;
	        }
	    }
	
	    function _getFrameHash(){
	        return (_frame)? _frame.contentWindow.frameHash : null;
	    }
	
	    function _createFrame(){
	        _frame = document.createElement('iframe');
	        _frame.src = 'about:blank';
	        _frame.style.display = 'none';
	        document.body.appendChild(_frame);
	    }
	
	    function _updateFrame(){
	        if(_frame && _hash !== _getFrameHash()){
	            var frameDoc = _frame.contentWindow.document;
	            frameDoc.open();
	            //update iframe content to force new history record.
	            //based on Really Simple History, SWFAddress and YUI.history.
	            frameDoc.write('<html><head><title>' + document.title + '</title><script type="text/javascript">var frameHash="' + _hash + '";</script></head><body>&nbsp;</body></html>');
	            frameDoc.close();
	        }
	    }
	
	    function _registerChange(newHash, isReplace){
	        if(_hash !== newHash){
	            var oldHash = _hash;
	            _hash = newHash; //should come before event dispatch to make sure user can get proper value inside event handler
	            if(_isLegacyIE){
	                if(!isReplace){
	                    _updateFrame();
	                } else {
	                    _frame.contentWindow.frameHash = newHash;
	                }
	            }
	            hasher.changed.dispatch(_trimHash(newHash), _trimHash(oldHash));
	        }
	    }
	
	    if (_isLegacyIE) {
	        /**
	         * @private
	         */
	        _checkHistory = function(){
	            var windowHash = _getWindowHash(),
	                frameHash = _getFrameHash();
	            if(frameHash !== _hash && frameHash !== windowHash){
	                //detect changes made pressing browser history buttons.
	                //Workaround since history.back() and history.forward() doesn't
	                //update hash value on IE6/7 but updates content of the iframe.
	                //needs to trim hash since value stored already have
	                //prependHash + appendHash for fast check.
	                hasher.setHash(_trimHash(frameHash));
	            } else if (windowHash !== _hash){
	                //detect if hash changed (manually or using setHash)
	                _registerChange(windowHash);
	            }
	        };
	    } else {
	        /**
	         * @private
	         */
	        _checkHistory = function(){
	            var windowHash = _getWindowHash();
	            if(windowHash !== _hash){
	                _registerChange(windowHash);
	            }
	        };
	    }
	
	    function _addListener(elm, eType, fn){
	        if(elm.addEventListener){
	            elm.addEventListener(eType, fn, false);
	        } else if (elm.attachEvent){
	            elm.attachEvent('on' + eType, fn);
	        }
	    }
	
	    function _removeListener(elm, eType, fn){
	        if(elm.removeEventListener){
	            elm.removeEventListener(eType, fn, false);
	        } else if (elm.detachEvent){
	            elm.detachEvent('on' + eType, fn);
	        }
	    }
	
	    function _makePath(paths){
	        paths = Array.prototype.slice.call(arguments);
	
	        var path = paths.join(hasher.separator);
	        path = path? hasher.prependHash + path.replace(_hashRegexp, '') + hasher.appendHash : path;
	        return path;
	    }
	
	    function _encodePath(path){
	        //used encodeURI instead of encodeURIComponent to preserve '?', '/',
	        //'#'. Fixes Safari bug [issue #8]
	        path = encodeURI(path);
	        if(_isIE && _isLocal){
	            //fix IE8 local file bug [issue #6]
	            path = path.replace(/\?/, '%3F');
	        }
	        return path;
	    }
	
	    //--------------------------------------------------------------------------------------
	    // Public (API)
	    //--------------------------------------------------------------------------------------
	
	    hasher = /** @lends hasher */ {
	
	        /**
	         * hasher Version Number
	         * @type string
	         * @constant
	         */
	        VERSION : '1.2.0',
	
	        /**
	         * Boolean deciding if hasher encodes/decodes the hash or not.
	         * <ul>
	         * <li>default value: false;</li>
	         * </ul>
	         * @type boolean
	         */
	        raw : false,
	
	        /**
	         * String that should always be added to the end of Hash value.
	         * <ul>
	         * <li>default value: '';</li>
	         * <li>will be automatically removed from `hasher.getHash()`</li>
	         * <li>avoid conflicts with elements that contain ID equal to hash value;</li>
	         * </ul>
	         * @type string
	         */
	        appendHash : '',
	
	        /**
	         * String that should always be added to the beginning of Hash value.
	         * <ul>
	         * <li>default value: '/';</li>
	         * <li>will be automatically removed from `hasher.getHash()`</li>
	         * <li>avoid conflicts with elements that contain ID equal to hash value;</li>
	         * </ul>
	         * @type string
	         */
	        prependHash : '/',
	
	        /**
	         * String used to split hash paths; used by `hasher.getHashAsArray()` to split paths.
	         * <ul>
	         * <li>default value: '/';</li>
	         * </ul>
	         * @type string
	         */
	        separator : '/',
	
	        /**
	         * Signal dispatched when hash value changes.
	         * - pass current hash as 1st parameter to listeners and previous hash value as 2nd parameter.
	         * @type signals.Signal
	         */
	        changed : new Signal(),
	
	        /**
	         * Signal dispatched when hasher is stopped.
	         * -  pass current hash as first parameter to listeners
	         * @type signals.Signal
	         */
	        stopped : new Signal(),
	
	        /**
	         * Signal dispatched when hasher is initialized.
	         * - pass current hash as first parameter to listeners.
	         * @type signals.Signal
	         */
	        initialized : new Signal(),
	
	        /**
	         * Start listening/dispatching changes in the hash/history.
	         * <ul>
	         *   <li>hasher won't dispatch CHANGE events by manually typing a new value or pressing the back/forward buttons before calling this method.</li>
	         * </ul>
	         */
	        init : function(){
	            if(_isActive) return;
	
	            _hash = _getWindowHash();
	
	            //thought about branching/overloading hasher.init() to avoid checking multiple times but
	            //don't think worth doing it since it probably won't be called multiple times.
	            if(_isHashChangeSupported){
	                _addListener(window, 'hashchange', _checkHistory);
	            }else {
	                if(_isLegacyIE){
	                    if(! _frame){
	                        _createFrame();
	                    }
	                    _updateFrame();
	                }
	                _checkInterval = setInterval(_checkHistory, POOL_INTERVAL);
	            }
	
	            _isActive = true;
	            hasher.initialized.dispatch(_trimHash(_hash));
	        },
	
	        /**
	         * Stop listening/dispatching changes in the hash/history.
	         * <ul>
	         *   <li>hasher won't dispatch CHANGE events by manually typing a new value or pressing the back/forward buttons after calling this method, unless you call hasher.init() again.</li>
	         *   <li>hasher will still dispatch changes made programatically by calling hasher.setHash();</li>
	         * </ul>
	         */
	        stop : function(){
	            if(! _isActive) return;
	
	            if(_isHashChangeSupported){
	                _removeListener(window, 'hashchange', _checkHistory);
	            }else{
	                clearInterval(_checkInterval);
	                _checkInterval = null;
	            }
	
	            _isActive = false;
	            hasher.stopped.dispatch(_trimHash(_hash));
	        },
	
	        /**
	         * @return {boolean}    If hasher is listening to changes on the browser history and/or hash value.
	         */
	        isActive : function(){
	            return _isActive;
	        },
	
	        /**
	         * @return {string} Full URL.
	         */
	        getURL : function(){
	            return window.location.href;
	        },
	
	        /**
	         * @return {string} Retrieve URL without query string and hash.
	         */
	        getBaseURL : function(){
	            return hasher.getURL().replace(_baseUrlRegexp, ''); //removes everything after '?' and/or '#'
	        },
	
	        /**
	         * Set Hash value, generating a new history record.
	         * @param {...string} path    Hash value without '#'. Hasher will join
	         * path segments using `hasher.separator` and prepend/append hash value
	         * with `hasher.appendHash` and `hasher.prependHash`
	         * @example hasher.setHash('lorem', 'ipsum', 'dolor') -> '#/lorem/ipsum/dolor'
	         */
	        setHash : function(path){
	            path = _makePath.apply(null, arguments);
	            if(path !== _hash){
	                // we should store raw value
	                _registerChange(path);
	                if (path === _hash) {
	                    // we check if path is still === _hash to avoid error in
	                    // case of multiple consecutive redirects [issue #39]
	                    if (! hasher.raw) {
	                        path = _encodePath(path);
	                    }
	                    window.location.hash = '#' + path;
	                }
	            }
	        },
	
	        /**
	         * Set Hash value without keeping previous hash on the history record.
	         * Similar to calling `window.location.replace("#/hash")` but will also work on IE6-7.
	         * @param {...string} path    Hash value without '#'. Hasher will join
	         * path segments using `hasher.separator` and prepend/append hash value
	         * with `hasher.appendHash` and `hasher.prependHash`
	         * @example hasher.replaceHash('lorem', 'ipsum', 'dolor') -> '#/lorem/ipsum/dolor'
	         */
	        replaceHash : function(path){
	            path = _makePath.apply(null, arguments);
	            if(path !== _hash){
	                // we should store raw value
	                _registerChange(path, true);
	                if (path === _hash) {
	                    // we check if path is still === _hash to avoid error in
	                    // case of multiple consecutive redirects [issue #39]
	                    if (! hasher.raw) {
	                        path = _encodePath(path);
	                    }
	                    window.location.replace('#' + path);
	                }
	            }
	        },
	
	        /**
	         * @return {string} Hash value without '#', `hasher.appendHash` and `hasher.prependHash`.
	         */
	        getHash : function(){
	            //didn't used actual value of the `window.location.hash` to avoid breaking the application in case `window.location.hash` isn't available and also because value should always be synched.
	            return _trimHash(_hash);
	        },
	
	        /**
	         * @return {Array.<string>} Hash value split into an Array.
	         */
	        getHashAsArray : function(){
	            return hasher.getHash().split(hasher.separator);
	        },
	
	        /**
	         * Removes all event listeners, stops hasher and destroy hasher object.
	         * - IMPORTANT: hasher won't work after calling this method, hasher Object will be deleted.
	         */
	        dispose : function(){
	            hasher.stop();
	            hasher.initialized.dispose();
	            hasher.stopped.dispose();
	            hasher.changed.dispose();
	            _frame = hasher = window.hasher = null;
	        },
	
	        /**
	         * @return {string} A string representation of the object.
	         */
	        toString : function(){
	            return '[hasher version="'+ hasher.VERSION +'" hash="'+ hasher.getHash() +'"]';
	        }
	
	    };
	
	    hasher.initialized.memorize = true; //see #33
	
	    return hasher;
		
		}(window));
	
	
	    return hasher;
		};
		
		if (typeof define === 'function' && define.amd) {
	    define(['signals'], factory);
		} else if (typeof exports === 'object') {
	    module.exports = factory(require('signals'));
		} else {
	    /*jshint sub:true */
	    window['hasher'] = factory(window['signals']);
		}
		
		}());
		
		},
		{"signals":"node_modules/hasher/node_modules/signals/dist/signals.js"}],
	
	"node_modules/hasher/node_modules/signals/dist/signals.js":[function(require,module,exports){
		arguments[4]["node_modules/crossroads/node_modules/signals/dist/signals.js"][0].apply(exports,arguments)
		},
		{}],
	
	"node_modules/localforage/node_modules/promise/core.js":[function(require,module,exports){
		'use strict';
		
		var asap = require('asap')
		
		module.exports = Promise
		function Promise(fn) {
	  if (typeof this !== 'object') throw new TypeError('Promises must be constructed via new')
	  if (typeof fn !== 'function') throw new TypeError('not a function')
	  var state = null
	  var value = null
	  var deferreds = []
	  var self = this
	
	  this.then = function(onFulfilled, onRejected) {
	    return new Promise(function(resolve, reject) {
	      handle(new Handler(onFulfilled, onRejected, resolve, reject))
	    })
	  }
	
	  function handle(deferred) {
	    if (state === null) {
	      deferreds.push(deferred)
	      return
	    }
	    asap(function() {
	      var cb = state ? deferred.onFulfilled : deferred.onRejected
	      if (cb === null) {
	        (state ? deferred.resolve : deferred.reject)(value)
	        return
	      }
	      var ret
	      try {
	        ret = cb(value)
	      }
	      catch (e) {
	        deferred.reject(e)
	        return
	      }
	      deferred.resolve(ret)
	    })
	  }
	
	  function resolve(newValue) {
	    try { //Promise Resolution Procedure: https://github.com/promises-aplus/promises-spec#the-promise-resolution-procedure
	      if (newValue === self) throw new TypeError('A promise cannot be resolved with itself.')
	      if (newValue && (typeof newValue === 'object' || typeof newValue === 'function')) {
	        var then = newValue.then
	        if (typeof then === 'function') {
	          doResolve(then.bind(newValue), resolve, reject)
	          return
	        }
	      }
	      state = true
	      value = newValue
	      finale()
	    } catch (e) { reject(e) }
	  }
	
	  function reject(newValue) {
	    state = false
	    value = newValue
	    finale()
	  }
	
	  function finale() {
	    for (var i = 0, len = deferreds.length; i < len; i++)
	      handle(deferreds[i])
	    deferreds = null
	  }
	
	  doResolve(fn, resolve, reject)
		}
		
		
		function Handler(onFulfilled, onRejected, resolve, reject){
	  this.onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : null
	  this.onRejected = typeof onRejected === 'function' ? onRejected : null
	  this.resolve = resolve
	  this.reject = reject
		}
		
		/**
	 * Take a potentially misbehaving resolver function and make sure
	 * onFulfilled and onRejected are only called once.
	 *
	 * Makes no guarantees about asynchrony.
	 */
		function doResolve(fn, onFulfilled, onRejected) {
	  var done = false;
	  try {
	    fn(function (value) {
	      if (done) return
	      done = true
	      onFulfilled(value)
	    }, function (reason) {
	      if (done) return
	      done = true
	      onRejected(reason)
	    })
	  } catch (ex) {
	    if (done) return
	    done = true
	    onRejected(ex)
	  }
		}
		
		},
		{"asap":"node_modules/localforage/node_modules/promise/node_modules/asap/asap.js"}],
		
	"node_modules/localforage/node_modules/promise/index.js":[function(require,module,exports){
		'use strict';
		
		//This file contains then/promise specific extensions to the core promise API
		
		var Promise = require('./core.js')
		var asap = require('asap')
		
		module.exports = Promise
		
		/* Static Functions */
		
		function ValuePromise(value) {
	  this.then = function (onFulfilled) {
	    if (typeof onFulfilled !== 'function') return this
	    return new Promise(function (resolve, reject) {
	      asap(function () {
	        try {
	          resolve(onFulfilled(value))
	        } catch (ex) {
	          reject(ex);
	        }
	      })
	    })
	  }
		}
		ValuePromise.prototype = Object.create(Promise.prototype)
		
		var TRUE = new ValuePromise(true)
		var FALSE = new ValuePromise(false)
		var NULL = new ValuePromise(null)
		var UNDEFINED = new ValuePromise(undefined)
		var ZERO = new ValuePromise(0)
		var EMPTYSTRING = new ValuePromise('')
		
		Promise.resolve = function (value) {
	  if (value instanceof Promise) return value
	
	  if (value === null) return NULL
	  if (value === undefined) return UNDEFINED
	  if (value === true) return TRUE
	  if (value === false) return FALSE
	  if (value === 0) return ZERO
	  if (value === '') return EMPTYSTRING
	
	  if (typeof value === 'object' || typeof value === 'function') {
	    try {
	      var then = value.then
	      if (typeof then === 'function') {
	        return new Promise(then.bind(value))
	      }
	    } catch (ex) {
	      return new Promise(function (resolve, reject) {
	        reject(ex)
	      })
	    }
	  }
	
	  return new ValuePromise(value)
		}
		
		Promise.from = Promise.cast = function (value) {
	  var err = new Error('Promise.from and Promise.cast are deprecated, use Promise.resolve instead')
	  err.name = 'Warning'
	  console.warn(err.stack)
	  return Promise.resolve(value)
		}
		
		Promise.denodeify = function (fn, argumentCount) {
	  argumentCount = argumentCount || Infinity
	  return function () {
	    var self = this
	    var args = Array.prototype.slice.call(arguments)
	    return new Promise(function (resolve, reject) {
	      while (args.length && args.length > argumentCount) {
	        args.pop()
	      }
	      args.push(function (err, res) {
	        if (err) reject(err)
	        else resolve(res)
	      })
	      fn.apply(self, args)
	    })
	  }
		}
		Promise.nodeify = function (fn) {
	  return function () {
	    var args = Array.prototype.slice.call(arguments)
	    var callback = typeof args[args.length - 1] === 'function' ? args.pop() : null
	    try {
	      return fn.apply(this, arguments).nodeify(callback)
	    } catch (ex) {
	      if (callback === null || typeof callback == 'undefined') {
	        return new Promise(function (resolve, reject) { reject(ex) })
	      } else {
	        asap(function () {
	          callback(ex)
	        })
	      }
	    }
	  }
		}
		
		Promise.all = function () {
	  var calledWithArray = arguments.length === 1 && Array.isArray(arguments[0])
	  var args = Array.prototype.slice.call(calledWithArray ? arguments[0] : arguments)
	
	  if (!calledWithArray) {
	    var err = new Error('Promise.all should be called with a single array, calling it with multiple arguments is deprecated')
	    err.name = 'Warning'
	    console.warn(err.stack)
	  }
	
	  return new Promise(function (resolve, reject) {
	    if (args.length === 0) return resolve([])
	    var remaining = args.length
	    function res(i, val) {
	      try {
	        if (val && (typeof val === 'object' || typeof val === 'function')) {
	          var then = val.then
	          if (typeof then === 'function') {
	            then.call(val, function (val) { res(i, val) }, reject)
	            return
	          }
	        }
	        args[i] = val
	        if (--remaining === 0) {
	          resolve(args);
	        }
	      } catch (ex) {
	        reject(ex)
	      }
	    }
	    for (var i = 0; i < args.length; i++) {
	      res(i, args[i])
	    }
	  })
		}
		
		Promise.reject = function (value) {
	  return new Promise(function (resolve, reject) { 
	    reject(value);
	  });
		}
		
		Promise.race = function (values) {
	  return new Promise(function (resolve, reject) { 
	    values.forEach(function(value){
	      Promise.resolve(value).then(resolve, reject);
	    })
	  });
		}
		
		/* Prototype Methods */
		
		Promise.prototype.done = function (onFulfilled, onRejected) {
	  var self = arguments.length ? this.then.apply(this, arguments) : this
	  self.then(null, function (err) {
	    asap(function () {
	      throw err
	    })
	  })
		}
		
		Promise.prototype.nodeify = function (callback) {
	  if (typeof callback != 'function') return this
	
	  this.then(function (value) {
	    asap(function () {
	      callback(null, value)
	    })
	  }, function (err) {
	    asap(function () {
	      callback(err)
	    })
	  })
		}
		
		Promise.prototype['catch'] = function (onRejected) {
	  return this.then(null, onRejected);
		}
		
		},
		{"./core.js":"node_modules/localforage/node_modules/promise/core.js",
		"asap":"node_modules/localforage/node_modules/promise/node_modules/asap/asap.js"}],
		
	"node_modules/localforage/node_modules/promise/node_modules/asap/asap.js":[function(require,module,exports){
	(function (process){
	
	// Use the fastest possible means to execute a task in a future turn
	// of the event loop.
	
	// linked list of tasks (single, with head node)
	var head = {task: void 0, next: null};
	var tail = head;
	var flushing = false;
	var requestFlush = void 0;
	var isNodeJS = false;
	
	function flush() {
    /* jshint loopfunc: true */

    while (head.next) {
        head = head.next;
        var task = head.task;
        head.task = void 0;
        var domain = head.domain;

        if (domain) {
            head.domain = void 0;
            domain.enter();
        }

        try {
            task();

        } catch (e) {
            if (isNodeJS) {
                // In node, uncaught exceptions are considered fatal errors.
                // Re-throw them synchronously to interrupt flushing!

                // Ensure continuation if the uncaught exception is suppressed
                // listening "uncaughtException" events (as domains does).
                // Continue in next event to avoid tick recursion.
                if (domain) {
                    domain.exit();
                }
                setTimeout(flush, 0);
                if (domain) {
                    domain.enter();
                }

                throw e;

            } else {
                // In browsers, uncaught exceptions are not fatal.
                // Re-throw them asynchronously to avoid slow-downs.
                setTimeout(function() {
                   throw e;
                }, 0);
            }
        }

        if (domain) {
            domain.exit();
        }
    }

    flushing = false;
	}
	
	if (typeof process !== "undefined" && process.nextTick) {
    // Node.js before 0.9. Note that some fake-Node environments, like the
    // Mocha test runner, introduce a `process` global without a `nextTick`.
    isNodeJS = true;

    requestFlush = function () {
        process.nextTick(flush);
    };
	
	} else if (typeof setImmediate === "function") {
    // In IE10, Node.js 0.9+, or https://github.com/NobleJS/setImmediate
    if (typeof window !== "undefined") {
        requestFlush = setImmediate.bind(window, flush);
    } else {
        requestFlush = function () {
            setImmediate(flush);
        };
    }
	
	} else if (typeof MessageChannel !== "undefined") {
    // modern browsers
    // http://www.nonblocking.io/2011/06/windownexttick.html
    var channel = new MessageChannel();
    channel.port1.onmessage = flush;
    requestFlush = function () {
        channel.port2.postMessage(0);
    };
	
	} else {
    // old browsers
    requestFlush = function () {
        setTimeout(flush, 0);
    };
	}
	
	function asap(task) {
    tail = tail.next = {
        task: task,
        domain: isNodeJS && process.domain,
        next: null
    };

    if (!flushing) {
        flushing = true;
        requestFlush();
    }
	};
	
	module.exports = asap;
	
	
	}).call(this,require('_process'))
	},
	{"_process":"node_modules/gulpfile/node_modules/browserify/node_modules/process/browser.js"}],
	
	"node_modules/localforage/src/drivers/indexeddb.js":[function(require,module,exports){
	// Some code originally from async_storage.js in
	// [Gaia](https://github.com/mozilla-b2g/gaia).
	(function() {
    'use strict';

    // Originally found in https://github.com/mozilla-b2g/gaia/blob/e8f624e4cc9ea945727278039b3bc9bcb9f8667a/shared/js/async_storage.js

    // Promises!
    var Promise = (typeof module !== 'undefined' && module.exports) ?
                  require('promise') : this.Promise;

    // Initialize IndexedDB; fall back to vendor-prefixed versions if needed.
    var indexedDB = indexedDB || this.indexedDB || this.webkitIndexedDB ||
                    this.mozIndexedDB || this.OIndexedDB ||
                    this.msIndexedDB;

    // If IndexedDB isn't available, we get outta here!
    if (!indexedDB) {
        return;
    }

    // Open the IndexedDB database (automatically creates one if one didn't
    // previously exist), using any options set in the config.
    function _initStorage(options) {
        var self = this;
        var dbInfo = {
            db: null
        };

        if (options) {
            for (var i in options) {
                dbInfo[i] = options[i];
            }
        }

        return new Promise(function(resolve, reject) {
            var openreq = indexedDB.open(dbInfo.name, dbInfo.version);
            openreq.onerror = function() {
                reject(openreq.error);
            };
            openreq.onupgradeneeded = function() {
                // First time setup: create an empty object store
                openreq.result.createObjectStore(dbInfo.storeName);
            };
            openreq.onsuccess = function() {
                dbInfo.db = openreq.result;
                self._dbInfo = dbInfo;
                resolve();
            };
        });
    }

    function getItem(key, callback) {
        var self = this;

        // Cast the key to a string, as that's all we can set as a key.
        if (typeof key !== 'string') {
            window.console.warn(key +
                                ' used as a key, but it is not a string.');
            key = String(key);
        }

        var promise = new Promise(function(resolve, reject) {
            self.ready().then(function() {
                var dbInfo = self._dbInfo;
                var store = dbInfo.db.transaction(dbInfo.storeName, 'readonly')
                    .objectStore(dbInfo.storeName);
                var req = store.get(key);

                req.onsuccess = function() {
                    var value = req.result;
                    if (value === undefined) {
                        value = null;
                    }

                    resolve(value);
                };

                req.onerror = function() {
                    reject(req.error);
                };
            }).catch(reject);
        });

        executeDeferedCallback(promise, callback);
        return promise;
    }

    // Iterate over all items stored in database.
    function iterate(iterator, callback) {
        var self = this;

        var promise = new Promise(function(resolve, reject) {
            self.ready().then(function() {
                var dbInfo = self._dbInfo;
                var store = dbInfo.db.transaction(dbInfo.storeName, 'readonly')
                                     .objectStore(dbInfo.storeName);

                var req = store.openCursor();

                req.onsuccess = function() {
                    var cursor = req.result;

                    if (cursor) {
                        var result = iterator(cursor.value, cursor.key);

                        if (result !== void(0)) {
                            resolve(result);
                        } else {
                            cursor.continue();
                        }
                    } else {
                        resolve();
                    }
                };

                req.onerror = function() {
                    reject(req.error);
                };
            }).catch(reject);
        });

        executeDeferedCallback(promise, callback);

        return promise;
    }

    function setItem(key, value, callback) {
        var self = this;

        // Cast the key to a string, as that's all we can set as a key.
        if (typeof key !== 'string') {
            window.console.warn(key +
                                ' used as a key, but it is not a string.');
            key = String(key);
        }

        var promise = new Promise(function(resolve, reject) {
            self.ready().then(function() {
                var dbInfo = self._dbInfo;
                var store = dbInfo.db.transaction(dbInfo.storeName, 'readwrite')
                              .objectStore(dbInfo.storeName);

                // The reason we don't _save_ null is because IE 10 does
                // not support saving the `null` type in IndexedDB. How
                // ironic, given the bug below!
                // See: https://github.com/mozilla/localForage/issues/161
                if (value === null) {
                    value = undefined;
                }

                var req = store.put(value, key);
                req.onsuccess = function() {
                    // Cast to undefined so the value passed to
                    // callback/promise is the same as what one would get out
                    // of `getItem()` later. This leads to some weirdness
                    // (setItem('foo', undefined) will return `null`), but
                    // it's not my fault localStorage is our baseline and that
                    // it's weird.
                    if (value === undefined) {
                        value = null;
                    }

                    resolve(value);
                };
                req.onerror = function() {
                    reject(req.error);
                };
            }).catch(reject);
        });

        executeDeferedCallback(promise, callback);
        return promise;
    }

    function removeItem(key, callback) {
        var self = this;

        // Cast the key to a string, as that's all we can set as a key.
        if (typeof key !== 'string') {
            window.console.warn(key +
                                ' used as a key, but it is not a string.');
            key = String(key);
        }

        var promise = new Promise(function(resolve, reject) {
            self.ready().then(function() {
                var dbInfo = self._dbInfo;
                var store = dbInfo.db.transaction(dbInfo.storeName, 'readwrite')
                              .objectStore(dbInfo.storeName);

                // We use a Grunt task to make this safe for IE and some
                // versions of Android (including those used by Cordova).
                // Normally IE won't like `.delete()` and will insist on
                // using `['delete']()`, but we have a build step that
                // fixes this for us now.
                var req = store.delete(key);
                req.onsuccess = function() {
                    resolve();
                };

                req.onerror = function() {
                    reject(req.error);
                };

                // The request will be aborted if we've exceeded our storage
                // space. In this case, we will reject with a specific
                // "QuotaExceededError".
                req.onabort = function(event) {
                    var error = event.target.error;
                    if (error === 'QuotaExceededError') {
                        reject(error);
                    }
                };
            }).catch(reject);
        });

        executeDeferedCallback(promise, callback);
        return promise;
    }

    function clear(callback) {
        var self = this;

        var promise = new Promise(function(resolve, reject) {
            self.ready().then(function() {
                var dbInfo = self._dbInfo;
                var store = dbInfo.db.transaction(dbInfo.storeName, 'readwrite')
                              .objectStore(dbInfo.storeName);
                var req = store.clear();

                req.onsuccess = function() {
                    resolve();
                };

                req.onerror = function() {
                    reject(req.error);
                };
            }).catch(reject);
        });

        executeDeferedCallback(promise, callback);
        return promise;
    }

    function length(callback) {
        var self = this;

        var promise = new Promise(function(resolve, reject) {
            self.ready().then(function() {
                var dbInfo = self._dbInfo;
                var store = dbInfo.db.transaction(dbInfo.storeName, 'readonly')
                              .objectStore(dbInfo.storeName);
                var req = store.count();

                req.onsuccess = function() {
                    resolve(req.result);
                };

                req.onerror = function() {
                    reject(req.error);
                };
            }).catch(reject);
        });

        executeCallback(promise, callback);
        return promise;
    }

    function key(n, callback) {
        var self = this;

        var promise = new Promise(function(resolve, reject) {
            if (n < 0) {
                resolve(null);

                return;
            }

            self.ready().then(function() {
                var dbInfo = self._dbInfo;
                var store = dbInfo.db.transaction(dbInfo.storeName, 'readonly')
                              .objectStore(dbInfo.storeName);

                var advanced = false;
                var req = store.openCursor();
                req.onsuccess = function() {
                    var cursor = req.result;
                    if (!cursor) {
                        // this means there weren't enough keys
                        resolve(null);

                        return;
                    }

                    if (n === 0) {
                        // We have the first key, return it if that's what they
                        // wanted.
                        resolve(cursor.key);
                    } else {
                        if (!advanced) {
                            // Otherwise, ask the cursor to skip ahead n
                            // records.
                            advanced = true;
                            cursor.advance(n);
                        } else {
                            // When we get here, we've got the nth key.
                            resolve(cursor.key);
                        }
                    }
                };

                req.onerror = function() {
                    reject(req.error);
                };
            }).catch(reject);
        });

        executeCallback(promise, callback);
        return promise;
    }

    function keys(callback) {
        var self = this;

        var promise = new Promise(function(resolve, reject) {
            self.ready().then(function() {
                var dbInfo = self._dbInfo;
                var store = dbInfo.db.transaction(dbInfo.storeName, 'readonly')
                              .objectStore(dbInfo.storeName);

                var req = store.openCursor();
                var keys = [];

                req.onsuccess = function() {
                    var cursor = req.result;

                    if (!cursor) {
                        resolve(keys);
                        return;
                    }

                    keys.push(cursor.key);
                    cursor.continue();
                };

                req.onerror = function() {
                    reject(req.error);
                };
            }).catch(reject);
        });

        executeCallback(promise, callback);
        return promise;
    }

    function executeCallback(promise, callback) {
        if (callback) {
            promise.then(function(result) {
                callback(null, result);
            }, function(error) {
                callback(error);
            });
        }
    }

    function executeDeferedCallback(promise, callback) {
        if (callback) {
            promise.then(function(result) {
                deferCallback(callback, result);
            }, function(error) {
                callback(error);
            });
        }
    }

    // Under Chrome the callback is called before the changes (save, clear)
    // are actually made. So we use a defer function which wait that the
    // call stack to be empty.
    // For more info : https://github.com/mozilla/localForage/issues/175
    // Pull request : https://github.com/mozilla/localForage/pull/178
    function deferCallback(callback, result) {
        if (callback) {
            return setTimeout(function() {
                return callback(null, result);
            }, 0);
        }
    }

    var asyncStorage = {
        _driver: 'asyncStorage',
        _initStorage: _initStorage,
        iterate: iterate,
        getItem: getItem,
        setItem: setItem,
        removeItem: removeItem,
        clear: clear,
        length: length,
        key: key,
        keys: keys
    };

    if (typeof define === 'function' && define.amd) {
        define('asyncStorage', function() {
            return asyncStorage;
        });
    } else if (typeof module !== 'undefined' && module.exports) {
        module.exports = asyncStorage;
    } else {
        this.asyncStorage = asyncStorage;
    }
	}).call(window);
	
	},
	{"promise":"node_modules/localforage/node_modules/promise/index.js"}],
	
	"node_modules/localforage/src/drivers/localstorage.js":[function(require,module,exports){
	// If IndexedDB isn't available, we'll fall back to localStorage.
	// Note that this will have considerable performance and storage
	// side-effects (all data will be serialized on save and only data that
	// can be converted to a string via `JSON.stringify()` will be saved).
	(function() {
    'use strict';

    // Promises!
    var Promise = (typeof module !== 'undefined' && module.exports) ?
                  require('promise') : this.Promise;
    var localStorage = null;

    // If the app is running inside a Google Chrome packaged webapp, or some
    // other context where localStorage isn't available, we don't use
    // localStorage. This feature detection is preferred over the old
    // `if (window.chrome && window.chrome.runtime)` code.
    // See: https://github.com/mozilla/localForage/issues/68
    try {
        // If localStorage isn't available, we get outta here!
        // This should be inside a try catch
        if (!this.localStorage || !('setItem' in this.localStorage)) {
            return;
        }
        // Initialize localStorage and create a variable to use throughout
        // the code.
        localStorage = this.localStorage;
    } catch (e) {
        return;
    }

    // Config the localStorage backend, using options set in the config.
    function _initStorage(options) {
        var self = this;
        var dbInfo = {};
        if (options) {
            for (var i in options) {
                dbInfo[i] = options[i];
            }
        }

        dbInfo.keyPrefix = dbInfo.name + '/';

        self._dbInfo = dbInfo;
        return Promise.resolve();
    }

    var SERIALIZED_MARKER = '__lfsc__:';
    var SERIALIZED_MARKER_LENGTH = SERIALIZED_MARKER.length;

    // OMG the serializations!
    var TYPE_ARRAYBUFFER = 'arbf';
    var TYPE_BLOB = 'blob';
    var TYPE_INT8ARRAY = 'si08';
    var TYPE_UINT8ARRAY = 'ui08';
    var TYPE_UINT8CLAMPEDARRAY = 'uic8';
    var TYPE_INT16ARRAY = 'si16';
    var TYPE_INT32ARRAY = 'si32';
    var TYPE_UINT16ARRAY = 'ur16';
    var TYPE_UINT32ARRAY = 'ui32';
    var TYPE_FLOAT32ARRAY = 'fl32';
    var TYPE_FLOAT64ARRAY = 'fl64';
    var TYPE_SERIALIZED_MARKER_LENGTH = SERIALIZED_MARKER_LENGTH +
                                        TYPE_ARRAYBUFFER.length;

    // Remove all keys from the datastore, effectively destroying all data in
    // the app's key/value store!
    function clear(callback) {
        var self = this;
        var promise = new Promise(function(resolve, reject) {
            self.ready().then(function() {
                var keyPrefix = self._dbInfo.keyPrefix;

                for (var i = localStorage.length - 1; i >= 0; i--) {
                    var key = localStorage.key(i);

                    if (key.indexOf(keyPrefix) === 0) {
                        localStorage.removeItem(key);
                    }
                }

                resolve();
            }).catch(reject);
        });

        executeCallback(promise, callback);
        return promise;
    }

    // Retrieve an item from the store. Unlike the original async_storage
    // library in Gaia, we don't modify return values at all. If a key's value
    // is `undefined`, we pass that value to the callback function.
    function getItem(key, callback) {
        var self = this;

        // Cast the key to a string, as that's all we can set as a key.
        if (typeof key !== 'string') {
            window.console.warn(key +
                                ' used as a key, but it is not a string.');
            key = String(key);
        }

        var promise = new Promise(function(resolve, reject) {
            self.ready().then(function() {
                try {
                    var dbInfo = self._dbInfo;
                    var result = localStorage.getItem(dbInfo.keyPrefix + key);

                    // If a result was found, parse it from the serialized
                    // string into a JS object. If result isn't truthy, the key
                    // is likely undefined and we'll pass it straight to the
                    // callback.
                    if (result) {
                        result = _deserialize(result);
                    }

                    resolve(result);
                } catch (e) {
                    reject(e);
                }
            }).catch(reject);
        });

        executeCallback(promise, callback);
        return promise;
    }

    // Iterate over all items in the store.
    function iterate(iterator, callback) {
        var self = this;

        var promise = new Promise(function(resolve, reject) {
            self.ready().then(function() {
                try {
                    var keyPrefix = self._dbInfo.keyPrefix;
                    var keyPrefixLength = keyPrefix.length;
                    var length = localStorage.length;

                    for (var i = 0; i < length; i++) {
                        var key = localStorage.key(i);
                        var value = localStorage.getItem(key);

                        // If a result was found, parse it from the serialized
                        // string into a JS object. If result isn't truthy, the
                        // key is likely undefined and we'll pass it straight
                        // to the iterator.
                        if (value) {
                            value = _deserialize(value);
                        }

                        value = iterator(value, key.substring(keyPrefixLength));

                        if (value !== void(0)) {
                            resolve(value);
                            return;
                        }
                    }

                    resolve();
                } catch (e) {
                    reject(e);
                }
            }).catch(reject);
        });

        executeCallback(promise, callback);
        return promise;
    }

    // Same as localStorage's key() method, except takes a callback.
    function key(n, callback) {
        var self = this;
        var promise = new Promise(function(resolve, reject) {
            self.ready().then(function() {
                var dbInfo = self._dbInfo;
                var result;
                try {
                    result = localStorage.key(n);
                } catch (error) {
                    result = null;
                }

                // Remove the prefix from the key, if a key is found.
                if (result) {
                    result = result.substring(dbInfo.keyPrefix.length);
                }

                resolve(result);
            }).catch(reject);
        });

        executeCallback(promise, callback);
        return promise;
    }

    function keys(callback) {
        var self = this;
        var promise = new Promise(function(resolve, reject) {
            self.ready().then(function() {
                var dbInfo = self._dbInfo;
                var length = localStorage.length;
                var keys = [];

                for (var i = 0; i < length; i++) {
                    if (localStorage.key(i).indexOf(dbInfo.keyPrefix) === 0) {
                        keys.push(localStorage.key(i).substring(dbInfo.keyPrefix.length));
                    }
                }

                resolve(keys);
            }).catch(reject);
        });

        executeCallback(promise, callback);
        return promise;
    }

    // Supply the number of keys in the datastore to the callback function.
    function length(callback) {
        var self = this;
        var promise = new Promise(function(resolve, reject) {
            self.keys().then(function(keys) {
                resolve(keys.length);
            }).catch(reject);
        });

        executeCallback(promise, callback);
        return promise;
    }

    // Remove an item from the store, nice and simple.
    function removeItem(key, callback) {
        var self = this;

        // Cast the key to a string, as that's all we can set as a key.
        if (typeof key !== 'string') {
            window.console.warn(key +
                                ' used as a key, but it is not a string.');
            key = String(key);
        }

        var promise = new Promise(function(resolve, reject) {
            self.ready().then(function() {
                var dbInfo = self._dbInfo;
                localStorage.removeItem(dbInfo.keyPrefix + key);

                resolve();
            }).catch(reject);
        });

        executeCallback(promise, callback);
        return promise;
    }

    // Deserialize data we've inserted into a value column/field. We place
    // special markers into our strings to mark them as encoded; this isn't
    // as nice as a meta field, but it's the only sane thing we can do whilst
    // keeping localStorage support intact.
    //
    // Oftentimes this will just deserialize JSON content, but if we have a
    // special marker (SERIALIZED_MARKER, defined above), we will extract
    // some kind of arraybuffer/binary data/typed array out of the string.
    function _deserialize(value) {
        // If we haven't marked this string as being specially serialized (i.e.
        // something other than serialized JSON), we can just return it and be
        // done with it.
        if (value.substring(0,
            SERIALIZED_MARKER_LENGTH) !== SERIALIZED_MARKER) {
            return JSON.parse(value);
        }

        // The following code deals with deserializing some kind of Blob or
        // TypedArray. First we separate out the type of data we're dealing
        // with from the data itself.
        var serializedString = value.substring(TYPE_SERIALIZED_MARKER_LENGTH);
        var type = value.substring(SERIALIZED_MARKER_LENGTH,
                                   TYPE_SERIALIZED_MARKER_LENGTH);

        // Fill the string into a ArrayBuffer.
        // 2 bytes for each char.
        var buffer = new ArrayBuffer(serializedString.length * 2);
        var bufferView = new Uint16Array(buffer);
        for (var i = serializedString.length - 1; i >= 0; i--) {
            bufferView[i] = serializedString.charCodeAt(i);
        }

        // Return the right type based on the code/type set during
        // serialization.
        switch (type) {
            case TYPE_ARRAYBUFFER:
                return buffer;
            case TYPE_BLOB:
                return new Blob([buffer]);
            case TYPE_INT8ARRAY:
                return new Int8Array(buffer);
            case TYPE_UINT8ARRAY:
                return new Uint8Array(buffer);
            case TYPE_UINT8CLAMPEDARRAY:
                return new Uint8ClampedArray(buffer);
            case TYPE_INT16ARRAY:
                return new Int16Array(buffer);
            case TYPE_UINT16ARRAY:
                return new Uint16Array(buffer);
            case TYPE_INT32ARRAY:
                return new Int32Array(buffer);
            case TYPE_UINT32ARRAY:
                return new Uint32Array(buffer);
            case TYPE_FLOAT32ARRAY:
                return new Float32Array(buffer);
            case TYPE_FLOAT64ARRAY:
                return new Float64Array(buffer);
            default:
                throw new Error('Unkown type: ' + type);
        }
    }

    // Converts a buffer to a string to store, serialized, in the backend
    // storage library.
    function _bufferToString(buffer) {
        var str = '';
        var uint16Array = new Uint16Array(buffer);

        try {
            str = String.fromCharCode.apply(null, uint16Array);
        } catch (e) {
            // This is a fallback implementation in case the first one does
            // not work. This is required to get the phantomjs passing...
            for (var i = 0; i < uint16Array.length; i++) {
                str += String.fromCharCode(uint16Array[i]);
            }
        }

        return str;
    }

    // Serialize a value, afterwards executing a callback (which usually
    // instructs the `setItem()` callback/promise to be executed). This is how
    // we store binary data with localStorage.
    function _serialize(value, callback) {
        var valueString = '';
        if (value) {
            valueString = value.toString();
        }

        // Cannot use `value instanceof ArrayBuffer` or such here, as these
        // checks fail when running the tests using casper.js...
        //
        // TODO: See why those tests fail and use a better solution.
        if (value && (value.toString() === '[object ArrayBuffer]' ||
                      value.buffer &&
                      value.buffer.toString() === '[object ArrayBuffer]')) {
            // Convert binary arrays to a string and prefix the string with
            // a special marker.
            var buffer;
            var marker = SERIALIZED_MARKER;

            if (value instanceof ArrayBuffer) {
                buffer = value;
                marker += TYPE_ARRAYBUFFER;
            } else {
                buffer = value.buffer;

                if (valueString === '[object Int8Array]') {
                    marker += TYPE_INT8ARRAY;
                } else if (valueString === '[object Uint8Array]') {
                    marker += TYPE_UINT8ARRAY;
                } else if (valueString === '[object Uint8ClampedArray]') {
                    marker += TYPE_UINT8CLAMPEDARRAY;
                } else if (valueString === '[object Int16Array]') {
                    marker += TYPE_INT16ARRAY;
                } else if (valueString === '[object Uint16Array]') {
                    marker += TYPE_UINT16ARRAY;
                } else if (valueString === '[object Int32Array]') {
                    marker += TYPE_INT32ARRAY;
                } else if (valueString === '[object Uint32Array]') {
                    marker += TYPE_UINT32ARRAY;
                } else if (valueString === '[object Float32Array]') {
                    marker += TYPE_FLOAT32ARRAY;
                } else if (valueString === '[object Float64Array]') {
                    marker += TYPE_FLOAT64ARRAY;
                } else {
                    callback(new Error('Failed to get type for BinaryArray'));
                }
            }

            callback(marker + _bufferToString(buffer));
        } else if (valueString === '[object Blob]') {
            // Conver the blob to a binaryArray and then to a string.
            var fileReader = new FileReader();

            fileReader.onload = function() {
                var str = _bufferToString(this.result);

                callback(SERIALIZED_MARKER + TYPE_BLOB + str);
            };

            fileReader.readAsArrayBuffer(value);
        } else {
            try {
                callback(JSON.stringify(value));
            } catch (e) {
                window.console.error("Couldn't convert value into a JSON " +
                                     'string: ', value);

                callback(e);
            }
        }
    }

    // Set a key's value and run an optional callback once the value is set.
    // Unlike Gaia's implementation, the callback function is passed the value,
    // in case you want to operate on that value only after you're sure it
    // saved, or something like that.
    function setItem(key, value, callback) {
        var self = this;

        // Cast the key to a string, as that's all we can set as a key.
        if (typeof key !== 'string') {
            window.console.warn(key +
                                ' used as a key, but it is not a string.');
            key = String(key);
        }

        var promise = new Promise(function(resolve, reject) {
            self.ready().then(function() {
                // Convert undefined values to null.
                // https://github.com/mozilla/localForage/pull/42
                if (value === undefined) {
                    value = null;
                }

                // Save the original value to pass to the callback.
                var originalValue = value;

                _serialize(value, function(value, error) {
                    if (error) {
                        reject(error);
                    } else {
                        try {
                            var dbInfo = self._dbInfo;
                            localStorage.setItem(dbInfo.keyPrefix + key, value);
                        } catch (e) {
                            // localStorage capacity exceeded.
                            // TODO: Make this a specific error/event.
                            if (e.name === 'QuotaExceededError' ||
                                e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
                                reject(e);
                            }
                        }

                        resolve(originalValue);
                    }
                });
            }).catch(reject);
        });

        executeCallback(promise, callback);
        return promise;
    }

    function executeCallback(promise, callback) {
        if (callback) {
            promise.then(function(result) {
                callback(null, result);
            }, function(error) {
                callback(error);
            });
        }
    }

    var localStorageWrapper = {
        _driver: 'localStorageWrapper',
        _initStorage: _initStorage,
        // Default API, from Gaia/localStorage.
        iterate: iterate,
        getItem: getItem,
        setItem: setItem,
        removeItem: removeItem,
        clear: clear,
        length: length,
        key: key,
        keys: keys
    };

    if (typeof define === 'function' && define.amd) {
        define('localStorageWrapper', function() {
            return localStorageWrapper;
        });
    } else if (typeof module !== 'undefined' && module.exports) {
        module.exports = localStorageWrapper;
    } else {
        this.localStorageWrapper = localStorageWrapper;
    }
	}).call(window);
	
	},
	{"promise":"node_modules/localforage/node_modules/promise/index.js"}],
	
	"node_modules/localforage/src/drivers/websql.js":[function(require,module,exports){
	/*
 * Includes code from:
 *
 * base64-arraybuffer
 * https://github.com/niklasvh/base64-arraybuffer
 *
 * Copyright (c) 2012 Niklas von Hertzen
 * Licensed under the MIT license.
 */
	(function() {
    'use strict';

    // Sadly, the best way to save binary data in WebSQL is Base64 serializing
    // it, so this is how we store it to prevent very strange errors with less
    // verbose ways of binary <-> string data storage.
    var BASE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

    // Promises!
    var Promise = (typeof module !== 'undefined' && module.exports) ?
                  require('promise') : this.Promise;

    var openDatabase = this.openDatabase;

    var SERIALIZED_MARKER = '__lfsc__:';
    var SERIALIZED_MARKER_LENGTH = SERIALIZED_MARKER.length;

    // OMG the serializations!
    var TYPE_ARRAYBUFFER = 'arbf';
    var TYPE_BLOB = 'blob';
    var TYPE_INT8ARRAY = 'si08';
    var TYPE_UINT8ARRAY = 'ui08';
    var TYPE_UINT8CLAMPEDARRAY = 'uic8';
    var TYPE_INT16ARRAY = 'si16';
    var TYPE_INT32ARRAY = 'si32';
    var TYPE_UINT16ARRAY = 'ur16';
    var TYPE_UINT32ARRAY = 'ui32';
    var TYPE_FLOAT32ARRAY = 'fl32';
    var TYPE_FLOAT64ARRAY = 'fl64';
    var TYPE_SERIALIZED_MARKER_LENGTH = SERIALIZED_MARKER_LENGTH +
                                        TYPE_ARRAYBUFFER.length;

    // If WebSQL methods aren't available, we can stop now.
    if (!openDatabase) {
        return;
    }

    // Open the WebSQL database (automatically creates one if one didn't
    // previously exist), using any options set in the config.
    function _initStorage(options) {
        var self = this;
        var dbInfo = {
            db: null
        };

        if (options) {
            for (var i in options) {
                dbInfo[i] = typeof(options[i]) !== 'string' ?
                            options[i].toString() : options[i];
            }
        }

        return new Promise(function(resolve, reject) {
            // Open the database; the openDatabase API will automatically
            // create it for us if it doesn't exist.
            try {
                dbInfo.db = openDatabase(dbInfo.name, String(dbInfo.version),
                                         dbInfo.description, dbInfo.size);
            } catch (e) {
                return self.setDriver('localStorageWrapper')
                    .then(function() {
                        return self._initStorage(options);
                    })
                    .then(resolve)
                    .catch(reject);
            }

            // Create our key/value table if it doesn't exist.
            dbInfo.db.transaction(function(t) {
                t.executeSql('CREATE TABLE IF NOT EXISTS ' + dbInfo.storeName +
                             ' (id INTEGER PRIMARY KEY, key unique, value)', [],
                             function() {
                    self._dbInfo = dbInfo;
                    resolve();
                }, function(t, error) {
                    reject(error);
                });
            });
        });
    }

    function getItem(key, callback) {
        var self = this;

        // Cast the key to a string, as that's all we can set as a key.
        if (typeof key !== 'string') {
            window.console.warn(key +
                                ' used as a key, but it is not a string.');
            key = String(key);
        }

        var promise = new Promise(function(resolve, reject) {
            self.ready().then(function() {
                var dbInfo = self._dbInfo;
                dbInfo.db.transaction(function(t) {
                    t.executeSql('SELECT * FROM ' + dbInfo.storeName +
                                 ' WHERE key = ? LIMIT 1', [key],
                                 function(t, results) {
                        var result = results.rows.length ?
                                     results.rows.item(0).value : null;

                        // Check to see if this is serialized content we need to
                        // unpack.
                        if (result) {
                            result = _deserialize(result);
                        }

                        resolve(result);
                    }, function(t, error) {

                        reject(error);
                    });
                });
            }).catch(reject);
        });

        executeCallback(promise, callback);
        return promise;
    }

    function iterate(iterator, callback) {
        var self = this;

        var promise = new Promise(function(resolve, reject) {
            self.ready().then(function() {
                var dbInfo = self._dbInfo;

                dbInfo.db.transaction(function(t) {
                    t.executeSql('SELECT * FROM ' + dbInfo.storeName, [],
                        function(t, results) {
                            var rows = results.rows;
                            var length = rows.length;

                            for (var i = 0; i < length; i++) {
                                var item = rows.item(i);
                                var result = item.value;

                                // Check to see if this is serialized content
                                // we need to unpack.
                                if (result) {
                                    result = _deserialize(result);
                                }

                                result = iterator(result, item.key);

                                // void(0) prevents problems with redefinition
                                // of `undefined`.
                                if (result !== void(0)) {
                                    resolve(result);
                                    return;
                                }
                            }

                            resolve();
                        }, function(t, error) {
                            reject(error);
                        });
                });
            }).catch(reject);
        });

        executeCallback(promise, callback);
        return promise;
    }

    function setItem(key, value, callback) {
        var self = this;

        // Cast the key to a string, as that's all we can set as a key.
        if (typeof key !== 'string') {
            window.console.warn(key +
                                ' used as a key, but it is not a string.');
            key = String(key);
        }

        var promise = new Promise(function(resolve, reject) {
            self.ready().then(function() {
                // The localStorage API doesn't return undefined values in an
                // "expected" way, so undefined is always cast to null in all
                // drivers. See: https://github.com/mozilla/localForage/pull/42
                if (value === undefined) {
                    value = null;
                }

                // Save the original value to pass to the callback.
                var originalValue = value;

                _serialize(value, function(value, error) {
                    if (error) {
                        reject(error);
                    } else {
                        var dbInfo = self._dbInfo;
                        dbInfo.db.transaction(function(t) {
                            t.executeSql('INSERT OR REPLACE INTO ' +
                                         dbInfo.storeName +
                                         ' (key, value) VALUES (?, ?)',
                                         [key, value], function() {
                                resolve(originalValue);
                            }, function(t, error) {
                                reject(error);
                            });
                        }, function(sqlError) { // The transaction failed; check
                                                // to see if it's a quota error.
                            if (sqlError.code === sqlError.QUOTA_ERR) {
                                // We reject the callback outright for now, but
                                // it's worth trying to re-run the transaction.
                                // Even if the user accepts the prompt to use
                                // more storage on Safari, this error will
                                // be called.
                                //
                                // TODO: Try to re-run the transaction.
                                reject(sqlError);
                            }
                        });
                    }
                });
            }).catch(reject);
        });

        executeCallback(promise, callback);
        return promise;
    }

    function removeItem(key, callback) {
        var self = this;

        // Cast the key to a string, as that's all we can set as a key.
        if (typeof key !== 'string') {
            window.console.warn(key +
                                ' used as a key, but it is not a string.');
            key = String(key);
        }

        var promise = new Promise(function(resolve, reject) {
            self.ready().then(function() {
                var dbInfo = self._dbInfo;
                dbInfo.db.transaction(function(t) {
                    t.executeSql('DELETE FROM ' + dbInfo.storeName +
                                 ' WHERE key = ?', [key], function() {

                        resolve();
                    }, function(t, error) {

                        reject(error);
                    });
                });
            }).catch(reject);
        });

        executeCallback(promise, callback);
        return promise;
    }

    // Deletes every item in the table.
    // TODO: Find out if this resets the AUTO_INCREMENT number.
    function clear(callback) {
        var self = this;

        var promise = new Promise(function(resolve, reject) {
            self.ready().then(function() {
                var dbInfo = self._dbInfo;
                dbInfo.db.transaction(function(t) {
                    t.executeSql('DELETE FROM ' + dbInfo.storeName, [],
                                 function() {
                        resolve();
                    }, function(t, error) {
                        reject(error);
                    });
                });
            }).catch(reject);
        });

        executeCallback(promise, callback);
        return promise;
    }

    // Does a simple `COUNT(key)` to get the number of items stored in
    // localForage.
    function length(callback) {
        var self = this;

        var promise = new Promise(function(resolve, reject) {
            self.ready().then(function() {
                var dbInfo = self._dbInfo;
                dbInfo.db.transaction(function(t) {
                    // Ahhh, SQL makes this one soooooo easy.
                    t.executeSql('SELECT COUNT(key) as c FROM ' +
                                 dbInfo.storeName, [], function(t, results) {
                        var result = results.rows.item(0).c;

                        resolve(result);
                    }, function(t, error) {

                        reject(error);
                    });
                });
            }).catch(reject);
        });

        executeCallback(promise, callback);
        return promise;
    }

    // Return the key located at key index X; essentially gets the key from a
    // `WHERE id = ?`. This is the most efficient way I can think to implement
    // this rarely-used (in my experience) part of the API, but it can seem
    // inconsistent, because we do `INSERT OR REPLACE INTO` on `setItem()`, so
    // the ID of each key will change every time it's updated. Perhaps a stored
    // procedure for the `setItem()` SQL would solve this problem?
    // TODO: Don't change ID on `setItem()`.
    function key(n, callback) {
        var self = this;

        var promise = new Promise(function(resolve, reject) {
            self.ready().then(function() {
                var dbInfo = self._dbInfo;
                dbInfo.db.transaction(function(t) {
                    t.executeSql('SELECT key FROM ' + dbInfo.storeName +
                                 ' WHERE id = ? LIMIT 1', [n + 1],
                                 function(t, results) {
                        var result = results.rows.length ?
                                     results.rows.item(0).key : null;
                        resolve(result);
                    }, function(t, error) {
                        reject(error);
                    });
                });
            }).catch(reject);
        });

        executeCallback(promise, callback);
        return promise;
    }

    function keys(callback) {
        var self = this;

        var promise = new Promise(function(resolve, reject) {
            self.ready().then(function() {
                var dbInfo = self._dbInfo;
                dbInfo.db.transaction(function(t) {
                    t.executeSql('SELECT key FROM ' + dbInfo.storeName, [],
                                 function(t, results) {
                        var keys = [];

                        for (var i = 0; i < results.rows.length; i++) {
                            keys.push(results.rows.item(i).key);
                        }

                        resolve(keys);
                    }, function(t, error) {

                        reject(error);
                    });
                });
            }).catch(reject);
        });

        executeCallback(promise, callback);
        return promise;
    }

    // Converts a buffer to a string to store, serialized, in the backend
    // storage library.
    function _bufferToString(buffer) {
        // base64-arraybuffer
        var bytes = new Uint8Array(buffer);
        var i;
        var base64String = '';

        for (i = 0; i < bytes.length; i += 3) {
            /*jslint bitwise: true */
            base64String += BASE_CHARS[bytes[i] >> 2];
            base64String += BASE_CHARS[((bytes[i] & 3) << 4) | (bytes[i + 1] >> 4)];
            base64String += BASE_CHARS[((bytes[i + 1] & 15) << 2) | (bytes[i + 2] >> 6)];
            base64String += BASE_CHARS[bytes[i + 2] & 63];
        }

        if ((bytes.length % 3) === 2) {
            base64String = base64String.substring(0, base64String.length - 1) + '=';
        } else if (bytes.length % 3 === 1) {
            base64String = base64String.substring(0, base64String.length - 2) + '==';
        }

        return base64String;
    }

    // Deserialize data we've inserted into a value column/field. We place
    // special markers into our strings to mark them as encoded; this isn't
    // as nice as a meta field, but it's the only sane thing we can do whilst
    // keeping localStorage support intact.
    //
    // Oftentimes this will just deserialize JSON content, but if we have a
    // special marker (SERIALIZED_MARKER, defined above), we will extract
    // some kind of arraybuffer/binary data/typed array out of the string.
    function _deserialize(value) {
        // If we haven't marked this string as being specially serialized (i.e.
        // something other than serialized JSON), we can just return it and be
        // done with it.
        if (value.substring(0,
                            SERIALIZED_MARKER_LENGTH) !== SERIALIZED_MARKER) {
            return JSON.parse(value);
        }

        // The following code deals with deserializing some kind of Blob or
        // TypedArray. First we separate out the type of data we're dealing
        // with from the data itself.
        var serializedString = value.substring(TYPE_SERIALIZED_MARKER_LENGTH);
        var type = value.substring(SERIALIZED_MARKER_LENGTH,
                                   TYPE_SERIALIZED_MARKER_LENGTH);

        // Fill the string into a ArrayBuffer.
        var bufferLength = serializedString.length * 0.75;
        var len = serializedString.length;
        var i;
        var p = 0;
        var encoded1, encoded2, encoded3, encoded4;

        if (serializedString[serializedString.length - 1] === '=') {
            bufferLength--;
            if (serializedString[serializedString.length - 2] === '=') {
                bufferLength--;
            }
        }

        var buffer = new ArrayBuffer(bufferLength);
        var bytes = new Uint8Array(buffer);

        for (i = 0; i < len; i+=4) {
            encoded1 = BASE_CHARS.indexOf(serializedString[i]);
            encoded2 = BASE_CHARS.indexOf(serializedString[i+1]);
            encoded3 = BASE_CHARS.indexOf(serializedString[i+2]);
            encoded4 = BASE_CHARS.indexOf(serializedString[i+3]);

            /*jslint bitwise: true */
            bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
            bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
            bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
        }

        // Return the right type based on the code/type set during
        // serialization.
        switch (type) {
            case TYPE_ARRAYBUFFER:
                return buffer;
            case TYPE_BLOB:
                return new Blob([buffer]);
            case TYPE_INT8ARRAY:
                return new Int8Array(buffer);
            case TYPE_UINT8ARRAY:
                return new Uint8Array(buffer);
            case TYPE_UINT8CLAMPEDARRAY:
                return new Uint8ClampedArray(buffer);
            case TYPE_INT16ARRAY:
                return new Int16Array(buffer);
            case TYPE_UINT16ARRAY:
                return new Uint16Array(buffer);
            case TYPE_INT32ARRAY:
                return new Int32Array(buffer);
            case TYPE_UINT32ARRAY:
                return new Uint32Array(buffer);
            case TYPE_FLOAT32ARRAY:
                return new Float32Array(buffer);
            case TYPE_FLOAT64ARRAY:
                return new Float64Array(buffer);
            default:
                throw new Error('Unkown type: ' + type);
        }
    }

    // Serialize a value, afterwards executing a callback (which usually
    // instructs the `setItem()` callback/promise to be executed). This is how
    // we store binary data with localStorage.
    function _serialize(value, callback) {
        var valueString = '';
        if (value) {
            valueString = value.toString();
        }

        // Cannot use `value instanceof ArrayBuffer` or such here, as these
        // checks fail when running the tests using casper.js...
        //
        // TODO: See why those tests fail and use a better solution.
        if (value && (value.toString() === '[object ArrayBuffer]' ||
                      value.buffer &&
                      value.buffer.toString() === '[object ArrayBuffer]')) {
            // Convert binary arrays to a string and prefix the string with
            // a special marker.
            var buffer;
            var marker = SERIALIZED_MARKER;

            if (value instanceof ArrayBuffer) {
                buffer = value;
                marker += TYPE_ARRAYBUFFER;
            } else {
                buffer = value.buffer;

                if (valueString === '[object Int8Array]') {
                    marker += TYPE_INT8ARRAY;
                } else if (valueString === '[object Uint8Array]') {
                    marker += TYPE_UINT8ARRAY;
                } else if (valueString === '[object Uint8ClampedArray]') {
                    marker += TYPE_UINT8CLAMPEDARRAY;
                } else if (valueString === '[object Int16Array]') {
                    marker += TYPE_INT16ARRAY;
                } else if (valueString === '[object Uint16Array]') {
                    marker += TYPE_UINT16ARRAY;
                } else if (valueString === '[object Int32Array]') {
                    marker += TYPE_INT32ARRAY;
                } else if (valueString === '[object Uint32Array]') {
                    marker += TYPE_UINT32ARRAY;
                } else if (valueString === '[object Float32Array]') {
                    marker += TYPE_FLOAT32ARRAY;
                } else if (valueString === '[object Float64Array]') {
                    marker += TYPE_FLOAT64ARRAY;
                } else {
                    callback(new Error('Failed to get type for BinaryArray'));
                }
            }

            callback(marker + _bufferToString(buffer));
        } else if (valueString === '[object Blob]') {
            // Conver the blob to a binaryArray and then to a string.
            var fileReader = new FileReader();

            fileReader.onload = function() {
                var str = _bufferToString(this.result);

                callback(SERIALIZED_MARKER + TYPE_BLOB + str);
            };

            fileReader.readAsArrayBuffer(value);
        } else {
            try {
                callback(JSON.stringify(value));
            } catch (e) {
                window.console.error("Couldn't convert value into a JSON " +
                                     'string: ', value);

                callback(null, e);
            }
        }
    }

    function executeCallback(promise, callback) {
        if (callback) {
            promise.then(function(result) {
                callback(null, result);
            }, function(error) {
                callback(error);
            });
        }
    }

    var webSQLStorage = {
        _driver: 'webSQLStorage',
        _initStorage: _initStorage,
        iterate: iterate,
        getItem: getItem,
        setItem: setItem,
        removeItem: removeItem,
        clear: clear,
        length: length,
        key: key,
        keys: keys
    };

    if (typeof define === 'function' && define.amd) {
        define('webSQLStorage', function() {
            return webSQLStorage;
        });
    } else if (typeof module !== 'undefined' && module.exports) {
        module.exports = webSQLStorage;
    } else {
        this.webSQLStorage = webSQLStorage;
    }
	}).call(window);
	
	},
	{"promise":"node_modules/localforage/node_modules/promise/index.js"}],
	
	"node_modules/localforage/src/localforage.js":[function(require,module,exports){
	(function() {
    'use strict';

    // Promises!
    var Promise = (typeof module !== 'undefined' && module.exports) ?
                  require('promise') : this.Promise;

    // Custom drivers are stored here when `defineDriver()` is called.
    // They are shared across all instances of localForage.
    var CustomDrivers = {};

    var DriverType = {
        INDEXEDDB: 'asyncStorage',
        LOCALSTORAGE: 'localStorageWrapper',
        WEBSQL: 'webSQLStorage'
    };

    var DefaultDriverOrder = [
        DriverType.INDEXEDDB,
        DriverType.WEBSQL,
        DriverType.LOCALSTORAGE
    ];

    var LibraryMethods = [
        'clear',
        'getItem',
        'iterate',
        'key',
        'keys',
        'length',
        'removeItem',
        'setItem'
    ];

    var ModuleType = {
        DEFINE: 1,
        EXPORT: 2,
        WINDOW: 3
    };

    var DefaultConfig = {
        description: '',
        driver: DefaultDriverOrder.slice(),
        name: 'localforage',
        // Default DB size is _JUST UNDER_ 5MB, as it's the highest size
        // we can use without a prompt.
        size: 4980736,
        storeName: 'keyvaluepairs',
        version: 1.0
    };

    // Attaching to window (i.e. no module loader) is the assumed,
    // simple default.
    var moduleType = ModuleType.WINDOW;

    // Find out what kind of module setup we have; if none, we'll just attach
    // localForage to the main window.
    if (typeof define === 'function' && define.amd) {
        moduleType = ModuleType.DEFINE;
    } else if (typeof module !== 'undefined' && module.exports) {
        moduleType = ModuleType.EXPORT;
    }

    // Check to see if IndexedDB is available and if it is the latest
    // implementation; it's our preferred backend library. We use "_spec_test"
    // as the name of the database because it's not the one we'll operate on,
    // but it's useful to make sure its using the right spec.
    // See: https://github.com/mozilla/localForage/issues/128
    var driverSupport = (function(self) {
        // Initialize IndexedDB; fall back to vendor-prefixed versions
        // if needed.
        var indexedDB = indexedDB || self.indexedDB || self.webkitIndexedDB ||
                        self.mozIndexedDB || self.OIndexedDB ||
                        self.msIndexedDB;

        var result = {};

        result[DriverType.WEBSQL] = !!self.openDatabase;
        result[DriverType.INDEXEDDB] = !!(function() {
            // We mimic PouchDB here; just UA test for Safari (which, as of
            // iOS 8/Yosemite, doesn't properly support IndexedDB).
            // IndexedDB support is broken and different from Blink's.
            // This is faster than the test case (and it's sync), so we just
            // do this. *SIGH*
            // http://bl.ocks.org/nolanlawson/raw/c83e9039edf2278047e9/
            //
            // We test for openDatabase because IE Mobile identifies itself
            // as Safari. Oh the lulz...
            if (typeof self.openDatabase !== 'undefined' && self.navigator &&
                self.navigator.userAgent &&
                /Safari/.test(self.navigator.userAgent) &&
                !/Chrome/.test(self.navigator.userAgent)) {
                return false;
            }
            try {
                return indexedDB &&
                       typeof indexedDB.open === 'function' &&
                       // Some Samsung/HTC Android 4.0-4.3 devices
                       // have older IndexedDB specs; if this isn't available
                       // their IndexedDB is too old for us to use.
                       // (Replaces the onupgradeneeded test.)
                       typeof self.IDBKeyRange !== 'undefined';
            } catch (e) {
                return false;
            }
        })();

        result[DriverType.LOCALSTORAGE] = !!(function() {
            try {
                return (self.localStorage &&
                        ('setItem' in self.localStorage) &&
                        (self.localStorage.setItem));
            } catch (e) {
                return false;
            }
        })();

        return result;
    })(this);

    var isArray = Array.isArray || function(arg) {
        return Object.prototype.toString.call(arg) === '[object Array]';
    };

    function callWhenReady(localForageInstance, libraryMethod) {
        localForageInstance[libraryMethod] = function() {
            var _args = arguments;
            return localForageInstance.ready().then(function() {
                return localForageInstance[libraryMethod].apply(localForageInstance, _args);
            });
        };
    }

    function extend() {
        for (var i = 1; i < arguments.length; i++) {
            var arg = arguments[i];

            if (arg) {
                for (var key in arg) {
                    if (arg.hasOwnProperty(key)) {
                        if (isArray(arg[key])) {
                            arguments[0][key] = arg[key].slice();
                        } else {
                            arguments[0][key] = arg[key];
                        }
                    }
                }
            }
        }

        return arguments[0];
    }

    function isLibraryDriver(driverName) {
        for (var driver in DriverType) {
            if (DriverType.hasOwnProperty(driver) &&
                DriverType[driver] === driverName) {
                return true;
            }
        }

        return false;
    }

    var globalObject = this;

    function LocalForage(options) {
        this._config = extend({}, DefaultConfig, options);
        this._driverSet = null;
        this._ready = false;
        this._dbInfo = null;

        // Add a stub for each driver API method that delays the call to the
        // corresponding driver method until localForage is ready. These stubs
        // will be replaced by the driver methods as soon as the driver is
        // loaded, so there is no performance impact.
        for (var i = 0; i < LibraryMethods.length; i++) {
            callWhenReady(this, LibraryMethods[i]);
        }

        this.setDriver(this._config.driver);
    }

    LocalForage.prototype.INDEXEDDB = DriverType.INDEXEDDB;
    LocalForage.prototype.LOCALSTORAGE = DriverType.LOCALSTORAGE;
    LocalForage.prototype.WEBSQL = DriverType.WEBSQL;

    // Set any config values for localForage; can be called anytime before
    // the first API call (e.g. `getItem`, `setItem`).
    // We loop through options so we don't overwrite existing config
    // values.
    LocalForage.prototype.config = function(options) {
        // If the options argument is an object, we use it to set values.
        // Otherwise, we return either a specified config value or all
        // config values.
        if (typeof(options) === 'object') {
            // If localforage is ready and fully initialized, we can't set
            // any new configuration values. Instead, we return an error.
            if (this._ready) {
                return new Error("Can't call config() after localforage " +
                                 'has been used.');
            }

            for (var i in options) {
                if (i === 'storeName') {
                    options[i] = options[i].replace(/\W/g, '_');
                }

                this._config[i] = options[i];
            }

            // after all config options are set and
            // the driver option is used, try setting it
            if ('driver' in options && options.driver) {
                this.setDriver(this._config.driver);
            }

            return true;
        } else if (typeof(options) === 'string') {
            return this._config[options];
        } else {
            return this._config;
        }
    };

    // Used to define a custom driver, shared across all instances of
    // localForage.
    LocalForage.prototype.defineDriver = function(driverObject, callback,
                                                  errorCallback) {
        var defineDriver = new Promise(function(resolve, reject) {
            try {
                var driverName = driverObject._driver;
                var complianceError = new Error(
                    'Custom driver not compliant; see ' +
                    'https://mozilla.github.io/localForage/#definedriver'
                );
                var namingError = new Error(
                    'Custom driver name already in use: ' + driverObject._driver
                );

                // A driver name should be defined and not overlap with the
                // library-defined, default drivers.
                if (!driverObject._driver) {
                    reject(complianceError);
                    return;
                }
                if (isLibraryDriver(driverObject._driver)) {
                    reject(namingError);
                    return;
                }

                var customDriverMethods = LibraryMethods.concat('_initStorage');
                for (var i = 0; i < customDriverMethods.length; i++) {
                    var customDriverMethod = customDriverMethods[i];
                    if (!customDriverMethod ||
                        !driverObject[customDriverMethod] ||
                        typeof driverObject[customDriverMethod] !== 'function') {
                        reject(complianceError);
                        return;
                    }
                }

                var supportPromise = Promise.resolve(true);
                if ('_support'  in driverObject) {
                    if (driverObject._support && typeof driverObject._support === 'function') {
                        supportPromise = driverObject._support();
                    } else {
                        supportPromise = Promise.resolve(!!driverObject._support);
                    }
                }

                supportPromise.then(function(supportResult) {
                    driverSupport[driverName] = supportResult;
                    CustomDrivers[driverName] = driverObject;
                    resolve();
                }, reject);
            } catch (e) {
                reject(e);
            }
        });

        defineDriver.then(callback, errorCallback);
        return defineDriver;
    };

    LocalForage.prototype.driver = function() {
        return this._driver || null;
    };

    LocalForage.prototype.ready = function(callback) {
        var self = this;

        var ready = new Promise(function(resolve, reject) {
            self._driverSet.then(function() {
                if (self._ready === null) {
                    self._ready = self._initStorage(self._config);
                }

                self._ready.then(resolve, reject);
            }).catch(reject);
        });

        ready.then(callback, callback);
        return ready;
    };

    LocalForage.prototype.setDriver = function(drivers, callback,
                                               errorCallback) {
        var self = this;

        if (typeof drivers === 'string') {
            drivers = [drivers];
        }

        this._driverSet = new Promise(function(resolve, reject) {
            var driverName = self._getFirstSupportedDriver(drivers);
            var error = new Error('No available storage method found.');

            if (!driverName) {
                self._driverSet = Promise.reject(error);
                reject(error);
                return;
            }

            self._dbInfo = null;
            self._ready = null;

            if (isLibraryDriver(driverName)) {
                // We allow localForage to be declared as a module or as a
                // library available without AMD/require.js.
                if (moduleType === ModuleType.DEFINE) {
                    require([driverName], function(lib) {
                        self._extend(lib);

                        resolve();
                    });

                    return;
                } else if (moduleType === ModuleType.EXPORT) {
                    // Making it browserify friendly
                    var driver;
                    switch (driverName) {
                        case self.INDEXEDDB:
                            driver = require('./drivers/indexeddb');
                            break;
                        case self.LOCALSTORAGE:
                            driver = require('./drivers/localstorage');
                            break;
                        case self.WEBSQL:
                            driver = require('./drivers/websql');
                    }

                    self._extend(driver);
                } else {
                    self._extend(globalObject[driverName]);
                }
            } else if (CustomDrivers[driverName]) {
                self._extend(CustomDrivers[driverName]);
            } else {
                self._driverSet = Promise.reject(error);
                reject(error);
                return;
            }

            resolve();
        });

        function setDriverToConfig() {
            self._config.driver = self.driver();
        }
        this._driverSet.then(setDriverToConfig, setDriverToConfig);

        this._driverSet.then(callback, errorCallback);
        return this._driverSet;
    };

    LocalForage.prototype.supports = function(driverName) {
        return !!driverSupport[driverName];
    };

    LocalForage.prototype._extend = function(libraryMethodsAndProperties) {
        extend(this, libraryMethodsAndProperties);
    };

    // Used to determine which driver we should use as the backend for this
    // instance of localForage.
    LocalForage.prototype._getFirstSupportedDriver = function(drivers) {
        if (drivers && isArray(drivers)) {
            for (var i = 0; i < drivers.length; i++) {
                var driver = drivers[i];

                if (this.supports(driver)) {
                    return driver;
                }
            }
        }

        return null;
    };

    LocalForage.prototype.createInstance = function(options) {
        return new LocalForage(options);
    };

    // The actual localForage object that we expose as a module or via a
    // global. It's extended by pulling in one of our other libraries.
    var localForage = new LocalForage();

    // We allow localForage to be declared as a module or as a library
    // available without AMD/require.js.
    if (moduleType === ModuleType.DEFINE) {
        define('localforage', function() {
            return localForage;
        });
    } else if (moduleType === ModuleType.EXPORT) {
        module.exports = localForage;
    } else {
        this.localforage = localForage;
    }
	}).call(window);
	
	},
	{"./drivers/indexeddb":"node_modules/localforage/src/drivers/indexeddb.js",
	"./drivers/localstorage":"node_modules/localforage/src/drivers/localstorage.js",
	"./drivers/websql":"node_modules/localforage/src/drivers/websql.js",
	"promise":"node_modules/localforage/node_modules/promise/index.js"}],
	
	"node_modules/soundcloud-badge/index.js":[function(require,module,exports){
		var resolve = require('soundcloud-resolve')
		var fonts = require('google-fonts')
		var minstache = require('minstache')
		var insert = require('insert-css')
		var fs = require('fs')
		
		var icons = {
 		   black: 'http://developers.soundcloud.com/assets/logo_black.png'
 		 , white: 'http://developers.soundcloud.com/assets/logo_white.png'
		}
		
		module.exports = badge
		function noop(err){ if (err) throw err }
		
		var inserted = false
		var gwfadded = false
		var template = null
		
		function badge(options, callback) {
 		 if (!inserted) insert(".npm-scb-wrap {\n  font-family: 'Open Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif;\n  font-weight: 200;\n  position: absolute;\n  top: 0;\n  left: 0;\n  z-index: 999;\n}\n\n.npm-scb-wrap a {\n  text-decoration: none;\n  color: #000;\n}\n.npm-scb-white\n.npm-scb-wrap a {\n  color: #fff;\n}\n\n.npm-scb-inner {\n  position: absolute;\n  top: -120px; left: 0;\n  padding: 8px;\n  width: 100%;\n  height: 150px;\n  z-index: 2;\n  -webkit-transition: width 0.5s cubic-bezier(1, 0, 0, 1), top 0.5s;\n     -moz-transition: width 0.5s cubic-bezier(1, 0, 0, 1), top 0.5s;\n      -ms-transition: width 0.5s cubic-bezier(1, 0, 0, 1), top 0.5s;\n       -o-transition: width 0.5s cubic-bezier(1, 0, 0, 1), top 0.5s;\n          transition: width 0.5s cubic-bezier(1, 0, 0, 1), top 0.5s;\n}\n.npm-scb-wrap:hover\n.npm-scb-inner {\n  top: 0;\n}\n\n.npm-scb-artwork {\n  position: absolute;\n  top: 16px; left: 16px;\n  width: 104px; height: 104px;\n  box-shadow: 0 0 8px -3px #000;\n  outline: 1px solid rgba(0,0,0,0.1);\n  z-index: 2;\n}\n.npm-scb-white\n.npm-scb-artwork {\n  outline: 1px solid rgba(255,255,255,0.1);\n  box-shadow: 0 0 10px -2px rgba(255,255,255,0.9);\n}\n\n.npm-scb-info {\n  position: absolute;\n  top: 16px;\n  left: 120px;\n  width: 300px;\n  z-index: 1;\n}\n\n.npm-scb-info > a {\n  display: block;\n}\n\n.npm-scb-now-playing {\n  font-size: 12px;\n  line-height: 12px;\n  position: absolute;\n  width: 500px;\n  z-index: 1;\n  padding: 15px 0;\n  top: 0; left: 138px;\n  opacity: 1;\n  -webkit-transition: opacity 0.25s;\n     -moz-transition: opacity 0.25s;\n      -ms-transition: opacity 0.25s;\n       -o-transition: opacity 0.25s;\n          transition: opacity 0.25s;\n}\n\n.npm-scb-wrap:hover\n.npm-scb-now-playing {\n  opacity: 0;\n}\n\n.npm-scb-white\n.npm-scb-now-playing {\n  color: #fff;\n}\n.npm-scb-now-playing > a {\n  font-weight: bold;\n}\n\n.npm-scb-info > a > p {\n  margin: 0;\n  padding-bottom: 0.25em;\n  line-height: 1.35em;\n  margin-left: 1em;\n  font-size: 1em;\n}\n\n.npm-scb-title {\n  font-weight: bold;\n}\n\n.npm-scb-icon {\n  position: absolute;\n  top: 120px;\n  padding-top: 0.75em;\n  left: 16px;\n}\n"), inserted = true
 	 	 if (!template) template = minstache.compile("<div class=\"npm-scb-wrap\">\n  <div class=\"npm-scb-inner\">\n    <a target=\"_blank\" href=\"{{urls.song}}\">\n      <img class=\"npm-scb-icon\" src=\"{{icon}}\">\n      <img class=\"npm-scb-artwork\" src=\"{{artwork}}\">\n    </a>\n    <div class=\"npm-scb-info\">\n      <a target=\"_blank\" href=\"{{urls.song}}\">\n        <p class=\"npm-scb-title\">{{title}}</p>\n      </a>\n      <a target=\"_blank\" href=\"{{urls.artist}}\">\n        <p class=\"npm-scb-artist\">{{artist}}</p>\n      </a>\n    </div>\n  </div>\n  <div class=\"npm-scb-now-playing\">\n    Now Playing:\n    <a href=\"{{urls.song}}\">{{title}}</a>\n    by\n    <a href=\"{{urls.artist}}\">{{artist}}</a>\n  </div>\n</div>\n")
		
 		 if (!gwfadded && options.getFonts) {
 		   fonts.add({ 'Open Sans': [300, 600] })
 		   gwfadded = true
 		}
		
 		 options = options || {}
 		 callback = callback || noop
		
 		 var div   = options.el || document.createElement('div')
 		 var icon  = !('dark' in options) || options.dark ? 'black' : 'white'
 		 var id    = options.client_id
 		 var song  = options.song
		
 		 resolve(id, song, function(err, json) {
 	   			if (err) return callback(err)
 	   			if (json.kind !== 'track') throw new Error(
 	   			  'soundcloud-badge only supports individual tracks at the moment'
 	   			)
			
 	   		div.classList[
 	   		  icon === 'black' ? 'remove' : 'add'
 	   		]('npm-scb-white')
			
 	   		div.innerHTML = template({
 	   		    artwork: json.artwork_url || json.user.avatar_url
 	   		  , artist: json.user.username
 	   		  , title: json.title
 	   		  , icon: icons[icon]
 	   		  , urls: {
 	   		      song: json.permalink_url
 	   		    , artist: json.user.permalink_url
 	   		  }
 	   		})
			
 	   		document.body.appendChild(div)
			
 	   		callback(null, json.stream_url + '?client_id=' + id, json, div)
 	 	})
	
 	 	return div
		}
		
	},
	{"fs":"node_modules/gulpfile/node_modules/browserify/lib/_empty.js",
	"google-fonts":"node_modules/soundcloud-badge/node_modules/google-fonts/index.js",
	"insert-css":"node_modules/soundcloud-badge/node_modules/insert-css/index.js",
	"minstache":"node_modules/soundcloud-badge/node_modules/minstache/index.js",
	"soundcloud-resolve":"node_modules/soundcloud-badge/node_modules/soundcloud-resolve/browser.js"}],
	
	"node_modules/soundcloud-badge/node_modules/google-fonts/index.js":[function(require,module,exports){
		module.exports = asString
		module.exports.add = append
		
		function asString(fonts) {
	  		var href = getHref(fonts)
	  		return '<link href="' + href + '" rel="stylesheet" type="text/css">'
		}
		
		function asElement(fonts) {
	 	 var href = getHref(fonts)
	 	 var link = document.createElement('link')
	 	 link.setAttribute('href', href)
	 	 link.setAttribute('rel', 'stylesheet')
	 	 link.setAttribute('type', 'text/css')
	 	 return link
		}
		
		function getHref(fonts) {
	  		var family = Object.keys(fonts).map(function(name) {
	  		  var details = fonts[name]
	  		  name = name.replace(/\s+/, '+')
	  		  return typeof details === 'boolean'
	  		    ? name
	  		    : name + ':' + makeArray(details).join(',')
	  		}).join('|')
			
	  		return 'http://fonts.googleapis.com/css?family=' + family
		}
		
		function append(fonts) {
	 		var link = asElement(fonts)
	 		document.head.appendChild(link)
	 		return link
		}
		
		function makeArray(arr) {
	 		return Array.isArray(arr) ? arr : [arr]
		}
		
	},
	{}],
	
	"node_modules/soundcloud-badge/node_modules/insert-css/index.js":[function(require,module,exports){
	var inserted = [];
	
	module.exports = function (css) {
    if (inserted.indexOf(css) >= 0) return;
    inserted.push(css);
    
    var elem = document.createElement('style');
    var text = document.createTextNode(css);
    elem.appendChild(text);
    
    if (document.head.childNodes.length) {
        document.head.insertBefore(elem, document.head.childNodes[0]);
    }
    else {
        document.head.appendChild(elem);
    }
	};
	
	},
	{}],
	
	"node_modules/soundcloud-badge/node_modules/minstache/index.js":[function(require,module,exports){
	
	/**
 * Expose `render()`.`
 */
	
	exports = module.exports = render;
	
	/**
 * Expose `compile()`.
 */
	
	exports.compile = compile;
	
	/**
 * Render the given mustache `str` with `obj`.
 *
 * @param {String} str
 * @param {Object} obj
 * @return {String}
 * @api public
 */
	
	function render(str, obj) {
  obj = obj || {};
  var fn = compile(str);
  return fn(obj);
	}
	
	/**
 * Compile the given `str` to a `Function`.
 *
 * @param {String} str
 * @return {Function}
 * @api public
 */
	
	function compile(str) {
  var js = [];
  var toks = parse(str);
  var tok;

  for (var i = 0; i < toks.length; ++i) {
    tok = toks[i];
    if (i % 2 == 0) {
      js.push('"' + tok.replace(/"/g, '\\"') + '"');
    } else {
      switch (tok[0]) {
        case '/':
          tok = tok.slice(1);
          js.push(') + ');
          break;
        case '^':
          tok = tok.slice(1);
          assertProperty(tok);
          js.push(' + section(obj, "' + tok + '", true, ');
          break;
        case '#':
          tok = tok.slice(1);
          assertProperty(tok);
          js.push(' + section(obj, "' + tok + '", false, ');
          break;
        case '!':
          tok = tok.slice(1);
          assertProperty(tok);
          js.push(' + obj.' + tok + ' + ');
          break;
        default:
          assertProperty(tok);
          js.push(' + escape(obj.' + tok + ') + ');
      }
    }
  }

  js = '\n'
    + indent(escape.toString()) + ';\n\n'
    + indent(section.toString()) + ';\n\n'
    + '  return ' + js.join('').replace(/\n/g, '\\n');

  return new Function('obj', js);
	}
	
	/**
 * Assert that `prop` is a valid property.
 *
 * @param {String} prop
 * @api private
 */
	
	function assertProperty(prop) {
  if (!prop.match(/^[\w.]+$/)) throw new Error('invalid property "' + prop + '"');
	}
	
	/**
 * Parse `str`.
 *
 * @param {String} str
 * @return {Array}
 * @api private
 */
	
	function parse(str) {
  return str.split(/\{\{|\}\}/);
	}
	
	/**
 * Indent `str`.
 *
 * @param {String} str
 * @return {String}
 * @api private
 */
	
	function indent(str) {
  return str.replace(/^/gm, '  ');
	}
	
	/**
 * Section handler.
 *
 * @param {Object} context obj
 * @param {String} prop
 * @param {String} str
 * @param {Boolean} negate
 * @api private
 */
	
	function section(obj, prop, negate, str) {
  var val = obj[prop];
  if ('function' == typeof val) return val.call(obj, str);
  if (negate) val = !val;
  if (val) return str;
  return '';
	}
	
	/**
 * Escape the given `html`.
 *
 * @param {String} html
 * @return {String}
 * @api private
 */
	
	function escape(html) {
  return String(html)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
	}
	
	},
	{}],
	
	"node_modules/soundcloud-badge/node_modules/soundcloud-resolve/browser.js":[function(require,module,exports){
	var qs  = require('querystring')
	var xhr = require('xhr')
	
	module.exports = resolve
	
	function resolve(id, goal, callback) {
  var uri = 'http://api.soundcloud.com/resolve.json?' + qs.stringify({
      url: goal
    , client_id: id
  })

  xhr({
      uri: uri
    , method: 'GET'
  }, function(err, res, body) {
    if (err) return callback(err)
    try {
      body = JSON.parse(body)
    } catch(e) {
      return callback(e)
    }
    if (body.errors) return callback(new Error(
      body.errors[0].error_message
    ))
    return callback(null, body)
  })
	}
	
	},
	{"querystring":"node_modules/gulpfile/node_modules/browserify/node_modules/querystring-es3/index.js",
	"xhr":"node_modules/soundcloud-badge/node_modules/soundcloud-resolve/node_modules/xhr/index.js"}],
	
	"node_modules/soundcloud-badge/node_modules/soundcloud-resolve/node_modules/xhr/index.js":[function(require,module,exports){
	var window = require("global/window")
	var once = require("once")
	
	var messages = {
    "0": "Internal XMLHttpRequest Error",
    "4": "4xx Client Error",
    "5": "5xx Server Error"
	}
	
	var XHR = window.XMLHttpRequest || noop
	var XDR = "withCredentials" in (new XHR()) ?
        window.XMLHttpRequest : window.XDomainRequest
	
	module.exports = createXHR
	
	function createXHR(options, callback) {
    if (typeof options === "string") {
        options = { uri: options }
    }

    options = options || {}
    callback = once(callback)

    var xhr

    if (options.cors) {
        xhr = new XDR()
    } else {
        xhr = new XHR()
    }

    var uri = xhr.url = options.uri
    var method = xhr.method = options.method || "GET"
    var body = options.body || options.data
    var headers = xhr.headers = options.headers || {}
    var isJson = false

    if ("json" in options) {
        isJson = true
        headers["Content-Type"] = "application/json"
        body = JSON.stringify(options.json)
    }

    xhr.onreadystatechange = readystatechange
    xhr.onload = load
    xhr.onerror = error
    // IE9 must have onprogress be set to a unique function.
    xhr.onprogress = function () {
        // IE must die
    }
    // hate IE
    xhr.ontimeout = noop
    xhr.open(method, uri)
    if (options.cors) {
        xhr.withCredentials = true
    }
    xhr.timeout = "timeout" in options ? options.timeout : 5000

    if ( xhr.setRequestHeader) {
        Object.keys(headers).forEach(function (key) {
            xhr.setRequestHeader(key, headers[key])
        })
    }

    xhr.send(body)

    return xhr

    function readystatechange() {
        if (xhr.readyState === 4) {
            load()
        }
    }

    function load() {
        var error = null
        var status = xhr.statusCode = xhr.status
        var body = xhr.body = xhr.response ||
            xhr.responseText || xhr.responseXML

        if (status === 0 || (status >= 400 && status < 600)) {
            var message = xhr.responseText ||
                messages[String(xhr.status).charAt(0)]
            error = new Error(message)

            error.statusCode = xhr.status
        }

        if (isJson) {
            try {
                body = xhr.body = JSON.parse(body)
            } catch (e) {}
        }

        callback(error, xhr, body)
    }

    function error(evt) {
        callback(evt, xhr)
    }
	}
	
	
	function noop() {}
	
	},
	{"global/window":"node_modules/soundcloud-badge/node_modules/soundcloud-resolve/node_modules/xhr/node_modules/global/window.js",
	"once":"node_modules/soundcloud-badge/node_modules/soundcloud-resolve/node_modules/xhr/node_modules/once/once.js"}],
	
	"node_modules/soundcloud-badge/node_modules/soundcloud-resolve/node_modules/xhr/node_modules/global/window.js":[function(require,module,exports){
	(function (global){
	if (typeof window !== "undefined") {
    module.exports = window
	} else if (typeof global !== "undefined") {
    module.exports = global
	} else {
    module.exports = {}
	}
	
	}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
	},
	{}],
	
	"node_modules/soundcloud-badge/node_modules/soundcloud-resolve/node_modules/xhr/node_modules/once/once.js":[function(require,module,exports){
	module.exports = once
	
	once.proto = once(function () {
  Object.defineProperty(Function.prototype, 'once', {
    value: function () {
      return once(this)
    },
    configurable: true
  })
	})
	
	function once (fn) {
  var called = false
  return function () {
    if (called) return
    called = true
    return fn.apply(this, arguments)
  }
	}
	
	},
	{}],
	
	"node_modules/three-glslify/index.js":[function(require,module,exports){
	var createTypes = require('./types')	
	
	module.exports = function(THREE) {

    var types = createTypes(THREE) 

    return function create(glShader, opts) {
        opts = opts||{}

        if (typeof opts.colors === 'string')
            opts.colors = [opts.colors]
        
        var tUniforms = types( glShader.uniforms, opts.colors )
        var tAttribs = types( glShader.attributes, opts.colors )
            
        //clear the attribute arrays
        for (var k in tAttribs) {
            tAttribs[k].value = []
        }

        return {
            vertexShader: glShader.vertex,
            fragmentShader: glShader.fragment,
            uniforms: tUniforms,
            attributes: tAttribs
        }
    }
	}
	},
	{"./types":"node_modules/three-glslify/types.js"}],
	
	"node_modules/three-glslify/types.js":[function(require,module,exports){
	var typeMap = {
    'int': 'i',
    'float': 'f',
    'ivec2': 'i2',
    'ivec3': 'i3',
    'ivec4': 'i4',
    'vec2': 'v2',
    'vec3': 'v3',
    'vec4': 'v4',
    'mat4': 'm4',
    'mat3': 'm3',
    'sampler2D': 't',
    'samplerCube': 't'
	}
	
	function create(THREE) {
    function newInstance(type, isArray) {
        switch (type) {
            case 'float': 
            case 'int':
                return 0
            case 'vec2':
            case 'ivec2':
                return new THREE.Vector2()
            case 'vec3':
            case 'ivec3':
                return new THREE.Vector3()
            case 'vec4':
            case 'ivec4':
                return new THREE.Vector4()
            case 'mat4':
                return new THREE.Matrix4()
            case 'mat3':
                return new THREE.Matrix3()
            case 'samplerCube':
            case 'sampler2D':
                return new THREE.Texture()
            default:
                return undefined
        }
    }

    function defaultValue(type, isArray, arrayLen) {
        if (isArray) {
            //ThreeJS flattens ivec3 type
            //(we don't support 'fv' type)
            if (type === 'ivec3')
                arrayLen *= 3
            var ar = new Array(arrayLen)
            for (var i=0; i<ar.length; i++)
                ar[i] = newInstance(type, isArray)
            return ar
        }  
        return newInstance(type)
    }

    function getType(type, isArray) {
        if (!isArray)
            return typeMap[type]

        if (type === 'int')
            return 'iv1'
        else if (type === 'float')
            return 'fv1'
        else
            return typeMap[type]+'v'
    }

    return function setupUniforms(glUniforms, colorNames) {
        if (!Array.isArray(colorNames))
            colorNames = Array.prototype.slice.call(arguments, 1)

        var result = {}
        var arrays = {}

        //map uniform types
        glUniforms.forEach(function(uniform) {
            var name = uniform.name
            var isArray = /(.+)\[[0-9]+\]/.exec(name)

            //special case: colors...
            if (colorNames && colorNames.indexOf(name) !== -1) {
                if (isArray)
                    throw new Error("array of color uniforms not supported")
                if (uniform.type !== 'vec3')
                    throw new Error("ThreeJS expects vec3 for Color uniforms") 
                result[name] = {
                    type: 'c',
                    value: new THREE.Color()
                }
                return
            }

            if (isArray) {
                name = isArray[1]
                if (name in arrays) 
                    arrays[name].count++ 
                else
                    arrays[name] = { count: 1, type: uniform.type }
            }
            result[name] = { 
                type: getType(uniform.type, isArray), 
                value: isArray ? null : defaultValue(uniform.type) 
            }
        })

        //now clean up any array values
        for (var k in result) {
            var u = result[k]
            if (k in arrays) { //is an array
                var a = arrays[k]
                u.value = defaultValue(a.type, true, a.count)
            }
        }
        return result
    }
	}
	
	module.exports = create
	},
	{}],
	
	"node_modules/underscore/underscore.js":[function(require,module,exports){
	//     Underscore.js 1.7.0
	//     http://underscorejs.org
	//     (c) 2009-2014 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
	//     Underscore may be freely distributed under the MIT license.
	
	(function() {

  		// Baseline setup
  		// --------------
		
  		// Establish the root object, `window` in the browser, or `exports` on the server.
  		var root = this;
		
  		// Save the previous value of the `_` variable.
  		var previousUnderscore = root._;
		
  		// Save bytes in the minified (but not gzipped) version:
  		var ArrayProto = Array.prototype, ObjProto = Object.prototype, FuncProto = Function.prototype;
		
  		// Create quick reference variables for speed access to core prototypes.
  		var
  		  push             = ArrayProto.push,
  		  slice            = ArrayProto.slice,
  		  concat           = ArrayProto.concat,
  		  toString         = ObjProto.toString,
  		  hasOwnProperty   = ObjProto.hasOwnProperty;
		
  		// All **ECMAScript 5** native function implementations that we hope to use
  		// are declared here.
  		var
  		  nativeIsArray      = Array.isArray,
  		  nativeKeys         = Object.keys,
  		  nativeBind         = FuncProto.bind;
		
  		// Create a safe reference to the Underscore object for use below.
  		var _ = function(obj) {
  		  if (obj instanceof _) return obj;
  		  if (!(this instanceof _)) return new _(obj);
  		  this._wrapped = obj;
  		};
		
  		// Export the Underscore object for **Node.js**, with
  		// backwards-compatibility for the old `require()` API. If we're in
  		// the browser, add `_` as a global object.
  		if (typeof exports !== 'undefined') {
  		  if (typeof module !== 'undefined' && module.exports) {
  		    exports = module.exports = _;
  		  }
  		  exports._ = _;
  		} else {
  		  root._ = _;
  		}
		
  		// Current version.
  		_.VERSION = '1.7.0';
		
  		// Internal function that returns an efficient (for current engines) version
  		// of the passed-in callback, to be repeatedly applied in other Underscore
  		// functions.
  		var createCallback = function(func, context, argCount) {
  		  if (context === void 0) return func;
  		  switch (argCount == null ? 3 : argCount) {
  		    case 1: return function(value) {
  		      return func.call(context, value);
  		    };
  		    case 2: return function(value, other) {
  		      return func.call(context, value, other);
  		    };
  		    case 3: return function(value, index, collection) {
  		      return func.call(context, value, index, collection);
  		    };
  		    case 4: return function(accumulator, value, index, collection) {
  		      return func.call(context, accumulator, value, index, collection);
  		    };
  		  }
  		  return function() {
  		    return func.apply(context, arguments);
  		  };
  		};
		
  		// A mostly-internal function to generate callbacks that can be applied
  		// to each element in a collection, returning the desired result — either
  		// identity, an arbitrary callback, a property matcher, or a property accessor.
  		_.iteratee = function(value, context, argCount) {
  		  if (value == null) return _.identity;
  		  if (_.isFunction(value)) return createCallback(value, context, argCount);
  		  if (_.isObject(value)) return _.matches(value);
  		  return _.property(value);
  		};
		
  		// Collection Functions
  		// --------------------
		
  		// The cornerstone, an `each` implementation, aka `forEach`.
  		// Handles raw objects in addition to array-likes. Treats all
  		// sparse array-likes as if they were dense.
  		_.each = _.forEach = function(obj, iteratee, context) {
  		  if (obj == null) return obj;
  		  iteratee = createCallback(iteratee, context);
  		  var i, length = obj.length;
  		  if (length === +length) {
  		    for (i = 0; i < length; i++) {
  		      iteratee(obj[i], i, obj);
  		    }
  		  } else {
  		    var keys = _.keys(obj);
  		    for (i = 0, length = keys.length; i < length; i++) {
  		      iteratee(obj[keys[i]], keys[i], obj);
  		    }
  		  }
  		  return obj;
  		};
		
  		// Return the results of applying the iteratee to each element.
  		_.map = _.collect = function(obj, iteratee, context) {
  		  if (obj == null) return [];
  		  iteratee = _.iteratee(iteratee, context);
  		  var keys = obj.length !== +obj.length && _.keys(obj),
  		      length = (keys || obj).length,
  		      results = Array(length),
  		      currentKey;
  		  for (var index = 0; index < length; index++) {
  		    currentKey = keys ? keys[index] : index;
  		    results[index] = iteratee(obj[currentKey], currentKey, obj);
  		  }
  		  return results;
  		};
		
  		var reduceError = 'Reduce of empty array with no initial value';
		
  		// **Reduce** builds up a single result from a list of values, aka `inject`,
  		// or `foldl`.
  		_.reduce = _.foldl = _.inject = function(obj, iteratee, memo, context) {
  		  if (obj == null) obj = [];
  		  iteratee = createCallback(iteratee, context, 4);
  		  var keys = obj.length !== +obj.length && _.keys(obj),
  		      length = (keys || obj).length,
  		      index = 0, currentKey;
  		  if (arguments.length < 3) {
  		    if (!length) throw new TypeError(reduceError);
  		    memo = obj[keys ? keys[index++] : index++];
  		  }
  		  for (; index < length; index++) {
  		    currentKey = keys ? keys[index] : index;
  		    memo = iteratee(memo, obj[currentKey], currentKey, obj);
  		  }
  		  return memo;
  		};
		
  		// The right-associative version of reduce, also known as `foldr`.
  		_.reduceRight = _.foldr = function(obj, iteratee, memo, context) {
  		  if (obj == null) obj = [];
  		  iteratee = createCallback(iteratee, context, 4);
  		  var keys = obj.length !== + obj.length && _.keys(obj),
  		      index = (keys || obj).length,
  		      currentKey;
  		  if (arguments.length < 3) {
  		    if (!index) throw new TypeError(reduceError);
  		    memo = obj[keys ? keys[--index] : --index];
  		  }
  		  while (index--) {
  		    currentKey = keys ? keys[index] : index;
  		    memo = iteratee(memo, obj[currentKey], currentKey, obj);
  		  }
  		  return memo;
  		};
		
  		// Return the first value which passes a truth test. Aliased as `detect`.
  		_.find = _.detect = function(obj, predicate, context) {
  		  var result;
  		  predicate = _.iteratee(predicate, context);
  		  _.some(obj, function(value, index, list) {
  		    if (predicate(value, index, list)) {
  		      result = value;
  		      return true;
  		    }
  		  });
  		  return result;
  		};
		
  		// Return all the elements that pass a truth test.
  		// Aliased as `select`.
  		_.filter = _.select = function(obj, predicate, context) {
  		  var results = [];
  		  if (obj == null) return results;
  		  predicate = _.iteratee(predicate, context);
  		  _.each(obj, function(value, index, list) {
  		    if (predicate(value, index, list)) results.push(value);
  		  });
  		  return results;
  		};
		
  		// Return all the elements for which a truth test fails.
  		_.reject = function(obj, predicate, context) {
  		  return _.filter(obj, _.negate(_.iteratee(predicate)), context);
  		};
		
  		// Determine whether all of the elements match a truth test.
  		// Aliased as `all`.
  		_.every = _.all = function(obj, predicate, context) {
  		  if (obj == null) return true;
  		  predicate = _.iteratee(predicate, context);
  		  var keys = obj.length !== +obj.length && _.keys(obj),
  		      length = (keys || obj).length,
  		      index, currentKey;
  		  for (index = 0; index < length; index++) {
  		    currentKey = keys ? keys[index] : index;
  		    if (!predicate(obj[currentKey], currentKey, obj)) return false;
  		  }
  		  return true;
  		};
		
  		// Determine if at least one element in the object matches a truth test.
  		// Aliased as `any`.
  		_.some = _.any = function(obj, predicate, context) {
  		  if (obj == null) return false;
  		  predicate = _.iteratee(predicate, context);
  		  var keys = obj.length !== +obj.length && _.keys(obj),
  		      length = (keys || obj).length,
  		      index, currentKey;
  		  for (index = 0; index < length; index++) {
  		    currentKey = keys ? keys[index] : index;
  		    if (predicate(obj[currentKey], currentKey, obj)) return true;
  		  }
  		  return false;
  		};
		
  		// Determine if the array or object contains a given value (using `===`).
  		// Aliased as `include`.
  		_.contains = _.include = function(obj, target) {
  		  if (obj == null) return false;
  		  if (obj.length !== +obj.length) obj = _.values(obj);
  		  return _.indexOf(obj, target) >= 0;
  		};
		
  		// Invoke a method (with arguments) on every item in a collection.
  		_.invoke = function(obj, method) {
  		  var args = slice.call(arguments, 2);
  		  var isFunc = _.isFunction(method);
  		  return _.map(obj, function(value) {
  		    return (isFunc ? method : value[method]).apply(value, args);
  		  });
  		};
		
  		// Convenience version of a common use case of `map`: fetching a property.
  		_.pluck = function(obj, key) {
  		  return _.map(obj, _.property(key));
  		};
		
  		// Convenience version of a common use case of `filter`: selecting only objects
  		// containing specific `key:value` pairs.
  		_.where = function(obj, attrs) {
  		  return _.filter(obj, _.matches(attrs));
  		};
		
  		// Convenience version of a common use case of `find`: getting the first object
  		// containing specific `key:value` pairs.
  		_.findWhere = function(obj, attrs) {
  		  return _.find(obj, _.matches(attrs));
  		};
		
  		// Return the maximum element (or element-based computation).
  		_.max = function(obj, iteratee, context) {
  		  var result = -Infinity, lastComputed = -Infinity,
  		      value, computed;
  		  if (iteratee == null && obj != null) {
  		    obj = obj.length === +obj.length ? obj : _.values(obj);
  		    for (var i = 0, length = obj.length; i < length; i++) {
  		      value = obj[i];
  		      if (value > result) {
  		        result = value;
  		      }
  		    }
  		  } else {
  		    iteratee = _.iteratee(iteratee, context);
  		    _.each(obj, function(value, index, list) {
  		      computed = iteratee(value, index, list);
  		      if (computed > lastComputed || computed === -Infinity && result === -Infinity) {
  		        result = value;
  		        lastComputed = computed;
  		      }
  		    });
  		  }
  		  return result;
  		};
		
  		// Return the minimum element (or element-based computation).
  		_.min = function(obj, iteratee, context) {
  		  var result = Infinity, lastComputed = Infinity,
  		      value, computed;
  		  if (iteratee == null && obj != null) {
  		    obj = obj.length === +obj.length ? obj : _.values(obj);
  		    for (var i = 0, length = obj.length; i < length; i++) {
  		      value = obj[i];
  		      if (value < result) {
  		        result = value;
  		      }
  		    }
  		  } else {
  		    iteratee = _.iteratee(iteratee, context);
  		    _.each(obj, function(value, index, list) {
  		      computed = iteratee(value, index, list);
  		      if (computed < lastComputed || computed === Infinity && result === Infinity) {
  		        result = value;
  		        lastComputed = computed;
  		      }
  		    });
  		  }
  		  return result;
  		};
		
  		// Shuffle a collection, using the modern version of the
  		// [Fisher-Yates shuffle](http://en.wikipedia.org/wiki/Fisher–Yates_shuffle).
  		_.shuffle = function(obj) {
  		  var set = obj && obj.length === +obj.length ? obj : _.values(obj);
  		  var length = set.length;
  		  var shuffled = Array(length);
  		  for (var index = 0, rand; index < length; index++) {
  		    rand = _.random(0, index);
  		    if (rand !== index) shuffled[index] = shuffled[rand];
  		    shuffled[rand] = set[index];
  		  }
  		  return shuffled;
  		};
		
  		// Sample **n** random values from a collection.
  		// If **n** is not specified, returns a single random element.
  		// The internal `guard` argument allows it to work with `map`.
  		_.sample = function(obj, n, guard) {
  		  if (n == null || guard) {
  		    if (obj.length !== +obj.length) obj = _.values(obj);
  		    return obj[_.random(obj.length - 1)];
  		  }
  		  return _.shuffle(obj).slice(0, Math.max(0, n));
  		};
		
  		// Sort the object's values by a criterion produced by an iteratee.
  		_.sortBy = function(obj, iteratee, context) {
  		  iteratee = _.iteratee(iteratee, context);
  		  return _.pluck(_.map(obj, function(value, index, list) {
  		    return {
  		      value: value,
  		      index: index,
  		      criteria: iteratee(value, index, list)
  		    };
  		  }).sort(function(left, right) {
  		    var a = left.criteria;
  		    var b = right.criteria;
  		    if (a !== b) {
  		      if (a > b || a === void 0) return 1;
  		      if (a < b || b === void 0) return -1;
  		    }
  		    return left.index - right.index;
  		  }), 'value');
  		};
		
  		// An internal function used for aggregate "group by" operations.
  		var group = function(behavior) {
  		  return function(obj, iteratee, context) {
  		    var result = {};
  		    iteratee = _.iteratee(iteratee, context);
  		    _.each(obj, function(value, index) {
  		      var key = iteratee(value, index, obj);
  		      behavior(result, value, key);
  		    });
  		    return result;
  		  };
  		};
		
  		// Groups the object's values by a criterion. Pass either a string attribute
  		// to group by, or a function that returns the criterion.
  		_.groupBy = group(function(result, value, key) {
  		  if (_.has(result, key)) result[key].push(value); else result[key] = [value];
  		});
		
  		// Indexes the object's values by a criterion, similar to `groupBy`, but for
  		// when you know that your index values will be unique.
  		_.indexBy = group(function(result, value, key) {
  		  result[key] = value;
  		});
		
  		// Counts instances of an object that group by a certain criterion. Pass
  		// either a string attribute to count by, or a function that returns the
  		// criterion.
  		_.countBy = group(function(result, value, key) {
  		  if (_.has(result, key)) result[key]++; else result[key] = 1;
  		});
		
  		// Use a comparator function to figure out the smallest index at which
  		// an object should be inserted so as to maintain order. Uses binary search.
  		_.sortedIndex = function(array, obj, iteratee, context) {
  		  iteratee = _.iteratee(iteratee, context, 1);
  		  var value = iteratee(obj);
  		  var low = 0, high = array.length;
  		  while (low < high) {
  		    var mid = low + high >>> 1;
  		    if (iteratee(array[mid]) < value) low = mid + 1; else high = mid;
  		  }
  		  return low;
  		};
		
  		// Safely create a real, live array from anything iterable.
  		_.toArray = function(obj) {
  		  if (!obj) return [];
  		  if (_.isArray(obj)) return slice.call(obj);
  		  if (obj.length === +obj.length) return _.map(obj, _.identity);
  		  return _.values(obj);
  		};
		
  		// Return the number of elements in an object.
  		_.size = function(obj) {
  		  if (obj == null) return 0;
  		  return obj.length === +obj.length ? obj.length : _.keys(obj).length;
  		};
		
  		// Split a collection into two arrays: one whose elements all satisfy the given
  		// predicate, and one whose elements all do not satisfy the predicate.
  		_.partition = function(obj, predicate, context) {
  		  predicate = _.iteratee(predicate, context);
  		  var pass = [], fail = [];
  		  _.each(obj, function(value, key, obj) {
  		    (predicate(value, key, obj) ? pass : fail).push(value);
  		  });
  		  return [pass, fail];
  		};
		
  		// Array Functions
  		// ---------------
		
  		// Get the first element of an array. Passing **n** will return the first N
  		// values in the array. Aliased as `head` and `take`. The **guard** check
  		// allows it to work with `_.map`.
  		_.first = _.head = _.take = function(array, n, guard) {
  		  if (array == null) return void 0;
  		  if (n == null || guard) return array[0];
  		  if (n < 0) return [];
  		  return slice.call(array, 0, n);
  		};
		
  		// Returns everything but the last entry of the array. Especially useful on
  		// the arguments object. Passing **n** will return all the values in
  		// the array, excluding the last N. The **guard** check allows it to work with
  		// `_.map`.
  		_.initial = function(array, n, guard) {
  		  return slice.call(array, 0, Math.max(0, array.length - (n == null || guard ? 1 : n)));
  		};
		
  		// Get the last element of an array. Passing **n** will return the last N
  		// values in the array. The **guard** check allows it to work with `_.map`.
  		_.last = function(array, n, guard) {
  		  if (array == null) return void 0;
  		  if (n == null || guard) return array[array.length - 1];
  		  return slice.call(array, Math.max(array.length - n, 0));
  		};
		
  		// Returns everything but the first entry of the array. Aliased as `tail` and `drop`.
  		// Especially useful on the arguments object. Passing an **n** will return
  		// the rest N values in the array. The **guard**
  		// check allows it to work with `_.map`.
  		_.rest = _.tail = _.drop = function(array, n, guard) {
  		  return slice.call(array, n == null || guard ? 1 : n);
  		};
		
  		// Trim out all falsy values from an array.
  		_.compact = function(array) {
  		  return _.filter(array, _.identity);
  		};
		
  		// Internal implementation of a recursive `flatten` function.
  		var flatten = function(input, shallow, strict, output) {
  		  if (shallow && _.every(input, _.isArray)) {
  		    return concat.apply(output, input);
  		  }
  		  for (var i = 0, length = input.length; i < length; i++) {
  		    var value = input[i];
  		    if (!_.isArray(value) && !_.isArguments(value)) {
  		      if (!strict) output.push(value);
  		    } else if (shallow) {
  		      push.apply(output, value);
  		    } else {
  		      flatten(value, shallow, strict, output);
  		    }
  		  }
  		  return output;
  		};
		
  		// Flatten out an array, either recursively (by default), or just one level.
  		_.flatten = function(array, shallow) {
  		  return flatten(array, shallow, false, []);
  		};
		
  		// Return a version of the array that does not contain the specified value(s).
  		_.without = function(array) {
  		  return _.difference(array, slice.call(arguments, 1));
  		};
		
  		// Produce a duplicate-free version of the array. If the array has already
  		// been sorted, you have the option of using a faster algorithm.
  		// Aliased as `unique`.
  		_.uniq = _.unique = function(array, isSorted, iteratee, context) {
  		  if (array == null) return [];
  		  if (!_.isBoolean(isSorted)) {
  		    context = iteratee;
  		    iteratee = isSorted;
  		    isSorted = false;
  		  }
  		  if (iteratee != null) iteratee = _.iteratee(iteratee, context);
  		  var result = [];
  		  var seen = [];
  		  for (var i = 0, length = array.length; i < length; i++) {
  		    var value = array[i];
  		    if (isSorted) {
  		      if (!i || seen !== value) result.push(value);
  		      seen = value;
  		    } else if (iteratee) {
  		      var computed = iteratee(value, i, array);
  		      if (_.indexOf(seen, computed) < 0) {
  		        seen.push(computed);
  		        result.push(value);
  		      }
  		    } else if (_.indexOf(result, value) < 0) {
  		      result.push(value);
  		    }
  		  }
  		  return result;
  		};
		
  		// Produce an array that contains the union: each distinct element from all of
  		// the passed-in arrays.
  		_.union = function() {
  		  return _.uniq(flatten(arguments, true, true, []));
  		};
		
  		// Produce an array that contains every item shared between all the
  		// passed-in arrays.
  		_.intersection = function(array) {
  		  if (array == null) return [];
  		  var result = [];
  		  var argsLength = arguments.length;
  		  for (var i = 0, length = array.length; i < length; i++) {
  		    var item = array[i];
  		    if (_.contains(result, item)) continue;
  		    for (var j = 1; j < argsLength; j++) {
  		      if (!_.contains(arguments[j], item)) break;
  		    }
  		    if (j === argsLength) result.push(item);
  		  }
  		  return result;
  		};
		
  		// Take the difference between one array and a number of other arrays.
  		// Only the elements present in just the first array will remain.
  		_.difference = function(array) {
  		  var rest = flatten(slice.call(arguments, 1), true, true, []);
  		  return _.filter(array, function(value){
  		    return !_.contains(rest, value);
  		  });
  		};
		
  		// Zip together multiple lists into a single array -- elements that share
  		// an index go together.
  		_.zip = function(array) {
  		  if (array == null) return [];
  		  var length = _.max(arguments, 'length').length;
  		  var results = Array(length);
  		  for (var i = 0; i < length; i++) {
  		    results[i] = _.pluck(arguments, i);
  		  }
  		  return results;
  		};
		
  		// Converts lists into objects. Pass either a single array of `[key, value]`
  		// pairs, or two parallel arrays of the same length -- one of keys, and one of
  		// the corresponding values.
  		_.object = function(list, values) {
  		  if (list == null) return {};
  		  var result = {};
  		  for (var i = 0, length = list.length; i < length; i++) {
  		    if (values) {
  		      result[list[i]] = values[i];
  		    } else {
  		      result[list[i][0]] = list[i][1];
  		    }
  		  }
  		  return result;
  		};
		
  		// Return the position of the first occurrence of an item in an array,
  		// or -1 if the item is not included in the array.
  		// If the array is large and already in sort order, pass `true`
  		// for **isSorted** to use binary search.
  		_.indexOf = function(array, item, isSorted) {
  		  if (array == null) return -1;
  		  var i = 0, length = array.length;
  		  if (isSorted) {
  		    if (typeof isSorted == 'number') {
  		      i = isSorted < 0 ? Math.max(0, length + isSorted) : isSorted;
  		    } else {
  		      i = _.sortedIndex(array, item);
  		      return array[i] === item ? i : -1;
  		    }
  		  }
  		  for (; i < length; i++) if (array[i] === item) return i;
  		  return -1;
  		};
		
  		_.lastIndexOf = function(array, item, from) {
  		  if (array == null) return -1;
  		  var idx = array.length;
  		  if (typeof from == 'number') {
  		    idx = from < 0 ? idx + from + 1 : Math.min(idx, from + 1);
  		  }
  		  while (--idx >= 0) if (array[idx] === item) return idx;
  		  return -1;
  		};
		
  		// Generate an integer Array containing an arithmetic progression. A port of
  		// the native Python `range()` function. See
  		// [the Python documentation](http://docs.python.org/library/functions.html#range).
  		_.range = function(start, stop, step) {
  		  if (arguments.length <= 1) {
  		    stop = start || 0;
  		    start = 0;
  		  }
  		  step = step || 1;
		
  		  var length = Math.max(Math.ceil((stop - start) / step), 0);
  		  var range = Array(length);
		
  		  for (var idx = 0; idx < length; idx++, start += step) {
  		    range[idx] = start;
  		  }
		
  		  return range;
  		};
		
  		// Function (ahem) Functions
  		// ------------------
		
  		// Reusable constructor function for prototype setting.
  		var Ctor = function(){};
		
  		// Create a function bound to a given object (assigning `this`, and arguments,
  		// optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
  		// available.
  		_.bind = function(func, context) {
  		  var args, bound;
  		  if (nativeBind && func.bind === nativeBind) return nativeBind.apply(func, slice.call(arguments, 1));
  		  if (!_.isFunction(func)) throw new TypeError('Bind must be called on a function');
  		  args = slice.call(arguments, 2);
  		  bound = function() {
  		    if (!(this instanceof bound)) return func.apply(context, args.concat(slice.call(arguments)));
  		    Ctor.prototype = func.prototype;
  		    var self = new Ctor;
  		    Ctor.prototype = null;
  		    var result = func.apply(self, args.concat(slice.call(arguments)));
  		    if (_.isObject(result)) return result;
  		    return self;
  		  };
  		  return bound;
  		};
		
  		// Partially apply a function by creating a version that has had some of its
  		// arguments pre-filled, without changing its dynamic `this` context. _ acts
  		// as a placeholder, allowing any combination of arguments to be pre-filled.
  		_.partial = function(func) {
  		  var boundArgs = slice.call(arguments, 1);
  		  return function() {
  		    var position = 0;
  		    var args = boundArgs.slice();
  		    for (var i = 0, length = args.length; i < length; i++) {
  		      if (args[i] === _) args[i] = arguments[position++];
  		    }
  		    while (position < arguments.length) args.push(arguments[position++]);
  		    return func.apply(this, args);
  		  };
  		};
		
  		// Bind a number of an object's methods to that object. Remaining arguments
  		// are the method names to be bound. Useful for ensuring that all callbacks
  		// defined on an object belong to it.
  		_.bindAll = function(obj) {
  		  var i, length = arguments.length, key;
  		  if (length <= 1) throw new Error('bindAll must be passed function names');
  		  for (i = 1; i < length; i++) {
  		    key = arguments[i];
  		    obj[key] = _.bind(obj[key], obj);
  		  }
  		  return obj;
  		};
		
  		// Memoize an expensive function by storing its results.
  		_.memoize = function(func, hasher) {
  		  var memoize = function(key) {
  		    var cache = memoize.cache;
  		    var address = hasher ? hasher.apply(this, arguments) : key;
  		    if (!_.has(cache, address)) cache[address] = func.apply(this, arguments);
  		    return cache[address];
  		  };
  		  memoize.cache = {};
  		  return memoize;
  		};
		
  		// Delays a function for the given number of milliseconds, and then calls
  		// it with the arguments supplied.
  		_.delay = function(func, wait) {
  		  var args = slice.call(arguments, 2);
  		  return setTimeout(function(){
  		    return func.apply(null, args);
  		  }, wait);
  		};
		
  		// Defers a function, scheduling it to run after the current call stack has
  		// cleared.
  		_.defer = function(func) {
  		  return _.delay.apply(_, [func, 1].concat(slice.call(arguments, 1)));
  		};
		
  		// Returns a function, that, when invoked, will only be triggered at most once
  		// during a given window of time. Normally, the throttled function will run
  		// as much as it can, without ever going more than once per `wait` duration;
  		// but if you'd like to disable the execution on the leading edge, pass
  		// `{leading: false}`. To disable execution on the trailing edge, ditto.
  		_.throttle = function(func, wait, options) {
  		  var context, args, result;
  		  var timeout = null;
  		  var previous = 0;
  		  if (!options) options = {};
  		  var later = function() {
  		    previous = options.leading === false ? 0 : _.now();
  		    timeout = null;
  		    result = func.apply(context, args);
  		    if (!timeout) context = args = null;
  		  };
  		  return function() {
  		    var now = _.now();
  		    if (!previous && options.leading === false) previous = now;
  		    var remaining = wait - (now - previous);
  		    context = this;
  		    args = arguments;
  		    if (remaining <= 0 || remaining > wait) {
  		      clearTimeout(timeout);
  		      timeout = null;
  		      previous = now;
  		      result = func.apply(context, args);
  		      if (!timeout) context = args = null;
  		    } else if (!timeout && options.trailing !== false) {
  		      timeout = setTimeout(later, remaining);
  		    }
  		    return result;
  		  };
  		};
		
  		// Returns a function, that, as long as it continues to be invoked, will not
  		// be triggered. The function will be called after it stops being called for
  		// N milliseconds. If `immediate` is passed, trigger the function on the
  		// leading edge, instead of the trailing.
  		_.debounce = function(func, wait, immediate) {
  		  var timeout, args, context, timestamp, result;
		
  		  var later = function() {
  		    var last = _.now() - timestamp;
		
  		    if (last < wait && last > 0) {
  		      timeout = setTimeout(later, wait - last);
  		    } else {
  		      timeout = null;
  		      if (!immediate) {
  		        result = func.apply(context, args);
  		        if (!timeout) context = args = null;
  		      }
  		    }
  		  };
		
  		  return function() {
  		    context = this;
  		    args = arguments;
  		    timestamp = _.now();
  		    var callNow = immediate && !timeout;
  		    if (!timeout) timeout = setTimeout(later, wait);
  		    if (callNow) {
  		      result = func.apply(context, args);
  		      context = args = null;
  		    }
		
  		    return result;
  		  };
  		};
		
  		// Returns the first function passed as an argument to the second,
  		// allowing you to adjust arguments, run code before and after, and
  		// conditionally execute the original function.
  		_.wrap = function(func, wrapper) {
  		  return _.partial(wrapper, func);
  		};
		
  		// Returns a negated version of the passed-in predicate.
  		_.negate = function(predicate) {
  		  return function() {
  		    return !predicate.apply(this, arguments);
  		  };
  		};
		
  		// Returns a function that is the composition of a list of functions, each
  		// consuming the return value of the function that follows.
  		_.compose = function() {
  		  var args = arguments;
  		  var start = args.length - 1;
  		  return function() {
  		    var i = start;
  		    var result = args[start].apply(this, arguments);
  		    while (i--) result = args[i].call(this, result);
  		    return result;
  		  };
  		};
		
  		// Returns a function that will only be executed after being called N times.
  		_.after = function(times, func) {
  		  return function() {
  		    if (--times < 1) {
  		      return func.apply(this, arguments);
  		    }
  		  };
  		};
		
  		// Returns a function that will only be executed before being called N times.
  		_.before = function(times, func) {
  		  var memo;
  		  return function() {
  		    if (--times > 0) {
  		      memo = func.apply(this, arguments);
  		    } else {
  		      func = null;
  		    }
  		    return memo;
  		  };
  		};
		
  		// Returns a function that will be executed at most one time, no matter how
  		// often you call it. Useful for lazy initialization.
  		_.once = _.partial(_.before, 2);
		
  		// Object Functions
  		// ----------------
		
  		// Retrieve the names of an object's properties.
  		// Delegates to **ECMAScript 5**'s native `Object.keys`
  		_.keys = function(obj) {
  		  if (!_.isObject(obj)) return [];
  		  if (nativeKeys) return nativeKeys(obj);
  		  var keys = [];
  		  for (var key in obj) if (_.has(obj, key)) keys.push(key);
  		  return keys;
  		};
		
  		// Retrieve the values of an object's properties.
  		_.values = function(obj) {
  		  var keys = _.keys(obj);
  		  var length = keys.length;
  		  var values = Array(length);
  		  for (var i = 0; i < length; i++) {
  		    values[i] = obj[keys[i]];
  		  }
  		  return values;
  		};
		
  		// Convert an object into a list of `[key, value]` pairs.
  		_.pairs = function(obj) {
  		  var keys = _.keys(obj);
  		  var length = keys.length;
  		  var pairs = Array(length);
  		  for (var i = 0; i < length; i++) {
  		    pairs[i] = [keys[i], obj[keys[i]]];
  		  }
  		  return pairs;
  		};
		
  		// Invert the keys and values of an object. The values must be serializable.
  		_.invert = function(obj) {
  		  var result = {};
  		  var keys = _.keys(obj);
  		  for (var i = 0, length = keys.length; i < length; i++) {
  		    result[obj[keys[i]]] = keys[i];
  		  }
  		  return result;
  		};
		
  		// Return a sorted list of the function names available on the object.
  		// Aliased as `methods`
  		_.functions = _.methods = function(obj) {
  		  var names = [];
  		  for (var key in obj) {
  		    if (_.isFunction(obj[key])) names.push(key);
  		  }
  		  return names.sort();
  		};
		
  		// Extend a given object with all the properties in passed-in object(s).
  		_.extend = function(obj) {
  		  if (!_.isObject(obj)) return obj;
  		  var source, prop;
  		  for (var i = 1, length = arguments.length; i < length; i++) {
  		    source = arguments[i];
  		    for (prop in source) {
  		      if (hasOwnProperty.call(source, prop)) {
  		          obj[prop] = source[prop];
  		      }
  		    }
  		  }
  		  return obj;
  		};
		
  		// Return a copy of the object only containing the whitelisted properties.
  		_.pick = function(obj, iteratee, context) {
  		  var result = {}, key;
  		  if (obj == null) return result;
  		  if (_.isFunction(iteratee)) {
  		    iteratee = createCallback(iteratee, context);
  		    for (key in obj) {
  		      var value = obj[key];
  		      if (iteratee(value, key, obj)) result[key] = value;
  		    }
  		  } else {
  		    var keys = concat.apply([], slice.call(arguments, 1));
  		    obj = new Object(obj);
  		    for (var i = 0, length = keys.length; i < length; i++) {
  		      key = keys[i];
  		      if (key in obj) result[key] = obj[key];
  		    }
  		  }
  		  return result;
  		};
		
  		 // Return a copy of the object without the blacklisted properties.
  		_.omit = function(obj, iteratee, context) {
  		  if (_.isFunction(iteratee)) {
  		    iteratee = _.negate(iteratee);
  		  } else {
  		    var keys = _.map(concat.apply([], slice.call(arguments, 1)), String);
  		    iteratee = function(value, key) {
  		      return !_.contains(keys, key);
  		    };
  		  }
  		  return _.pick(obj, iteratee, context);
  		};
		
  		// Fill in a given object with default properties.
  		_.defaults = function(obj) {
  		  if (!_.isObject(obj)) return obj;
  		  for (var i = 1, length = arguments.length; i < length; i++) {
  		    var source = arguments[i];
  		    for (var prop in source) {
  		      if (obj[prop] === void 0) obj[prop] = source[prop];
  		    }
  		  }
  		  return obj;
  		};
		
  		// Create a (shallow-cloned) duplicate of an object.
  		_.clone = function(obj) {
  		  if (!_.isObject(obj)) return obj;
  		  return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
  		};
		
  		// Invokes interceptor with the obj, and then returns obj.
  		// The primary purpose of this method is to "tap into" a method chain, in
  		// order to perform operations on intermediate results within the chain.
  		_.tap = function(obj, interceptor) {
  		  interceptor(obj);
  		  return obj;
  		};
		
  		// Internal recursive comparison function for `isEqual`.
  		var eq = function(a, b, aStack, bStack) {
  		  // Identical objects are equal. `0 === -0`, but they aren't identical.
  		  // See the [Harmony `egal` proposal](http://wiki.ecmascript.org/doku.php?id=harmony:egal).
  		  if (a === b) return a !== 0 || 1 / a === 1 / b;
  		  // A strict comparison is necessary because `null == undefined`.
  		  if (a == null || b == null) return a === b;
  		  // Unwrap any wrapped objects.
  		  if (a instanceof _) a = a._wrapped;
  		  if (b instanceof _) b = b._wrapped;
  		  // Compare `[[Class]]` names.
  		  var className = toString.call(a);
  		  if (className !== toString.call(b)) return false;
  		  switch (className) {
  		    // Strings, numbers, regular expressions, dates, and booleans are compared by value.
  		    case '[object RegExp]':
  		    // RegExps are coerced to strings for comparison (Note: '' + /a/i === '/a/i')
  		    case '[object String]':
  		      // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
  		      // equivalent to `new String("5")`.
  		      return '' + a === '' + b;
  		    case '[object Number]':
  		      // `NaN`s are equivalent, but non-reflexive.
  		      // Object(NaN) is equivalent to NaN
  		      if (+a !== +a) return +b !== +b;
  		      // An `egal` comparison is performed for other numeric values.
  		      return +a === 0 ? 1 / +a === 1 / b : +a === +b;
  		    case '[object Date]':
  		    case '[object Boolean]':
  		      // Coerce dates and booleans to numeric primitive values. Dates are compared by their
  		      // millisecond representations. Note that invalid dates with millisecond representations
  		      // of `NaN` are not equivalent.
  		      return +a === +b;
  		  }
  		  if (typeof a != 'object' || typeof b != 'object') return false;
  		  // Assume equality for cyclic structures. The algorithm for detecting cyclic
  		  // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.
  		  var length = aStack.length;
  		  while (length--) {
  		    // Linear search. Performance is inversely proportional to the number of
  		    // unique nested structures.
  		    if (aStack[length] === a) return bStack[length] === b;
  		  }
  		  // Objects with different constructors are not equivalent, but `Object`s
  		  // from different frames are.
  		  var aCtor = a.constructor, bCtor = b.constructor;
  		  if (
  		    aCtor !== bCtor &&
  		    // Handle Object.create(x) cases
  		    'constructor' in a && 'constructor' in b &&
  		    !(_.isFunction(aCtor) && aCtor instanceof aCtor &&
  		      _.isFunction(bCtor) && bCtor instanceof bCtor)
  		  ) {
  		    return false;
  		  }
  		  // Add the first object to the stack of traversed objects.
  		  aStack.push(a);
  		  bStack.push(b);
  		  var size, result;
  		  // Recursively compare objects and arrays.
  		  if (className === '[object Array]') {
  		    // Compare array lengths to determine if a deep comparison is necessary.
  		    size = a.length;
  		    result = size === b.length;
  		    if (result) {
  		      // Deep compare the contents, ignoring non-numeric properties.
  		      while (size--) {
  		        if (!(result = eq(a[size], b[size], aStack, bStack))) break;
  		      }
  		    }
  		  } else {
  		    // Deep compare objects.
  		    var keys = _.keys(a), key;
  		    size = keys.length;
  		    // Ensure that both objects contain the same number of properties before comparing deep equality.
  		    result = _.keys(b).length === size;
  		    if (result) {
  		      while (size--) {
  		        // Deep compare each member
  		        key = keys[size];
  		        if (!(result = _.has(b, key) && eq(a[key], b[key], aStack, bStack))) break;
  		      }
  		    }
  		  }
  		  // Remove the first object from the stack of traversed objects.
  		  aStack.pop();
  		  bStack.pop();
  		  return result;
  		};
		
  		// Perform a deep comparison to check if two objects are equal.
  		_.isEqual = function(a, b) {
  		  return eq(a, b, [], []);
  		};
		
  		// Is a given array, string, or object empty?
  		// An "empty" object has no enumerable own-properties.
  		_.isEmpty = function(obj) {
  		  if (obj == null) return true;
  		  if (_.isArray(obj) || _.isString(obj) || _.isArguments(obj)) return obj.length === 0;
  		  for (var key in obj) if (_.has(obj, key)) return false;
  		  return true;
  		};
		
  		// Is a given value a DOM element?
  		_.isElement = function(obj) {
  		  return !!(obj && obj.nodeType === 1);
  		};
		
  		// Is a given value an array?
  		// Delegates to ECMA5's native Array.isArray
  		_.isArray = nativeIsArray || function(obj) {
  		  return toString.call(obj) === '[object Array]';
  		};
		
  		// Is a given variable an object?
  		_.isObject = function(obj) {
  		  var type = typeof obj;
  		  return type === 'function' || type === 'object' && !!obj;
  		};
		
  		// Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp.
  		_.each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp'], function(name) {
  		  _['is' + name] = function(obj) {
  		    return toString.call(obj) === '[object ' + name + ']';
  		  };
  		});
		
  		// Define a fallback version of the method in browsers (ahem, IE), where
  		// there isn't any inspectable "Arguments" type.
  		if (!_.isArguments(arguments)) {
  		  _.isArguments = function(obj) {
  		    return _.has(obj, 'callee');
  		  };
  		}
		
  		// Optimize `isFunction` if appropriate. Work around an IE 11 bug.
  		if (typeof /./ !== 'function') {
  		  _.isFunction = function(obj) {
  		    return typeof obj == 'function' || false;
  		  };
  		}
		
  		// Is a given object a finite number?
  		_.isFinite = function(obj) {
  		  return isFinite(obj) && !isNaN(parseFloat(obj));
  		};
		
  		// Is the given value `NaN`? (NaN is the only number which does not equal itself).
  		_.isNaN = function(obj) {
  		  return _.isNumber(obj) && obj !== +obj;
  		};
		
  		// Is a given value a boolean?
  		_.isBoolean = function(obj) {
  		  return obj === true || obj === false || toString.call(obj) === '[object Boolean]';
  		};
		
  		// Is a given value equal to null?
  		_.isNull = function(obj) {
  		  return obj === null;
  		};
		
  		// Is a given variable undefined?
  		_.isUndefined = function(obj) {
  		  return obj === void 0;
  		};
		
  		// Shortcut function for checking if an object has a given property directly
  		// on itself (in other words, not on a prototype).
  		_.has = function(obj, key) {
  		  return obj != null && hasOwnProperty.call(obj, key);
  		};
		
  		// Utility Functions
  		// -----------------
		
  		// Run Underscore.js in *noConflict* mode, returning the `_` variable to its
  		// previous owner. Returns a reference to the Underscore object.
  		_.noConflict = function() {
  		  root._ = previousUnderscore;
  		  return this;
  		};
		
  		// Keep the identity function around for default iteratees.
  		_.identity = function(value) {
  		  return value;
  		};
		
  		_.constant = function(value) {
  		  return function() {
  		    return value;
  		  };
  		};
		
  		_.noop = function(){};
		
  		_.property = function(key) {
  		  return function(obj) {
  		    return obj[key];
  		  };
  		};
		
  		// Returns a predicate for checking whether an object has a given set of `key:value` pairs.
  		_.matches = function(attrs) {
  		  var pairs = _.pairs(attrs), length = pairs.length;
  		  return function(obj) {
  		    if (obj == null) return !length;
  		    obj = new Object(obj);
  		    for (var i = 0; i < length; i++) {
  		      var pair = pairs[i], key = pair[0];
  		      if (pair[1] !== obj[key] || !(key in obj)) return false;
  		    }
  		    return true;
  		  };
  		};
		
  		// Run a function **n** times.
  		_.times = function(n, iteratee, context) {
  		  var accum = Array(Math.max(0, n));
  		  iteratee = createCallback(iteratee, context, 1);
  		  for (var i = 0; i < n; i++) accum[i] = iteratee(i);
  		  return accum;
  		};
		
  		// Return a random integer between min and max (inclusive).
  		_.random = function(min, max) {
  		  if (max == null) {
  		    max = min;
  		    min = 0;
  		  }
  		  return min + Math.floor(Math.random() * (max - min + 1));
  		};
		
  		// A (possibly faster) way to get the current timestamp as an integer.
  		_.now = Date.now || function() {
  		  return new Date().getTime();
  		};
		
  		 // List of HTML entities for escaping.
  		var escapeMap = {
  		  '&': '&amp;',
  		  '<': '&lt;',
  		  '>': '&gt;',
  		  '"': '&quot;',
  		  "'": '&#x27;',
  		  '`': '&#x60;'
  		};
  		var unescapeMap = _.invert(escapeMap);
		
  		// Functions for escaping and unescaping strings to/from HTML interpolation.
  		var createEscaper = function(map) {
  		  var escaper = function(match) {
  		    return map[match];
  		  };
  		  // Regexes for identifying a key that needs to be escaped
  		  var source = '(?:' + _.keys(map).join('|') + ')';
  		  var testRegexp = RegExp(source);
  		  var replaceRegexp = RegExp(source, 'g');
  		  return function(string) {
  		    string = string == null ? '' : '' + string;
  		    return testRegexp.test(string) ? string.replace(replaceRegexp, escaper) : string;
  		  };
  		};
  		_.escape = createEscaper(escapeMap);
  		_.unescape = createEscaper(unescapeMap);
		
  		// If the value of the named `property` is a function then invoke it with the
  		// `object` as context; otherwise, return it.
  		_.result = function(object, property) {
  		  if (object == null) return void 0;
  		  var value = object[property];
  		  return _.isFunction(value) ? object[property]() : value;
  		};
		
  		// Generate a unique integer id (unique within the entire client session).
  		// Useful for temporary DOM ids.
  		var idCounter = 0;
  		_.uniqueId = function(prefix) {
  		  var id = ++idCounter + '';
  		  return prefix ? prefix + id : id;
  		};
		
  		// By default, Underscore uses ERB-style template delimiters, change the
  		// following template settings to use alternative delimiters.
  		_.templateSettings = {
  		  evaluate    : /<%([\s\S]+?)%>/g,
  		  interpolate : /<%=([\s\S]+?)%>/g,
  		  escape      : /<%-([\s\S]+?)%>/g
  		};
		
  		// When customizing `templateSettings`, if you don't want to define an
  		// interpolation, evaluation or escaping regex, we need one that is
  		// guaranteed not to match.
  		var noMatch = /(.)^/;
		
  		// Certain characters need to be escaped so that they can be put into a
  		// string literal.
  		var escapes = {
  		  "'":      "'",
  		  '\\':     '\\',
  		  '\r':     'r',
  		  '\n':     'n',
  		  '\u2028': 'u2028',
  		  '\u2029': 'u2029'
  		};
		
  		var escaper = /\\|'|\r|\n|\u2028|\u2029/g;
		
  		var escapeChar = function(match) {
  		  return '\\' + escapes[match];
  		};
		
  		// JavaScript micro-templating, similar to John Resig's implementation.
  		// Underscore templating handles arbitrary delimiters, preserves whitespace,
  		// and correctly escapes quotes within interpolated code.
  		// NB: `oldSettings` only exists for backwards compatibility.
  		_.template = function(text, settings, oldSettings) {
  		  if (!settings && oldSettings) settings = oldSettings;
  		  settings = _.defaults({}, settings, _.templateSettings);
		
  		  // Combine delimiters into one regular expression via alternation.
  		  var matcher = RegExp([
  		    (settings.escape || noMatch).source,
  		    (settings.interpolate || noMatch).source,
  		    (settings.evaluate || noMatch).source
  		  ].join('|') + '|$', 'g');
		
  		  // Compile the template source, escaping string literals appropriately.
  		  var index = 0;
  		  var source = "__p+='";
  		  text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
  		    source += text.slice(index, offset).replace(escaper, escapeChar);
  		    index = offset + match.length;
		
  		    if (escape) {
  		      source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
  		    } else if (interpolate) {
  		      source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
  		    } else if (evaluate) {
  		      source += "';\n" + evaluate + "\n__p+='";
  		    }
		
  		    // Adobe VMs need the match returned to produce the correct offest.
  		    return match;
  		  });
  		  source += "';\n";
		
  		  // If a variable is not specified, place data values in local scope.
  		  if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n';
		
  		  source = "var __t,__p='',__j=Array.prototype.join," +
  		    "print=function(){__p+=__j.call(arguments,'');};\n" +
  		    source + 'return __p;\n';
		
  		  try {
  		    var render = new Function(settings.variable || 'obj', '_', source);
  		  } catch (e) {
  		    e.source = source;
  		    throw e;
  		  }
		
  		  var template = function(data) {
  		    return render.call(this, data, _);
  		  };
		
  		  // Provide the compiled source as a convenience for precompilation.
  		  var argument = settings.variable || 'obj';
  		  template.source = 'function(' + argument + '){\n' + source + '}';
		
  		  return template;
  		};
		
  		// Add a "chain" function. Start chaining a wrapped Underscore object.
  		_.chain = function(obj) {
  		  var instance = _(obj);
  		  instance._chain = true;
  		  return instance;
  		};
		
  		// OOP
  		// ---------------
  		// If Underscore is called as a function, it returns a wrapped object that
  		// can be used OO-style. This wrapper holds altered versions of all the
  		// underscore functions. Wrapped objects may be chained.
		
  		// Helper function to continue chaining intermediate results.
  		var result = function(obj) {
  		  return this._chain ? _(obj).chain() : obj;
  		};
		
  		// Add your own custom functions to the Underscore object.
  		_.mixin = function(obj) {
  		  _.each(_.functions(obj), function(name) {
  		    var func = _[name] = obj[name];
  		    _.prototype[name] = function() {
  		      var args = [this._wrapped];
  		      push.apply(args, arguments);
  		      return result.call(this, func.apply(_, args));
  		    };
  		  });
  		};
		
  		// Add all of the Underscore functions to the wrapper object.
  		_.mixin(_);
		
  		// Add all mutator Array functions to the wrapper.
  		_.each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
  		  var method = ArrayProto[name];
  		  _.prototype[name] = function() {
  		    var obj = this._wrapped;
  		    method.apply(obj, arguments);
  		    if ((name === 'shift' || name === 'splice') && obj.length === 0) delete obj[0];
  		    return result.call(this, obj);
  		  };
  		});
		
  		// Add all accessor Array functions to the wrapper.
  		_.each(['concat', 'join', 'slice'], function(name) {
  		  var method = ArrayProto[name];
  		  _.prototype[name] = function() {
  		    return result.call(this, method.apply(this._wrapped, arguments));
  		  };
  		});
		
  		// Extracts the result from a wrapped and chained object.
  		_.prototype.value = function() {
  		  return this._wrapped;
  		};
		
  		// AMD registration happens at the end for compatibility with AMD loaders
  		// that may not enforce next-turn semantics on modules. Even though general
  		// practice for AMD registration is to be anonymous, underscore registers
  		// as a named module because, like jQuery, it is a base library that is
  		// popular enough to be bundled in a third party lib, but not be part of
  		// an AMD load request. Those cases could generate an error when an
  		// anonymous define() is called outside of a loader request.
  		if (typeof define === 'function' && define.amd) {
  		  define('underscore', [], function() {
  		    return _;
  		  });
  		}
	}.call(this));
	
	},
	{}]
	},
{},["./js"])