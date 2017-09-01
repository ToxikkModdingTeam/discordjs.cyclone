
const io = require('socket.io-client');
const exec = require('child_process').exec;

const Config = require('./config');
const status = {};

function initStatus() {
	status.name = Config.name;
	status.maxInstances = Config.maxInstances;
	status.numInstances = 0;
	status.games = {};
	for ( var s in Config.servers ) {
		var g = Config.servers[s].game;
		status.games[g] || (status.games[g] = {});
		status.games[g][s] = true;	//init all servers as 'busy' so updateLoop should see an update
	}
}


//================================================
// Main
//================================================

const RETRY_INTERVAL = 1000;
var RETRY_COUNT = 1;

var loop = null;

keepAlive();
function keepAlive() {
	connect()
	.then(socket => {
		RETRY_COUNT = 1;

		socket.on('error', onerror);
		socket.on('disconnect', _ => onerror("[DISCONNECT]"));

		socket.on('launch', function(s) {
			return launchServer(s)
			.then(link => socket.emit('launch', link))
			.catch(err => console.error("Failed to launch server", err));
		});

		initStatus();
		updateLoop(socket);

	})
	.catch(onerror);

	function onerror(err) {
		console.error(err);
		clearTimeout(loop);
		setTimeout(keepAlive, RETRY_INTERVAL*(RETRY_COUNT++));
	}
}

function updateLoop(socket) {
	loop = null;
	listServers()
	.then(running => {
		var bDirty = false;
		var numInstances = 0;
		for ( var g in status.games ) {
			for ( var s in status.games[g] ) {
				if ( running[s] != status.games[g][s] ) {
					if ( running[s] === undefined ) {
						console.log("[ERROR] Server " + s + " does not exist in ServerLauncher configuration!");
						delete status.games[g][s];
					}
					else
						status.games[g][s] = running[s];
					bDirty = true;
				}
				if ( running[s] )
					numInstances++;
			}
			if ( Object.keys(status.games[g]).length == 0 )
				delete status.games[g];
		}
		if ( numInstances != status.numInstances ) {
			status.numInstances = numInstances;
			bDirty = true;
		}

		if ( bDirty ) {
			console.log("Sending status");
			socket.emit('status', status);
		}
	})
	.catch(err => console.error("Failed to update status", err, err.stack))
	.then(_ => {
		loop = setTimeout(updateLoop, Config.updateInterval, socket);
	});
}


//================================================
// Socket wrappers
//================================================

function connect() {
	console.log("Connecting...");
	return new Promise((resolve, reject) => {
		var socket = io.connect(Config.master, {});
		socket.on('error', reject);
		socket.on('connect', _ => {
			setTimeout(function() {
				socket.emit('auth', Config.key);
				socket.removeListener('error', reject);
				resolve(socket);
			}, 1000);
		});
	});
}


//================================================
// Server launcher
//================================================

function listServers() {
	var cmd = [Config.launcherPath, "list"].join(' ');
	return execPromise(cmd)
	.then(function(stdout) {
		var result = {};
		var lines = stdout.split('\n');
		for ( var i=0; i<lines.length; i++ ) {
			if ( m = lines[i].match(/^ *([0-9]+): (.) /) )
				result[m[1]] = (m[2] == '*');
		}
		return result;
	});
}

function launchServer(s) {
	var pass = randStr(6);
	var cmd = [ Config.launcherPath, s, "@pugpass@="+pass ].join(' ');
	console.log("Launching server: `" + cmd + "`");
	return execPromise(cmd)
	.then(function(stdout) {
		return "steam://connect/" + Config.ip + ":" + Config.servers[s].port + "/" + pass;
	});
}


//================================================
// Dynamic reloads (only partially supported)
//================================================

function reloadConfig() {
	console.log("Reloading config...");
	delete require.cache[require.resolve('./config')];
	var newConf = require('./config');
	for ( var k in newConf )
		Config[k] = newConf[k];
	initStatus();
}
require('fs').watchFile(require.resolve('./config'), reloadConfig);


//================================================
// Utils
//================================================

function execPromise(cmd) {
	return new Promise(function(resolve, reject) {
		exec(cmd, function(err, stdout, stderr) {
			if ( err )
				reject({err:err, stdout:stdout, stderr:stderr});
			else
				resolve(stdout);
		});
	});
}

const CHARS = Array.from("abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ");
function randStr(len) {
	var str = "";
	for ( var i=0; i<len; i++ )
		str += CHARS[ Math.floor(Math.random()*CHARS.length) ];
	return str;
}
