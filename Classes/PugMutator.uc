//================================================================
// ServerPug.PugMutator
// ----------------
// ...
// ----------------
// by Chatouille
//================================================================
class PugMutator extends CRZMutator
	config(Game);


var PugConfig Conf;

/** Number of games played on this instance */
var config int MapCount;
var int iMapCount;


event PostBeginPlay()
{
	Super.PostBeginPlay();

	Conf = new(None) class'PugConfig';
	Conf.Init();

	if ( MapCount > 0 )
	{
		iMapCount = MapCount;
		MapCount = 0;
		SaveConfig();
		SetTimer(class'PugConfig'.default.TravelWaitTime, false, 'AutoShutdown');
	}
	else
		SetTimer(class'PugConfig'.default.FirstWaitTime, false, 'AutoShutdown');
}


function NotifyLogin(Controller NewPlayer)
{
	Super.NotifyLogin(NewPlayer);

	if ( PlayerController(NewPlayer) != None )
		ClearTimer('AutoShutdown');
}


function NotifyLogout(Controller Exiting)
{
	local PlayerController PC;

	Super.NotifyLogout(Exiting);

	foreach WorldInfo.AllControllers(class'PlayerController', PC)
	{
		if ( PC != Exiting && !PC.PlayerReplicationInfo.bOnlySpectator )
			return;     // found an active player
	}

	SetTimer(class'PugConfig'.default.ShutdownDelay, false, 'AutoShutdown');
}


function AutoShutdown()
{
	MapCount = 0;
	SaveConfig();
	ConsoleCommand("exit");
}


// Called when travelling to next map
function bool HandleRestartGame()
{
	MapCount = iMapCount+1;
	SaveConfig();
	return false;
}


defaultproperties
{
	GroupNames[0]="SERVERCONTROL"
}
