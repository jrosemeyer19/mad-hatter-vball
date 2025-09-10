function generateTeams(players, settings, roundNumber) {
  const { courtsAvailable, minPlayersPerTeam, hasPowerMatch } = settings;
  
  // Separate players by gender and characteristics
  const femaleSetters = players.filter(p => p.gender === 'female' && p.is_setter);
  const maleSetters = players.filter(p => p.gender === 'male' && p.is_setter);
  const females = players.filter(p => p.gender === 'female' && !p.is_setter);
  const males = players.filter(p => p.gender === 'male' && !p.is_setter);
  
  // Calculate team distribution
  const totalPlayers = players.length;
  const maxTeams = courtsAvailable * 2;
  const teamsNeeded = Math.min(maxTeams, Math.floor(totalPlayers / minPlayersPerTeam));
  
  if (teamsNeeded < 2) {
    throw new Error('Not enough players to form teams');
  }
  
  const playersPerTeam = Math.floor(totalPlayers / teamsNeeded);
  const extraPlayers = totalPlayers % teamsNeeded;
  
  // Create empty teams
  const teams = [];
  for (let i = 0; i < teamsNeeded; i++) {
    teams.push({
      players: [],
      targetSize: playersPerTeam + (i < extraPlayers ? 1 : 0)
    });
  }
  
  // Distribute female setters first (priority #1)
  distributeSetters(teams, femaleSetters, 'female');
  distributeSetters(teams, maleSetters, 'male');
  
  // Distribute remaining players by skill level and gender
  const remainingPlayers = [...females, ...males];
  remainingPlayers.sort((a, b) => {
    const skillOrder = { 'A': 3, 'BB': 2, 'B': 1 };
    return skillOrder[b.skill_level] - skillOrder[a.skill_level];
  });
  
  distributeRemainingPlayers(teams, remainingPlayers);
  
  // Create matches
  const matches = createMatches(teams, roundNumber, hasPowerMatch);
  
  return { teams, matches };
}

function distributeSetters(teams, setters, gender) {
  // Spread setters across different teams
  for (let i = 0; i < setters.length; i++) {
    const teamIndex = i % teams.length;
    if (teams[teamIndex].players.length < teams[teamIndex].targetSize) {
      teams[teamIndex].players.push(setters[i]);
    }
  }
}

function distributeRemainingPlayers(teams, players) {
  // Sort teams by current size to fill smaller teams first
  for (const player of players) {
    teams.sort((a, b) => a.players.length - b.players.length);
    
    // Find the team with the least players that can still accept players
    for (const team of teams) {
      if (team.players.length < team.targetSize) {
        team.players.push(player);
        break;
      }
    }
  }
}

function createMatches(teams, roundNumber, hasPowerMatch) {
  const matches = [];
  const courts = Math.ceil(teams.length / 2);
  
  // Pair teams for matches
  for (let i = 0; i < teams.length; i += 2) {
    if (i + 1 < teams.length) {
      const court = Math.floor(i / 2) + 1;
      let isPowerMatch = false;
      
      // Check if this should be the power match
      if (hasPowerMatch && roundNumber >= 3 && court === 1 && !matches.some(m => m.isPowerMatch)) {
        isPowerMatch = shouldBePowerMatch(teams[i], teams[i + 1]);
      }
      
      matches.push({
        team1: teams[i],
        team2: teams[i + 1],
        court: court,
        isPowerMatch
      });
    }
  }
  
  return matches;
}

function shouldBePowerMatch(team1, team2) {
  const getTeamStrength = (team) => {
    return team.players.reduce((sum, player) => {
      const skillPoints = { 'A': 3, 'BB': 2, 'B': 1 };
      return sum + skillPoints[player.skill_level];
    }, 0) / team.players.length;
  };
  
  const team1Strength = getTeamStrength(team1);
  const team2Strength = getTeamStrength(team2);
  
  // Power match if both teams have above-average strength
  return team1Strength >= 2.2 && team2Strength >= 2.2;
}

function balancePlayerMatches(allPlayers, tournamentRounds, matchesPerPlayer) {
  // Track how many matches each player has played
  const playerMatchCounts = {};
  allPlayers.forEach(p => playerMatchCounts[p.id] = 0);
  
  // Count matches from existing rounds
  tournamentRounds.forEach(round => {
    round.matches.forEach(match => {
      [...match.team1.players, ...match.team2.players].forEach(player => {
        if (playerMatchCounts[player.id] !== undefined) {
          playerMatchCounts[player.id]++;
        }
      });
    });
  });
  
  // Filter players who need more matches
  return allPlayers.filter(player => 
    playerMatchCounts[player.id] < matchesPerPlayer
  );
}

module.exports = { generateTeams, balancePlayerMatches };
