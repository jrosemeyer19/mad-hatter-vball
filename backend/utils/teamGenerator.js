function generateAllRounds(players, settings) {
  const { courtsAvailable, minPlayersPerTeam, matchesPerPlayer, hasPowerMatch } = settings;
  const maxPlayersPerTeam = 6; // Hard limit
  
  const allRounds = [];
  const playerMatchCounts = {};
  const playerOpponents = {}; // Track who has played against whom
  const playerByeCount = {}; // Track how many byes each player has had
  
  // Initialize tracking
  players.forEach(p => {
    playerMatchCounts[p.id] = 0;
    playerOpponents[p.id] = new Set();
    playerByeCount[p.id] = 0;
  });
  
  let roundNumber = 1;
  const maxRounds = Math.ceil(matchesPerPlayer * 1.5); // Safety limit
  
  // Calculate optimal players per round
  const maxPlayersPerRound = courtsAvailable * 2 * maxPlayersPerTeam;
  const optimalPlayersPerRound = courtsAvailable * 2 * minPlayersPerTeam;
  
  // Generate rounds until all players have played their required matches
  while (roundNumber <= maxRounds) {
    // Find players who still need matches
    const playersNeedingMatches = players.filter(player => 
      playerMatchCounts[player.id] < matchesPerPlayer
    );
    
    if (playersNeedingMatches.length === 0) {
      break; // All players have completed their matches
    }
    
    if (playersNeedingMatches.length < minPlayersPerTeam * 2) {
      console.warn(`Round ${roundNumber}: Only ${playersNeedingMatches.length} players need matches, cannot form teams`);
      break;
    }
    
    // Determine how many players should play this round
    let targetPlayingPlayers;
    
    if (playersNeedingMatches.length <= maxPlayersPerRound) {
      // If we can fit everyone, play everyone
      targetPlayingPlayers = playersNeedingMatches.length;
    } else {
      // Calculate optimal number based on even distribution
      const remainingMatchesNeeded = playersNeedingMatches.reduce(
        (sum, player) => sum + (matchesPerPlayer - playerMatchCounts[player.id]), 0
      );
      const estimatedRoundsLeft = Math.ceil(remainingMatchesNeeded / maxPlayersPerRound);
      
      // Try to distribute evenly, but prioritize players with fewer matches and fewer byes
      targetPlayingPlayers = Math.min(maxPlayersPerRound, 
        Math.max(optimalPlayersPerRound, 
          Math.floor(playersNeedingMatches.length / Math.max(1, estimatedRoundsLeft)) * courtsAvailable * 2
        )
      );
    }
    
    // Select players for this round with intelligent prioritization
    const selectedPlayers = selectPlayersForRound(
      playersNeedingMatches, 
      targetPlayingPlayers, 
      playerMatchCounts, 
      playerByeCount, 
      playerOpponents,
      matchesPerPlayer
    );
    
    if (selectedPlayers.length < minPlayersPerTeam * 2) {
      console.warn(`Round ${roundNumber}: Not enough selected players (${selectedPlayers.length})`);
      break;
    }
    
    // Generate teams for this round
    const roundData = generateTeamsForRound(
      selectedPlayers, 
      settings, 
      roundNumber, 
      playerOpponents
    );
    
    // Update tracking
    const byePlayers = playersNeedingMatches.filter(p => !selectedPlayers.includes(p));
    
    // Update match counts and opponents for playing players
    roundData.teams.forEach(team => {
      team.players.forEach(player => {
        playerMatchCounts[player.id]++;
        
        // Track opponents for this player
        team.players.forEach(teammate => {
          if (teammate.id !== player.id) {
            playerOpponents[player.id].add(teammate.id);
          }
        });
      });
    });
    
    // Update bye counts
    byePlayers.forEach(player => {
      playerByeCount[player.id]++;
    });
    
    // Add bye players to round data
    roundData.byePlayers = byePlayers;
    roundData.totalByePlayers = byePlayers.length;
    
    allRounds.push(roundData);
    roundNumber++;
    
    console.log(`Round ${roundNumber - 1}: ${roundData.totalPlayingPlayers} playing (${roundData.teams.length} teams, ${roundData.matches.length} matches), ${roundData.totalByePlayers} bye`);
  }
  
  // Final validation
  console.log('Tournament Generation Complete:');
  players.forEach(player => {
    console.log(`${player.name}: ${playerMatchCounts[player.id]} matches, ${playerByeCount[player.id]} byes`);
  });
  
  return allRounds;
}

function selectPlayersForRound(playersNeedingMatches, targetCount, matchCounts, byeCounts, opponents, maxMatches) {
  // Sort players by priority:
  // 1. Players with fewer matches played
  // 2. Players with more byes
  // 3. Random factor for variety
  const prioritizedPlayers = [...playersNeedingMatches].sort((a, b) => {
    const aMatches = matchCounts[a.id];
    const bMatches = matchCounts[b.id];
    const aByes = byeCounts[a.id];
    const bByes = byeCounts[b.id];
    
    // Primary: fewer matches played
    if (aMatches !== bMatches) {
      return aMatches - bMatches;
    }
    
    // Secondary: more byes (give priority to players who have sat out)
    if (aByes !== bByes) {
      return bByes - aByes;
    }
    
    // Tertiary: random for variety
    return Math.random() - 0.5;
  });
  
  return prioritizedPlayers.slice(0, targetCount);
}

function generateTeamsForRound(players, settings, roundNumber, playerOpponents = {}) {
  const { courtsAvailable, minPlayersPerTeam, hasPowerMatch } = settings;
  const maxPlayersPerTeam = 6;
  
  // Calculate optimal team configuration
  const totalPlayers = players.length;
  const maxTeams = courtsAvailable * 2;
  
  // Calculate how many teams we should make
  let teamsNeeded = Math.min(maxTeams, Math.floor(totalPlayers / minPlayersPerTeam));
  
  // Ensure we don't exceed max players per team
  while (teamsNeeded > 0 && Math.ceil(totalPlayers / teamsNeeded) > maxPlayersPerTeam) {
    teamsNeeded--;
  }
  
  if (teamsNeeded < 2) {
    throw new Error(`Cannot form enough teams with ${totalPlayers} players`);
  }
  
  // Calculate players per team
  const basePlayersPerTeam = Math.floor(totalPlayers / teamsNeeded);
  const extraPlayers = totalPlayers % teamsNeeded;
  
  // Separate players by gender and role for balanced distribution
  const femaleSetters = players.filter(p => p.gender === 'female' && p.is_setter);
  const maleSetters = players.filter(p => p.gender === 'male' && p.is_setter);
  const femaleNonSetters = players.filter(p => p.gender === 'female' && !p.is_setter);
  const maleNonSetters = players.filter(p => p.gender === 'male' && !p.is_setter);
  
  // Shuffle each group for randomness
  shuffleArray(femaleSetters);
  shuffleArray(maleSetters);
  shuffleArray(femaleNonSetters);
  shuffleArray(maleNonSetters);
  
  // Create empty teams
  const teams = [];
  for (let i = 0; i < teamsNeeded; i++) {
    teams.push({
      players: [],
      targetSize: basePlayersPerTeam + (i < extraPlayers ? 1 : 0),
      maleCount: 0,
      femaleCount: 0,
      setterCount: 0
    });
  }
  
  // Distribute setters first (most important for balance)
  distributePlayersEvenly(teams, femaleSetters, 'female', true);
  distributePlayersEvenly(teams, maleSetters, 'male', true);
  
  // Then distribute non-setters
  distributePlayersEvenly(teams, femaleNonSetters, 'female', false);
  distributePlayersEvenly(teams, maleNonSetters, 'male', false);
  
  // Create matches
  const matches = createMatches(teams, roundNumber, hasPowerMatch);
  
  return {
    roundNumber,
    teams,
    matches,
    byePlayers: [], // Will be set by calling function
    totalPlayingPlayers: totalPlayers,
    totalByePlayers: 0 // Will be set by calling function
  };
}

function distributePlayersEvenly(teams, players, gender, isSetter) {
  for (let i = 0; i < players.length; i++) {
    // Find team with most space and best balance
    const availableTeams = teams.filter(team => team.players.length < team.targetSize);
    
    if (availableTeams.length === 0) {
      console.warn('No available teams for player distribution');
      break;
    }
    
    // Sort teams by: 1) most space, 2) best gender balance, 3) setter needs
    availableTeams.sort((a, b) => {
      const aSpace = a.targetSize - a.players.length;
      const bSpace = b.targetSize - b.players.length;
      
      // Primary: most space available
      if (aSpace !== bSpace) {
        return bSpace - aSpace;
      }
      
      // Secondary: better gender balance (prefer teams with fewer of this gender)
      const aGenderCount = gender === 'male' ? a.maleCount : a.femaleCount;
      const bGenderCount = gender === 'male' ? b.maleCount : b.femaleCount;
      
      if (aGenderCount !== bGenderCount) {
        return aGenderCount - bGenderCount;
      }
      
      // Tertiary: setter balance
      if (isSetter && a.setterCount !== b.setterCount) {
        return a.setterCount - b.setterCount;
      }
      
      return 0;
    });
    
    const selectedTeam = availableTeams[0];
    selectedTeam.players.push(players[i]);
    
    if (gender === 'male') {
      selectedTeam.maleCount++;
    } else {
      selectedTeam.femaleCount++;
    }
    
    if (isSetter) {
      selectedTeam.setterCount++;
    }
  }
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function createMatches(teams, roundNumber, hasPowerMatch) {
  const matches = [];
  
  // Shuffle teams for random matchups
  const shuffledTeams = [...teams];
  shuffleArray(shuffledTeams);
  
  // Create matches by pairing teams
  for (let i = 0; i < shuffledTeams.length; i += 2) {
    if (i + 1 < shuffledTeams.length) {
      const court = Math.floor(i / 2) + 1;
      let isPowerMatch = false;
      
      // Determine if this should be a power match
      if (hasPowerMatch && roundNumber >= 3 && court === 1 && !matches.some(m => m.isPowerMatch)) {
        isPowerMatch = shouldBePowerMatch(shuffledTeams[i], shuffledTeams[i + 1]);
      }
      
      matches.push({
        team1: shuffledTeams[i],
        team2: shuffledTeams[i + 1],
        court: court,
        isPowerMatch
      });
    }
  }
  
  return matches;
}

function shouldBePowerMatch(team1, team2) {
  const getTeamStrength = (team) => {
    if (!team.players || team.players.length === 0) return 0;
    
    return team.players.reduce((sum, player) => {
      const skillPoints = { 'A': 3, 'BB': 2, 'B': 1 };
      return sum + (skillPoints[player.skill_level] || 1);
    }, 0) / team.players.length;
  };
  
  const team1Strength = getTeamStrength(team1);
  const team2Strength = getTeamStrength(team2);
  
  // Power match if both teams have above-average strength (2.0+ average)
  return team1Strength >= 2.0 && team2Strength >= 2.0;
}

// Legacy function for backward compatibility
function generateTeams(players, settings, roundNumber) {
  return generateTeamsForRound(players, settings, roundNumber);
}

function balancePlayerMatches(allPlayers, tournamentRounds, matchesPerPlayer) {
  // Track how many matches each player has played
  const playerMatchCounts = {};
  allPlayers.forEach(p => playerMatchCounts[p.id] = p.matches_played || 0);
  
  // Filter players who need more matches
  return allPlayers.filter(player => 
    playerMatchCounts[player.id] < matchesPerPlayer
  );
}

module.exports = { generateTeams, generateAllRounds, generateTeamsForRound, balancePlayerMatches };
