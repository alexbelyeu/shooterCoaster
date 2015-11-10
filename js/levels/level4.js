var numberOfSnowmen = 40;
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
		timerCount: 65,
		conditions: [
			{
				//No arachnids left
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