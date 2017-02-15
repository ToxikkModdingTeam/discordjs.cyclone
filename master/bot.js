
const Discord = require("discord.js");

const utils = require('./utils');

module.exports = function(Config) {


//================================================
// Public
//================================================

	var Bot = {

		dirtyTopic: false,

		setManager: function(newManager) {
			Manager = newManager;
		},

		start: function() {
			client = new Discord.Client();
			setInterval(function() { client.emit('updatetopic'); }, Config.topicUpdateInterval);
			return login();
		},

		notify: function(text) {
			return ensureSendMessage(Config.channel, "[NOTICE] " + text);
		},

	};


//================================================
// Private
//================================================

	var Manager;
	var client;

	function login() {
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
				ready();
			});
		})
	}

	function ready() {
		Bot.notify("I has rebooted :cat:");

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
				var games = [];
				for ( var g in Manager.games )
					games.push(g + " (" + Manager.games[g].curPlayers + "/" + Manager.games[g].reqPlayers + ")");
				var topic = games.join("    -    ") || "<empty>";
				if ( topic != lastTopic ) {
					ensureSendMessage(Config.channel, "Topic update:\n" + topic);
					lastTopic = topic;
				}
				Bot.dirtyTopic = false;
			}
		});

		client.on('disconnected', function(args) {
			debug("Disconnected");
			unReady();
			utils.delayPromise(1000)
			.then(function() {
				return utils.trySeveral(login, null, 100, 5000);
			})
			.catch(function(err) {
				debug("Failed to reconnect");
			});
		});
	}

	function unReady() {
		// disable handlers
		client.removeAllListeners('message');
		client.removeAllListeners('presence');
		client.removeAllListeners('updateloop');
		client.removeAllListeners('disconnected');
	}

	function userCommand(message, cmd) {
		cmd = cmd.replace(/ {2,}/g, ' ').split(' ');
		switch ( cmd[0].toLowerCase() ) {

			case 'help':
				reply(message, "```" + [
					"USAGE",
					"   " + Config.prefix + utils.padAlignLeft("add <game>", 10) + " : register for a game",
					"   " + Config.prefix + utils.padAlignLeft("add *", 10)      + " : register for all available games",
					"   " + Config.prefix + utils.padAlignLeft("add +", 10)      + " : register for all non-1v1 games",
					"   " + Config.prefix + utils.padAlignLeft("me", 10)         + " : list games you are registered for",
					"   " + Config.prefix + utils.padAlignLeft("rm", 10)         + " : unregister from all",
					"   " + Config.prefix + utils.padAlignLeft("rm <game>", 10)  + " : unregister from a game",
					"   " + Config.prefix + utils.padAlignLeft("info", 10)       + " : show bot state info",
				].join('\n') + "```");
				break;

			case 'info':
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
					lines.push("   " + utils.padAlignLeft(g, 10) + " » "+ games[g].machines + " machines - " + games[g].numInstances + "/" + games[g].maxInstances + " instances - " + Manager.games[g].curPlayers + "/" + Manager.games[g].reqPlayers + " players");
				lines.push("");
				lines.push("MACHINES");
				for ( var id in Manager.slaves )
					lines.push("   " + utils.padAlignLeft(Manager.slaves[id].name, 16) + " » " + Manager.slaves[id].numInstances + "/" + Manager.slaves[id].maxInstances + " instances - " + Object.keys(Manager.slaves[id].games).join(", "));

				reply(message, "```\n" + lines.join('\n') + "```");
				break;

			case 'add':
			case 'a':
				if ( cmd.length < 2 ) cmd.push("*");
				var ok = [];
				if ( cmd.indexOf("*") != -1 || cmd.indexOf("all") != -1 ) {
					for ( var g in Manager.games ) {
						if ( Manager.registerPlayer(message.author, g) )
							ok.push(g);
					}
				}
				else {
					if ( cmd.indexOf("+") != -1 ) {
						for ( var g in Manager.games ) {
							if ( Manager.Games[g].reqPlayers > 2 && Manager.registerPlayer(message.author, g) )
								ok.push(g);
						}
					}
					for ( var i=1; i<cmd.length; i++ ) {
						var g = Manager.gameMap[cmd[i].toLowerCase()];
						if ( Manager.registerPlayer(message.author, g) )
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

	function ensureSendMessage(chan, text) {
		return trySeveral(sendMessage, {chan:chan,text:text}, 5, 1000)
		.catch(function(err) {
			debug("Failed to send message:", err);
		});
	}

	function reply(message, text) {
		ensureSendMessage(message.channel, message.author.mention() + " » " + text);
	}

	function debug(key, obj) {
		console.log("[Bot] " + key + (obj !== undefined ? ('=' + JSON.stringify(obj)) : "") );
	}


//================================================
	return Bot;
};