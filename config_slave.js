module.exports = {

	master: "http://localhost:1337",
	key: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",

	name: 'Slave01',

	servers: {
		'100' : { port:27115, game:'Duel' },
		'101' : { port:27116, game:'Duel' },
		'102' : { port:27117, game:'SA2v2' },
		'103' : { port:27118, game:'iCTF3v3' },
	},

	ip: "127.0.0.1",

	maxInstances: 3,

	updateInterval: 10000,

	launcherPath: require('path').resolve("C:/steamcmd/steamapps/common/TOXIKK/TOXIKKServers/ToxikkServerLauncher.exe"),

};