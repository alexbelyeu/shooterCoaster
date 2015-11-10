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