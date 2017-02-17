//================================================================
// ServerPug.PugConfig
// ----------------
// ...
// ----------------
// by Chatouille
//================================================================
class PugConfig extends Object
	Config(PugServer);

/** How long to wait for first player to join server */
var config int FirstWaitTime;

/** How long to wait for players to rejoin after map change */
var config int TravelWaitTime;

/** How long to wait after all players have left */
var config int ShutdownDelay;

function Init()
{
	if ( FirstWaitTime == 0 )
		FirstWaitTime = 120;
	if ( TravelWaitTime == 0 )
		TravelWaitTime = 120;
	if ( ShutdownDelay == 0 )
		ShutdownDelay = 120;
	SaveConfig();
}
