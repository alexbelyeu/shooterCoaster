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