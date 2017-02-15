
const io = require('socket.io-client');
const exec = require('child_process').exec;

const Config = require('./config');

var status = {
	name: Config.name,
	maxInstances: Config.maxInstances,
	numInstances: 0,
	games: {},
};

for ( var s in Config.servers ) {
	var g = Config.servers[s].game;
	if ( !status.games[g] ) status.games[g] = {};
	status.games[g][s] = true;	//init all servers as 'busy' so updateLoop should see an update
}


//================================================
// Main
//================================================

console.log("Connecting...");

var socket = io.connect(Config.master, {});

socket.on('connect', function() {
	console.log("Connected - sending auth");
	socket.emit('auth', Config.key);
	updateLoop();
});

socket.on('launch', function(s) {
	return launchServer(s)
	.then(function(link) {
		socket.emit('launch', link);
	})
	.catch(function(err) {
		console.error(err);
	});
});

socket.on('disconnect', function() {
	console.log("Disconnected");
	process.exit(0);
});

function updateLoop() {
	listServers()
	.then(function(running) {
		return new Promise(function(resolve, reject) {
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
			resolve(bDirty);
		});
	})
	.then(function(bDirty) {
		if ( bDirty ) {
			console.log("Sending status");
			socket.emit('status', status);
		}
		setTimeout(updateLoop, 10000);
	})
	.catch(function(err) {
		console.error("Failed to update status", err, err.stack);
	})
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
