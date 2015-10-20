var numberOfJellies = 5;

module.exports = {
	name : "Intro",
	description : "Invasion of the Jellies",
	order : 1,
	maxScore : 13 * numberOfJellies,
	config : {
		r : 120,
		height : 60,
		circumference : 900,
		cameraMultiplier : 2,
		scoringAndWinning: {
			message: "You saved this sector<br/>on to the next level.",
			nextLevel: "asteroidsJellies",
			conditions: [
				{
					//Jelly manager has 0 live ships
					component: "jellyManager",
					properties: null
				}
			]
		},
		stars: {
			count: 3000
		}
	},
	objects : {
		cylinderLines : {
			object: require("../components/CylinderLines"),
			properties: {}
		},
		cameraIntro : {
			object: require("../components/CameraIntro"),
			properties: {
				speed : 0.985
			}
		},
		jellyManager : {
			object: require("../managers/EntityManager"),
			properties: {
				entityType: require('../entities/Jellyship'),
				count: numberOfJellies
			}
		},
		music : {
			object: require("../sound/Music"),
			properties: {
				url: "https://soundcloud.com/theelectrochippers/the-sun-is-rising-chip-music"
			}
		}
	}
};