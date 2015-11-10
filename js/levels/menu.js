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
	//manager : {  //SOBRA
	//	object: require("../managers/Manager"),
	//	properties: {
	//		entityType: require('../entities/Minions'),
	//		count: 1
	//	}
	//},
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