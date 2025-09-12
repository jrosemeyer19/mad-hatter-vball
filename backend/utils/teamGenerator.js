function generateAllRounds(players, settings) {
  const { courtsAvailable, minPlayersPerTeam, matchesPerPlayer, hasPowerMatch } = settings;
  const maxPlayersPerTeam = 6;
  
  const allRounds = [];
  const playerMatchCounts = {};
  const playerOpponents = {};
  const playerByeCount = {};
  
  // Initialize tracking
  players.forEach(p => {
    playerMatchCounts[p.id] = 0;
    playerOpponents[p.id] = new Set();
    playerByeCount[p.id] = 0;
  });
  
  let roundNumber = 1;
  const maxRounds = Math.ceil(matchesPerPlayer * 2); // Safety limit
  
  // Generate regular rounds until most players have completed their matches
  while (roundNumber <= maxRounds) {
    // Find players who still need matches
    const playersNeedingMatches = players.filter(player => 
      playerMatchCounts[player.id] < matchesPerPlayer
    );
    
    if (playersNeedingMatches.length === 0) {
      console.log('All players have completed their required matches');
      break;
    }
    
    // More flexible team formation - try to include as many players as possible
    const roundResult = generateFlexibleRound(
      playersNeedingMatches, 
      settings, 
      roundNumber,
      playerMatchCounts,
      playerByeCount,
      matchesPerPlayer
    );
    
    if (!roundResult || roundResult.matches.length === 0) {
      console.log(`Cannot generate meaningful matches for round ${roundNumber}`);
      break;
    }
    
    // Update tracking
    updatePlayerTracking(roundResult, playerMatchCounts, playerOpponents, playerByeCount);
    
    allRounds.push(roundResult);
    console.log(`Round ${roundNumber}: ${roundResult.totalPlayingPlayers} playing (${roundResult.teams.length} teams, ${roundResult.matches.length} matches), ${roundResult.totalByePlayers} bye`);
    
    roundNumber++;
  }
  
  // Final validation and logging
  console.log('\n=== Tournament Generation Summary ===');
  const incompleteRounds = [];
  players.forEach(player => {
    const matches = playerMatchCounts[player.id];
    const byes = playerByeCount[player.id];
    if (matches !== matchesPerPlayer) {
      console.warn(`${player.name}: ${matches} matches (expected ${matchesPerPlayer}), ${byes} byes`);
      incompleteRounds.push(player.name);
    }
  });
  
  if (incompleteRounds.length === 0) {
    console.log('✅ All players completed their required matches!');
  }
  
  return allRounds;
}

function generateFlexibleRound(playersNeedingMatches, settings, roundNumber, matchCounts, byeCounts, maxMatches) {
  const { courtsAvailable, minPlayersPerTeam } = settings;
  const maxPlayersPerTeam = 6;
  
  // Sort players by priority (fewer matches first, then more byes)
  const prioritizedPlayers = [...playersNeedingMatches].sort((a, b) => {
    const aMatches = matchCounts[a.id];
    const bMatches = matchCounts[b.id];
    const aByes = byeCounts[a.id];
    const bByes = byeCounts[b.id];
    
    // Priority 1: Players with fewer matches
    if (aMatches !== bMatches) {
      return aMatches - bMatches;
    }
    
    // Priority 2: Players with more byes (they should get priority to play)
    if (aByes !== bByes) {
      return bByes - aByes;
    }
    
    // Priority 3: Random for variety
    return Math.random() - 0.5;
  });
  
  // Try different team configurations to maximize player participation
  const configurations = [];
  
  // Calculate maximum possible teams based on courts
  const maxTeamsFromCourts = courtsAvailable * 2;
  
  // Try various team counts, prioritizing configurations that use more players
  for (let teamCount = 2; teamCount <= maxTeamsFromCourts; teamCount += 2) {
    // Try different team sizes
    for (let teamSize = minPlayersPerTeam; teamSize <= maxPlayersPerTeam; teamSize++) {
      const totalPlayersNeeded = teamCount * teamSize;
      
      if (totalPlayersNeeded <= prioritizedPlayers.length) {
        const efficiency = totalPlayersNeeded / prioritizedPlayers.length;
        const matches = teamCount / 2;
        
        configurations.push({
          teamCount,
          teamSize,
          totalPlayersNeeded,
          matches,
          efficiency, // Higher is better (more players included)
          byeCount: prioritizedPlayers.length - totalPlayersNeeded
        });
      }
    }
  }
  
  // Also try configurations with mixed team sizes
  for (let teamCount = 2; teamCount <= maxTeamsFromCourts; teamCount += 2) {
    const baseSize = minPlayersPerTeam;
    const totalPlayersWithBase = teamCount * baseSize;
    const remainingPlayers = prioritizedPlayers.length - totalPlayersWithBase;
    
    // Distribute remaining players among teams (up to maxPlayersPerTeam)
    if (totalPlayersWithBase <= prioritizedPlayers.length && remainingPlayers >= 0) {
      const maxAdditionalPerTeam = maxPlayersPerTeam - baseSize;
      const additionalPlayersToUse = Math.min(remainingPlayers, teamCount * maxAdditionalPerTeam);
      const totalUsed = totalPlayersWithBase + additionalPlayersToUse;
      
      if (totalUsed > totalPlayersWithBase) {
        const efficiency = totalUsed / prioritizedPlayers.length;
        const matches = teamCount / 2;
        
        configurations.push({
          teamCount,
          teamSize: 'mixed',
          totalPlayersNeeded: totalUsed,
          matches,
          efficiency,
          byeCount: prioritizedPlayers.length - totalUsed,
          baseSize,
          additionalPlayers: additionalPlayersToUse
        });
      }
    }
  }
  
  if (configurations.length === 0) {
    // Fallback: just try to get any two teams
    if (prioritizedPlayers.length >= minPlayersPerTeam * 2) {
      const teamSize = Math.floor(prioritizedPlayers.length / 2);
      if (teamSize >= minPlayersPerTeam && teamSize <= maxPlayersPerTeam) {
        configurations.push({
          teamCount: 2,
          teamSize,
          totalPlayersNeeded: teamSize * 2,
          matches: 1,
          efficiency: (teamSize * 2) / prioritizedPlayers.length,
          byeCount: prioritizedPlayers.length - (teamSize * 2)
        });
      }
    }
  }
  
  if (configurations.length === 0) {
    return null; // Can't form any valid configuration
  }
  
  // Sort configurations by preference:
  // 1. Highest efficiency (include most players)
  // 2. Most matches
  // 3. Fewest bye players
  configurations.sort((a, b) => {
    if (Math.abs(a.efficiency - b.efficiency) > 0.01) {
      return b.efficiency - a.efficiency;
    }
    if (a.matches !== b.matches) {
      return b.matches - a.matches;
    }
    return a.byeCount - b.byeCount;
  });
  
  const bestConfig = configurations[0];
  console.log(`Round ${roundNumber} config: ${bestConfig.teamCount} teams, ${bestConfig.totalPlayersNeeded} players, ${bestConfig.byeCount} bye`);
  
  // Generate the round with the best configuration
  return generateRoundWithConfig(prioritizedPlayers, bestConfig, settings, roundNumber);
}

function generateRoundWithConfig(prioritizedPlayers, config, settings, roundNumber) {
  const playingPlayers = prioritizedPlayers.slice(0, config.totalPlayersNeeded);
  const byePlayers = prioritizedPlayers.slice(config.totalPlayersNeeded);
  
  // Create teams
  const teams = [];
  
  if (config.teamSize === 'mixed') {
    // Mixed team sizes
    const playersPerTeam = [];
    const basePlayersTotal = config.teamCount * config.baseSize;
    const additionalPlayers = config.additionalPlayers;
    
    // Start with base size for all teams
    for (let i = 0; i < config.teamCount; i++) {
      playersPerTeam.push(config.baseSize);
    }
    
    // Distribute additional players
    for (let i = 0; i < additionalPlayers; i++) {
      const teamIndex = i % config.teamCount;
      playersPerTeam[teamIndex]++;
    }
    
    // Create teams with calculated sizes
    let playerIndex = 0;
    for (let i = 0; i < config.teamCount; i++) {
      const teamSize = playersPerTeam[i];
      const teamPlayers = playingPlayers.slice(playerIndex, playerIndex + teamSize);
      teams.push({ players: teamPlayers });
      playerIndex += teamSize;
    }
  } else {
    // Equal team sizes
    for (let i = 0; i < config.teamCount; i++) {
      const startIdx = i * config.teamSize;
      const endIdx = startIdx + config.teamSize;
      const teamPlayers = playingPlayers.slice(startIdx, endIdx);
      teams.push({ players: teamPlayers });
    }
  }
  
  // Balance teams by gender and skill
  balanceTeams(teams);
  
  // Create matches
  const matches = [];
  for (let i = 0; i < teams.length; i += 2) {
    if (i + 1 < teams.length) {
      matches.push({
        team1: teams[i],
        team2: teams[i + 1],
        court: Math.floor(i / 2) + 1,
        isPowerMatch: false // Simplified for now
      });
    }
  }
  
  return {
    roundNumber,
    teams,
    matches,
    byePlayers,
    totalPlayingPlayers: playingPlayers.length,
    totalByePlayers: byePlayers.length
  };
}

function balanceTeams(teams) {
  // Simple team balancing - redistribute players to balance gender and skill
  const allPlayers = [];
  teams.forEach(team => allPlayers.push(...team.players));
  
  // Separate players by categories
  const femaleSetters = allPlayers.filter(p => p.gender === 'female' && p.is_setter);
  const maleSetters = allPlayers.filter(p => p.gender === 'male' && p.is_setter);
  const femaleNonSetters = allPlayers.filter(p => p.gender === 'female' && !p.is_setter);
  const maleNonSetters = allPlayers.filter(p => p.gender === 'male' && !p.is_setter);
  
  // Shuffle each category
  [femaleSetters, maleSetters, femaleNonSetters, maleNonSetters].forEach(arr => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  });
  
  // Clear existing team assignments
  teams.forEach(team => {
    team.players = [];
    team.maleCount = 0;
    team.femaleCount = 0;
    team.setterCount = 0;
  });
  
  // Distribute players evenly
  [femaleSetters, maleSetters, femaleNonSetters, maleNonSetters].forEach(players => {
    distributePlayersEvenly(teams, players, players.length > 0 ? players[0].gender : 'male', players.length > 0 ? players[0].is_setter : false);
  });
}

// Keep the existing distributePlayersEvenly, updatePlayerTracking, and other utility functions
function distributePlayersEvenly(teams, players, gender, isSetter) {
  for (let i = 0; i < players.length; i++) {
    // Find the team with the most space and best balance
    const availableTeams = [...teams]; // All teams are available now
    
    // Sort by balance needs
    availableTeams.sort((a, b) => {
      // Priority 1: Team with fewer players
      if (a.players.length !== b.players.length) {
        return a.players.length - b.players.length;
      }
      
      // Priority 2: Better gender balance
      const aGenderCount = gender === 'male' ? a.maleCount : a.femaleCount;
      const bGenderCount = gender === 'male' ? b.maleCount : b.femaleCount;
      
      if (aGenderCount !== bGenderCount) {
        return aGenderCount - bGenderCount;
      }
      
      // Priority 3: Setter balance
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

function updatePlayerTracking(roundData, matchCounts, opponents, byeCounts) {
  // Update match counts ONLY for players who actually play matches
  roundData.teams.forEach(team => {
    const teamHasMatch = roundData.matches.some(match => 
      match.team1 === team || match.team2 === team
    );
    
    if (teamHasMatch) {
      team.players.forEach(player => {
        matchCounts[player.id]++;
        
        // Track opponents
        team.players.forEach(teammate => {
          if (teammate.id !== player.id) {
            opponents[player.id].add(teammate.id);
          }
        });
      });
    }
  });
  
  // Update bye counts
  roundData.byePlayers.forEach(player => {
    byeCounts[player.id]++;
  });
}

// Legacy function for backward compatibility
function generateTeams(players, settings, roundNumber) {
  return generateTeamsForRound(players, 2, settings, roundNumber);
}

function balancePlayerMatches(allPlayers, tournamentRounds, matchesPerPlayer) {
  const playerMatchCounts = {};
  allPlayers.forEach(p => playerMatchCounts[p.id] = p.matches_played || 0);
  
  return allPlayers.filter(player => 
    playerMatchCounts[player.id] < matchesPerPlayer
  );
}

// Keep all the existing utility functions like shuffleArray, etc.
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

module.exports = { generateTeams, generateAllRounds, generateTeamsForRound: generateFlexibleRound, balancePlayerMatches };