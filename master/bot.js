
const Discord = require("discord.js");

const utils = require('./utils');

module.exports = function(Config) {


//================================================
// Public
//================================================

	var Bot = {

		dirtyTopic: true,

		setManager: function(newManager) {
			Manager = newManager;
		},

		start: function(isReload) {
			client = new Discord.Client();
			setInterval(function() { client.emit('updatetopic'); }, Config.topicUpdateInterval);
			return login(isReload);
		},

		notify: function(text) {
			return utils.trySeveral(sendMessage, { chan: Config.channel, text: "[NOTICE] " + text }, 5, 1000)
			.catch(function(err) {
				debug("Failed to send message: ", err);
				throw err;
			});
		},

		setStatus: function(status) {
			if ( status != currentStatus ) {
				debug("Set status '" + status + "'");
				//NOTE: don't try several as this could get spammy  (no managed loop)
				return setPlayingGame(status)
				.then(function() {
					currentStatus = status;
				});
			}
		},

		shutdown: function() {
			debug("Shutting down...");
			return client.destroy().catch(err => {
				debug("Failed to destroy", err);
				unReady();	// logout doesn't work...
			});
		},
	};


//================================================
// Private
//================================================

	var Manager;
	var client;

	var bStartup = true;
	var currentStatus = "";

	function login(isReload) {
		return new Promise(function(resolve, reject) {
			client.login(Config.login, Config.pass, function(err, token) {
				if ( err )
					reject(err);
				else
					resolve(token);
			});
		})
		.then(function(token) {
			debug("Logged in");
			return utils.delayPromise(1000)
			.then(function() {
				//var CHAN_PUG = client.channels.get('id', Config.channel);
				//debug(CHAN_PUG);
				ready(isReload);
			});
		})
	}

	function ready(isReload) {

		// Complete reboot ie. lost live data
		if ( bStartup && !isReload )
			Bot.notify("I has rebooted :cat:");

		// coming back from disconnect - set status back
		if ( !bStartup )
			Bot.setStatus(currentStatus);

		bStartup = false;

		// setup handlers

		client.on('message', function(message) {
			if ( message.content.toLowerCase().startsWith(Config.prefix+'a ') && message.author.id == Config.admin )
				adminCommand(message, message.content.substr(Config.prefix.length+2));
			else if ( message.content.startsWith(Config.prefix) && message.channel.id == Config.channel )
				userCommand(message, message.content.substr(Config.prefix.length));
		});

		var goingOffline = {};

		client.on('presence', function(userBefore, userAfter) {
			if ( userBefore.status != userAfter.status ) {
				// user going offline - give him 2 minutes before kick
				if ( userAfter.status == 'offline' ) {
					goingOffline[userBefore.id] = setTimeout(function() {
						var c = 0;
						for ( var g in Manager.games )
							if ( Manager.unregisterPlayer(userBefore, g) ) c++;
						if ( c > 0 ) Bot.notify(userBefore.name + " went offline and was removed from games");
						delete goingOffline[userBefore.id];
					}, Config.offlineKickDelay);
				}
				else if ( userAfter.status == 'online' && goingOffline[userBefore.id] ) {
					clearTimeout(goingOffline[userBefore.id]);
					delete goingOffline[userBefore.id];
				}
			}
		});

		var lastTopic = "BLEH";
		client.on('updatetopic', function() {
			if ( Bot.dirtyTopic ) {
				Bot.dirtyTopic = false;

				var games = [];
				for ( var g in Manager.games )
					games.push(g + " (" + Manager.games[g].curPlayers + "/" + Manager.games[g].reqPlayers + ")");
				var topic = games.join("   -   ") || "<empty>";
				if ( topic != lastTopic ) {
					debug("Topic update: " + topic);
					Promise.resolve()
					.then(function() {
						if ( Config.hasTopicPerms ) {
							// try to make it blink
							return setChannelTopic({chan:Config.channel, topic: " "})
							.catch(function(err) {})
							.then(function() {
								return utils.delayPromise(500);
							})
							.then(function() {
								return utils.trySeveral(setChannelTopic, {chan:Config.channel, topic:topic}, 3, 1000);
							});
						}
						else
							return utils.trySeveral(sendMessage, {chan:Config.channel, text:topic}, 3, 1000);
					})
					.then(function() {
						lastTopic = topic;
					})
					.catch(function(err) {
						debug("Failed to update topic: ", err);
						//Bot.dirtyTopic = true;	//retry later ?
					});
				}
			}
		});

		client.on('disconnected', function(args) {
			debug("Disconnected");
			unReady();
			utils.delayPromise(1000)
			.then(utils.trySeveral(login, null, 100, 5000))
			.catch(err => {
				debug("Failed to reconnect: ", err);
				process.exit(1);
			});
		});
	}

	function unReady() {
		// disable handlers
		client.removeAllListeners('message');
		client.removeAllListeners('presence');
		client.removeAllListeners('updatetopic');
		client.removeAllListeners('disconnected');
	}

	function userCommand(message, cmd) {
		var addCount = 0;
		cmd = cmd.replace(/ {2,}/g, ' ').split(' ');
		switch ( cmd[0].toLowerCase() ) {

			case 'help':
				reply(message, "```" + [
					"USAGE",
					"   " + Config.prefix + "add <game>  : register for game(s)",
					"   " + Config.prefix + "add *       : register for all available games",
					"   " + Config.prefix + "add +       : register for all non-1v1 games",
					"   " + Config.prefix + "add# <game> : register # players for game(s)",
					"   " + Config.prefix + "me          : list games you registered for",
					"   " + Config.prefix + "rm          : unregister from all",
					"   " + Config.prefix + "rm <game>   : unregister from game(s)",
					"   " + Config.prefix + "info        : show bot state info",
				].join('\n') + "```");
				break;

			case 'info':
			case 'status':
				//precalc
				var games = {};
				for ( var id in Manager.slaves ) {
					for ( var g in Manager.slaves[id].games ) {
						games[g] || (games[g] = {machines:0, numInstances:0, maxInstances:0});
						games[g].machines++;
						for ( var s in Manager.slaves[id].games[g] ) {
							games[g].maxInstances++;
							if ( Manager.slaves[id].games[g][s] )
								games[g].numInstances++;
						}
					}
				}
				//message
				var lines = [];
				lines.push("GAMEMODES");
				for ( var g in games )
					lines.push("   " + utils.padAlignLeft(g, 10) + " » "+ utils.plural(games[g].machines, " machine") + " - " + games[g].numInstances + "/" + games[g].maxInstances + " instances - " + Manager.games[g].curPlayers + "/" + Manager.games[g].reqPlayers + " players");
				lines.push("");
				lines.push("MACHINES");
				for ( var id in Manager.slaves )
					lines.push("   " + utils.padAlignLeft(Manager.slaves[id].name, 12) + " » " + Manager.slaves[id].numInstances + "/" + Manager.slaves[id].maxInstances + " instances for " + Object.keys(Manager.slaves[id].games).join(", "));

				reply(message, "```\n" + lines.join('\n') + "```");
				break;

			case 'add':
			case 'add1':
				addCount = 1;
			case 'add2':
			case 'add3':
			case 'add4':
				if ( !addCount ) addCount = parseInt(cmd[0].substr(3));

				if  ( !addCount )
					return;

				if ( cmd.length < 2 ) cmd.push("*");
				var ok = [];
				if ( cmd.indexOf("*") != -1 || cmd.indexOf("all") != -1 ) {
					for ( var g in Manager.games ) {
						if ( Manager.registerPlayer(message.author, addCount, g) )
							ok.push(g);
					}
				}
				else {
					if ( cmd.indexOf("+") != -1 ) {
						for ( var g in Manager.games ) {
							if ( Manager.games[g].reqPlayers > 2 && Manager.registerPlayer(message.author, addCount, g) )
								ok.push(g);
						}
					}
					for ( var i=1; i<cmd.length; i++ ) {
						var g = Manager.gameMap[cmd[i].toLowerCase()];
						if ( Manager.registerPlayer(message.author, addCount, g) )
							ok.push(g);
					}
				}
				if ( ok.length > 0 )
					reply(message, "Registered for " + ok.join(", "));
				else
					reply(message, "Failed to register for '" + cmd.slice(1).join(", ") + "'");
				break;

			case 'remove':
			case 'rm':
				if ( cmd.length < 2 ) cmd.push("*");
				if ( cmd.indexOf("*") != -1 || cmd.indexOf("all") != -1 ) {
					for ( var g in Manager.games )
						Manager.unregisterPlayer(message.author, g);
					return reply(message, "Unregistered from all games");
				}
				var ok = [];
				for ( var i=1; i<cmd.length; i++ ) {
					var g = Manager.gameMap[cmd[i].toLowerCase()];
					if ( Manager.unregisterPlayer(message.author, g) )
						ok.push(g);
				}
				if ( ok.length > 0 )
					reply(message, "Unregistered from " + ok.join(", "));
				else
					reply(message, "Failed to unregister from '" + cmd.slice(1).join(", ") + "'");
				break;

			case 'me':
				var games = [];
				for ( var g in Manager.games ) {
					if ( Manager.isRegistered(message.author, g) )
						games.push(g+" (" + Manager.games[g].curPlayers + "/" + Manager.games[g].reqPlayers + ")");
				}
				if ( games.length > 0 )
					reply(message, "You are registered for " + games.join(" , "));
				else
					reply(message, "You are not registered");
				break;
		}
	}

	function adminCommand(message, cmd) {
	}


//================================================
// Utils
//================================================

	function sendMessage(args) {
		return new Promise(function(resolve, reject) {
			client.sendMessage(args.chan, args.text, {}, function(err, message) {
				if ( err )
					reject(err);
				else
					resolve(message);
			});
		});
	}

	function reply(message, text) {
		return utils.trySeveral(sendMessage, {
			chan: message.channel,
			text: message.author.mention() + " » " + text,
		}, 5, 1000)
		.catch(function(err) {
			debug("Failed to send message: ", err);
			throw err;
		});
	}

	function setChannelTopic(args) {
		return new Promise(function(resolve, reject) {
			client.setChannelTopic(args.chan, args.topic, function(err, message) {
				if ( err )
					reject(err);
				else
					resolve(message);
			});
		});
	}

	function setPlayingGame(game) {
		return new Promise(function(resolve, reject) {
			client.setPlayingGame(game, function(err) {
				if ( err )
					reject(err);
				else
					resolve();
			});
		});
	}

	function debug(key, obj) {
		console.log("[Bot] " + key + (obj !== undefined ? ('=' + JSON.stringify(obj)) : "") );
	}


//================================================
	return Bot;
};