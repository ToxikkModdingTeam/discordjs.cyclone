
const MS_SECOND = exports.MS_SECOND = 1000;
const MS_MINUTE = exports.MS_MINUTE = 60000;
const MS_HOUR = exports.MS_HOUR = 3600000;
const MS_DAY = exports.MS_DAY = 86400000;

var padnum = exports.padnum = function(n, len) {
	return ("00000000" + n).substr(-len, len);
}

var cutstring = exports.cutstring = function(str, len) {
	if ( str && str.length > len ) return str.substring(0, len-3) + "...";
	return str;
}

var GametypeToHuman = exports.GametypeToHuman = {
	crzbloodlust: "Bloodlust",
	crzteamgame: "SquadAssault",
	crzcellcapture: "CellCapture",
	crzareadomination: "AreaDomination",
	crztimetrial: "Tutorial",
	crzarchrivals: "Duel",
	stbgame: "ScoreTheBanshee",
	tagame: "TeamArena",
	infekktedgame: "Invasion",
	ttgame: "Trials",
	d2dgame: "Tox2D",
};

var HumanToGametype = exports.HumanToGametype = {};
HumanToGametype.bl = HumanToGametype.bloodlust = 'crzbloodlust';
HumanToGametype.sa = HumanToGametype.squadassault = 'crzteamgame';
HumanToGametype.cc = HumanToGametype.cellcapture = 'crzcellcapture';
HumanToGametype.ad = HumanToGametype.dom = HumanToGametype.domination = HumanToGametype.areadomination = 'crzareadomination';
HumanToGametype.ar = HumanToGametype.duel = HumanToGametype.archrivals = 'crzarchrivals';
HumanToGametype['2d'] = HumanToGametype.d2d = 'd2dgame';
HumanToGametype.tt = HumanToGametype.tr = HumanToGametype.trial = HumanToGametype.trials = 'ttgame';
HumanToGametype.if = HumanToGametype.inv = HumanToGametype.infekkted = HumanToGametype.invasion = 'infekktedgame';

var joinObjects = exports.joinObjects = function(arr, key, delim) {
	var res = "";
	for ( var i in arr ) res += arr[i][key] + delim;
	return res.substring(0,res.length-delim.length);
}

var joinCustom = exports.joinCustom = function(arr, delim, func) {
	var res = "";
	for ( var i in arr ) res += func(arr[i]) + delim;
	return res.substring(0,res.length-delim.length);
}

var plural = exports.plural = function(count, singular, plural) {
	return count + ( (count == 1) ? singular : (plural || (singular+'s')) );
}

var formatTimeSince = exports.formatTimeSince = function(timestamp) {
	var ms = (new Date()).getTime() - timestamp;
	var d = Math.floor(ms / MS_DAY);
	ms = ms % MS_DAY;
	var h = Math.floor(ms / MS_HOUR);
	if ( d > 0 ) return plural(d, " day") + " " + plural(h, " hour") + " ago";
	ms = ms % MS_HOUR;
	var m = Math.floor(ms / MS_MINUTE);
	if ( h > 0 ) return plural(h, " hour") + " " + plural(m, " minute") + " ago";
	ms = ms % MS_MINUTE;
	var s = Math.floor(ms / MS_SECOND);
	if ( m > 0 ) return plural(m, " minute") + " " + plural(s, " second") + " ago";
	ms = ms % MS_SECOND;
	return plural(s, " second") + " " + ms + " ms ago";
}

var randomItem = exports.randomItem = function(array) {
	return array[Math.floor(Math.random()*array.length)];
}

var padAlignLeft = exports.padAlignLeft = function(str, n) {
	var res = String(str).substr(0,n);
	while ( res.length < n )
		res += ' ';
	return res;
}

var padAlignRight = exports.padAlignRight = function(str, n) {
	var res = String(str).substr(0,n);
	while ( res.length < n )
		res = ' ' + res;
	return res;
}

var cmdPath = exports.cmdPath = function(path) {
	return '"' + path + '"'
}

var trySeveral = exports.trySeveral = function(func, args, maxAttemps, interval) {
	if ( maxAttemps <= 1 )
		return func(args);

	return func(args).catch(function(err) {
		return delayPromise(interval)
		.then(function() {
			return trySeveral(func, args, maxAttemps-1, interval);
		});
	});
}

var delayPromise = exports.delayPromise = function(delay) {
	return new Promise(function(resolve, reject) {
		setTimeout(resolve, delay);
	});
}