
const Config = require('./config');

var Bot = require('./bot')(Config);
var Manager = require('./manager')(Config);

Bot.setManager(Manager);
Manager.setBot(Bot);

Promise.all([
	Bot.start(),
	Manager.start(),
])
.then(function() {
	console.log("[Main] OK");
})
.catch(function(err) {
	console.error("[Main] ERROR", err.stack);
	process.exit(1);
});


//================================================
// Dynamic reloads (only partially supported)
//================================================

function reloadConfig() {
	console.log("Reloading config...");
	delete require.cache[require.resolve('./config')];
	var newConf = require('./config');
	for ( var k in newConf )
		Config[k] = newConf[k];
}
require('fs').watchFile(require.resolve('./config'), reloadConfig);

function reloadBot() {
	console.log("Reloading bot...");
	Bot.shutdown()
	.then(_ => {
		delete require.cache[require.resolve('./bot')];
		Bot = require('./bot')(Config);
		Bot.setManager(Manager);
		Manager.setBot(Bot);

		Bot.start(true);
	});
}
require('fs').watchFile(require.resolve('./bot'), reloadBot);

function reloadManager() {
	console.log("Reloading manager...");

	var games = Manager.games;

	Manager.shutdown();

	delete require.cache[require.resolve('./manager')];
	Manager = require('./manager')(Config);
	Bot.setManager(Manager);
	Manager.setBot(Bot);

	Manager.start();
	Manager.games = games;
}
require('fs').watchFile(require.resolve('./manager'), reloadManager);
