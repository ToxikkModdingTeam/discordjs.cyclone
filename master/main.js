
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
