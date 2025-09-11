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
  
  // Create empty teams with gender tracking
  const teams = [];
  for (let i = 0; i < teamsNeeded; i++) {
    teams.push({
      players: [],
      targetSize: playersPerTeam + (i < extraPlayers ? 1 : 0),
      maleCount: 0,
      femaleCount: 0
    });
  }
  
  // Distribute female setters first (priority #1)
  distributeSetters(teams, femaleSetters, 'female');
  distributeSetters(teams, maleSetters, 'male');
  
  // Distribute remaining players with gender balance priority
  distributePlayersWithGenderBalance(teams, [...females, ...males]);
  
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
      if (gender === 'male') {
        teams[teamIndex].maleCount++;
      } else {
        teams[teamIndex].femaleCount++;
      }
    }
  }
}

function distributePlayersWithGenderBalance(teams, players) {
  // Separate by gender
  const males = players.filter(p => p.gender === 'male');
  const females = players.filter(p => p.gender === 'female');
  
  // Sort by skill level (highest first)
  const skillOrder = { 'A': 3, 'BB': 2, 'B': 1 };
  males.sort((a, b) => skillOrder[b.skill_level] - skillOrder[a.skill_level]);
  females.sort((a, b) => skillOrder[b.skill_level] - skillOrder[a.skill_level]);
  
  // Calculate target gender distribution
  const totalMales = males.length + teams.reduce((sum, team) => sum + team.maleCount, 0);
  const totalFemales = females.length + teams.reduce((sum, team) => sum + team.femaleCount, 0);
  const totalPlayers = totalMales + totalFemales;
  
  // Distribute males first (priority on gender balance)
  for (const male of males) {
    const bestTeam = findBestTeamForGender(teams, 'male', totalMales, totalPlayers);
    if (bestTeam && bestTeam.players.length < bestTeam.targetSize) {
      bestTeam.players.push(male);
      bestTeam.maleCount++;
    }
  }
  
  // Distribute females
  for (const female of females) {
    const bestTeam = findBestTeamForGender(teams, 'female', totalFemales, totalPlayers);
    if (bestTeam && bestTeam.players.length < bestTeam.targetSize) {
      bestTeam.players.push(female);
      bestTeam.femaleCount++;
    }
  }
}

function findBestTeamForGender(teams, gender, totalGenderCount, totalPlayers) {
  // Calculate ideal gender distribution per team
  const avgPlayersPerTeam = totalPlayers / teams.length;
  const idealGenderPerTeam = (totalGenderCount / teams.length);
  
  // Find team with lowest gender count that still has space
  const availableTeams = teams.filter(team => team.players.length < team.targetSize);
  
  if (availableTeams.length === 0) return null;
  
  // Sort by: 1) lowest gender count, 2) lowest total players, 3) skill balance
  availableTeams.sort((a, b) => {
    const aGenderCount = gender === 'male' ? a.maleCount : a.femaleCount;
    const bGenderCount = gender === 'male' ? b.maleCount : b.femaleCount;
    
    // Primary: teams with fewer of this gender
    if (aGenderCount !== bGenderCount) {
      return aGenderCount - bGenderCount;
    }
    
    // Secondary: teams with fewer total players
    if (a.players.length !== b.players.length) {
      return a.players.length - b.players.length;
    }
    
    // Tertiary: balance overall gender ratio
    const aRatio = a.maleCount / (a.players.length || 1);
    const bRatio = b.maleCount / (b.players.length || 1);
    const idealRatio = 0.5; // aim for 50/50
    
    return Math.abs(aRatio - idealRatio) - Math.abs(bRatio - idealRatio);
  });
  
  return availableTeams[0];
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
