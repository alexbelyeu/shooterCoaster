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