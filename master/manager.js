
const http = require('http');
const socketio = require('socket.io');

const utils = require('./utils');

module.exports = function(Config) {


//================================================
// Public
//================================================

	var Manager = {

		slaves: {},
		games: {},
		gameMap: {},

		setBot: function(newBot) {
			Bot = newBot;
		},

		start: function() {
			return Promise.resolve()
			.then(function() {
				server = http.createServer();
				io = require('socket.io').listen(server);
				io.on('connection', handleSlave);
				return new Promise(function(resolve, reject) {
					server.listen(Config.port, function(err) {
						if ( err )
							reject(err);
						else
							resolve();
					});
				})
				.then(function() {
					debug("Master listening on port " + Config.port);
					launcherLoop();
				});
			});
		},

		registerPlayer: function(user, g) {
			if ( Manager.games[g] && !Manager.games[g].players[user.id] ) {
				Manager.games[g].players[user.id] = { name:user.name, mention:user.mention() };
				Manager.games[g].curPlayers++;
				Bot.dirtyTopic = true;
				checkLaunchGame = true;
				return true;
			}
			return false;
		},

		unregisterPlayer: function(user, g) {
			if ( Manager.games[g] && Manager.games[g].players[user.id] ) {
				delete Manager.games[g].players[user.id];
				Manager.games[g].curPlayers--;
				Bot.dirtyTopic = true;
				return true;
			}
			return false;
		},

		isRegistered: function(user, g) {
			return (Manager.games[g] && Manager.games[g].players[user.id]);
		}

	};


//================================================
// Private
//================================================

	var Bot;
	var server, io;
	var checkLaunchGame = false;

	function handleSlave(socket) {
		debug("Slave connected - waiting for auth");
		auth();

		function auth() {
			//socket.emit('auth', "HOI. GIB KEY");

			var authTimeout = setTimeout(function() {
				debug("Booting slave (auth timeout)");
				socket.disconnect(true);
			}, Config.slaveAuthTimeout);

			socket.once('auth', function(data) {
				if ( data == Config.slaveKey ) {
					clearTimeout(authTimeout);
					ready();
				}
				else {
					debug("Booting slave (auth failed)");
					socket.disconnect(true);
				}
			});
		}

		function ready() {
			debug("Slave authed");

			var slave = { socket:socket, name:undefined, maxInstances:0, numInstances:0, games:{}, actualGames:{} };
			Manager.slaves[socket.id] = slave;

			socket.on('status', function(status) {
				debug("Slave updated status", status);
				for ( var k in status ) slave[k] = status[k];
				recalcAdvertisedGames();
			});

			socket.on('disconnect', function() {
				delete Manager.slaves[socket.id];
				recalcAdvertisedGames();
			});
		}
	}

	function recalcAdvertisedGames() {
		var newGames = {};
		var numInstances = 0, maxInstances = 0;
		for ( var id in Manager.slaves ) { var slave = Manager.slaves[id];
			numInstances += slave.numInstances;
			maxInstances += slave.maxInstances;
			for ( var g in slave.games ) {
				if ( Object.keys(slave.games).length > 0 ) {
					newGames[g] = Manager.games[g];
					if ( !newGames[g] ) {
						newGames[g] = { reqPlayers:Config.games[g], curPlayers:0, players:{} };
						Manager.gameMap[ g.toLowerCase() ] = g;
					}
				}
				else
					delete slave.games[g];
			}
		}
		Manager.games = newGames;
		Bot.setStatus(numInstances + "/" + maxInstances + " instances");
		Bot.dirtyTopic = true;
		checkLaunchGame = true;
		debug("Advertised games: ", Manager.games);
	}

	function launcherLoop() {
		Promise.resolve()
		.then(function() {

			if ( !checkLaunchGame )
				return;

			checkLaunchGame = false;

			var games = [];
			for ( var g in Manager.games ) {
				if ( Manager.games[g].curPlayers >= Manager.games[g].reqPlayers )
					games.push({ g:g, curPlayers:Manager.games[g].curPlayers, reqPlayers:Manager.games[g].reqPlayers });
			}
			if ( games.length == 0 )
				return;

			games.sort(function(g1,g2) { return (g2.reqPlayers - g1.reqPlayers); });
			for ( var i=0; i<games.length; i++ ) {
				var g = games[i].g;

				for ( var id in Manager.slaves ) { var slave = Manager.slaves[id];
					if ( !slave.games[g] )
						continue;

					for ( var s in slave.games[g] ) {
						if ( slave.games[g][s] === true )
							continue;

						debug("Preparing server " + slave.name + ":" + s);
						Bot.notify("Preparing a " + g + " server ...");

						return launchServer(slave, s)
						.then(function(link) {
							debug("Server " + slave.name + ":" + s + " launching");
							var mentions = [];
							for ( var p in Manager.games[g].players ) {
								mentions.push(Manager.games[g].players[p].mention);
								unregisterAuto(p);
							}
							Bot.notify([
								"Launching " + g + " server now :smiley_cat:",
								mentions.join(" "),
								"Join link: " + link,
							].join('\n'));
						})
						.catch(function(err) {
							debug("Failed to launch server (" + slave.name + " : " + s + ")", err);
							Bot.notify("Failed to launch server :crying_cat_face:");
						});
					}
				}
			}
		})
		.then(function() {
			setTimeout(launcherLoop, Config.launcherLoopInterval);
		});
	}

	function launchServer(slave, s) {
		return new Promise(function(resolve, reject) {
			slave.socket.emit('launch', s);

			var timeout = setTimeout(function() {
				slave.socket.removeAllListeners('launch');
				reject(new Error("Launch timeout"));
			}, Config.launchServerTimeout);

			slave.socket.once('launch', function(link) {
				clearTimeout(timeout);
				resolve(link);
			});
		});
	}

	function unregisterAuto(p) {
		for ( var g in Manager.games ) {
			if ( Manager.games[g].players[p] ) {
				delete Manager.games[g].players[p];
				Manager.games[g].curPlayers--;
				Bot.dirtyTopic = true;
			}
		}
	}


//================================================
// Utils
//================================================

	function debug(key, obj) {
		console.log("[Manager] " + key + (obj !== undefined ? ('=' + JSON.stringify(obj)) : "") );
	}


//================================================
	return Manager;
};