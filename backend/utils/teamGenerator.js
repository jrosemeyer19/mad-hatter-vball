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
  
  // Calculate theoretical minimum rounds needed
  const totalPlayerMatches = players.length * matchesPerPlayer;
  const maxMatchesPerRound = courtsAvailable * 2 * maxPlayersPerTeam; // 2 teams per court
  const theoreticalMinRounds = Math.ceil(totalPlayerMatches / maxMatchesPerRound);
  
  console.log(`\n=== Tournament Planning ===`);
  console.log(`Total players: ${players.length}`);
  console.log(`Matches per player: ${matchesPerPlayer}`);
  console.log(`Total player-matches needed: ${totalPlayerMatches}`);
  console.log(`Max player-matches per round: ${maxMatchesPerRound}`);
  console.log(`Theoretical minimum rounds: ${theoreticalMinRounds}`);
  
  let roundNumber = 1;
  const maxRounds = Math.max(theoreticalMinRounds + 2, matchesPerPlayer + 2); // Safety buffer
  
  // Continue generating rounds until ALL players have their required matches
  while (roundNumber <= maxRounds) {
    // Find players who still need matches
    const playersNeedingMatches = players.filter(player => 
      playerMatchCounts[player.id] < matchesPerPlayer
    );
    
    if (playersNeedingMatches.length === 0) {
      console.log('\n✅ All players have completed their required matches');
      break;
    }
    
    console.log(`\nRound ${roundNumber}: ${playersNeedingMatches.length} players still need matches`);
    
    // Generate round - be more conservative about player inclusion to ensure we generate enough rounds
    const roundResult = generateBalancedRound(
      playersNeedingMatches, 
      settings, 
      roundNumber,
      playerMatchCounts,
      playerByeCount,
      matchesPerPlayer
    );
    
    if (!roundResult || roundResult.matches.length === 0) {
      console.log(`❌ Cannot generate meaningful matches for round ${roundNumber}`);
      break;
    }
    
    // Update tracking
    updatePlayerTracking(roundResult, playerMatchCounts, playerOpponents, playerByeCount);
    
    allRounds.push(roundResult);
    console.log(`Round ${roundNumber}: ${roundResult.totalPlayingPlayers} playing, ${roundResult.totalByePlayers} bye, ${roundResult.matches.length} matches`);
    
    // Check if we're making progress
    const remainingAfterRound = players.filter(player => 
      playerMatchCounts[player.id] < matchesPerPlayer
    ).length;
    
    if (remainingAfterRound === playersNeedingMatches.length) {
      console.warn(`⚠️ No progress made in round ${roundNumber} - may need debugging`);
    }
    
    roundNumber++;
  }
  
  // Final validation and logging
  console.log('\n=== Tournament Generation Summary ===');
  const incompleteRounds = [];
  const matchCounts = {};
  
  players.forEach(player => {
    const matches = playerMatchCounts[player.id];
    const byes = playerByeCount[player.id];
    matchCounts[matches] = (matchCounts[matches] || 0) + 1;
    
    if (matches !== matchesPerPlayer) {
      console.warn(`${player.name}: ${matches} matches (expected ${matchesPerPlayer}), ${byes} byes`);
      incompleteRounds.push(player.name);
    }
  });
  
  console.log(`Generated ${allRounds.length} rounds`);
  console.log('Match distribution:', matchCounts);
  
  if (incompleteRounds.length === 0) {
    console.log('✅ All players completed their required matches!');
  } else {
    console.error(`❌ ${incompleteRounds.length} players still need matches`);
  }
  
  return allRounds;
}

function generateBalancedRound(playersNeedingMatches, settings, roundNumber, matchCounts, byeCounts, maxMatches) {
  const { courtsAvailable, minPlayersPerTeam } = settings;
  const maxPlayersPerTeam = 6;
  
  // Sort players by priority (fewer matches first, then more byes)
  const prioritizedPlayers = [...playersNeedingMatches].sort((a, b) => {
    const aMatches = matchCounts[a.id];
    const bMatches = matchCounts[b.id];
    const aByes = byeCounts[a.id];
    const bByes = byeCounts[b.id];
    
    // Priority 1: Players with fewer matches get highest priority
    if (aMatches !== bMatches) {
      return aMatches - bMatches;
    }
    
    // Priority 2: Players with more byes get priority
    if (aByes !== bByes) {
      return bByes - aByes;
    }
    
    // Priority 3: Random for variety
    return Math.random() - 0.5;
  });
  
  console.log(`  Players needing matches sorted by priority (first 10): ${prioritizedPlayers.slice(0, 10).map(p => `${p.name}:${matchCounts[p.id]}`).join(', ')}`);
  
  // Strategy: Be more conservative about how many players we include per round
  // This ensures we don't finish too early and leave some players behind
  
  const configurations = [];
  const maxTeamsFromCourts = courtsAvailable * 2;
  
  // Calculate ideal players per round based on remaining work
  const totalMatchesStillNeeded = prioritizedPlayers.reduce((sum, p) => 
    sum + Math.max(0, maxMatches - matchCounts[p.id]), 0
  );
  
  const roundsRemaining = Math.max(1, Math.ceil(totalMatchesStillNeeded / prioritizedPlayers.length));
  const targetPlayersThisRound = Math.min(
    prioritizedPlayers.length,
    Math.ceil(prioritizedPlayers.length / roundsRemaining) * 1.2 // Allow 20% more for flexibility
  );
  
  console.log(`  Total matches still needed: ${totalMatchesStillNeeded}, estimated rounds remaining: ${roundsRemaining}, target players this round: ${targetPlayersThisRound}`);
  
  // Generate configurations, but prefer those closer to our target
  for (let teamCount = 2; teamCount <= maxTeamsFromCourts; teamCount += 2) {
    for (let teamSize = minPlayersPerTeam; teamSize <= maxPlayersPerTeam; teamSize++) {
      const totalPlayersNeeded = teamCount * teamSize;
      
      if (totalPlayersNeeded <= prioritizedPlayers.length && totalPlayersNeeded >= minPlayersPerTeam * 2) {
        // Score based on how close we are to target and other factors
        let score = 0;
        
        // Prefer configurations close to our target player count
        const targetDifference = Math.abs(totalPlayersNeeded - targetPlayersThisRound);
        score += Math.max(0, 100 - targetDifference * 2);
        
        // Prefer including more players overall
        score += totalPlayersNeeded * 0.5;
        
        // Prefer more matches (more courts used)
        const matches = teamCount / 2;
        score += matches * 10;
        
        // Small bonus for team balance
        score += (maxPlayersPerTeam - teamSize) * 2; // Prefer smaller teams for more even distribution
        
        configurations.push({
          teamCount,
          teamSize,
          totalPlayersNeeded,
          matches,
          score,
          byeCount: prioritizedPlayers.length - totalPlayersNeeded
        });
      }
    }
  }
  
  // Also try mixed team sizes
  for (let teamCount = 2; teamCount <= maxTeamsFromCourts; teamCount += 2) {
    const baseSize = minPlayersPerTeam;
    const maxAdditionalPerTeam = maxPlayersPerTeam - baseSize;
    
    // Try different distributions of additional players
    for (let additionalTotal = 0; additionalTotal <= teamCount * maxAdditionalPerTeam; additionalTotal++) {
      const totalUsed = teamCount * baseSize + additionalTotal;
      
      if (totalUsed <= prioritizedPlayers.length) {
        let score = 0;
        
        const targetDifference = Math.abs(totalUsed - targetPlayersThisRound);
        score += Math.max(0, 100 - targetDifference * 2);
        score += totalUsed * 0.5;
        score += (teamCount / 2) * 10;
        
        configurations.push({
          teamCount,
          teamSize: 'mixed',
          totalPlayersNeeded: totalUsed,
          matches: teamCount / 2,
          score,
          byeCount: prioritizedPlayers.length - totalUsed,
          baseSize,
          additionalPlayers: additionalTotal
        });
      }
    }
  }
  
  if (configurations.length === 0) {
    console.log('  ❌ No valid configurations found');
    return null;
  }
  
  // Sort by score (highest first)
  configurations.sort((a, b) => b.score - a.score);
  
  const bestConfig = configurations[0];
  console.log(`  Selected config: ${bestConfig.teamCount} teams, ${bestConfig.totalPlayersNeeded} players (${bestConfig.byeCount} bye), score: ${bestConfig.score.toFixed(1)}`);
  
  // Generate the round with the selected configuration
  return generateRoundWithConfig(prioritizedPlayers, bestConfig, settings, roundNumber);
}

function generateRoundWithConfig(prioritizedPlayers, config, settings, roundNumber) {
  const playingPlayers = prioritizedPlayers.slice(0, config.totalPlayersNeeded);
  const byePlayers = prioritizedPlayers.slice(config.totalPlayersNeeded);
  
  // Create teams
  const teams = [];
  
  if (config.teamSize === 'mixed') {
    // Mixed team sizes - distribute additional players evenly
    const playersPerTeam = [];
    
    // Start with base size for all teams
    for (let i = 0; i < config.teamCount; i++) {
      playersPerTeam.push(config.baseSize);
    }
    
    // Distribute additional players as evenly as possible
    for (let i = 0; i < config.additionalPlayers; i++) {
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
  // Collect all players and separate by categories
  const allPlayers = [];
  teams.forEach(team => allPlayers.push(...team.players));
  
  const femaleSetters = shuffleArray(allPlayers.filter(p => p.gender === 'female' && p.is_setter));
  const maleSetters = shuffleArray(allPlayers.filter(p => p.gender === 'male' && p.is_setter));
  const femaleNonSetters = shuffleArray(allPlayers.filter(p => p.gender === 'female' && !p.is_setter));
  const maleNonSetters = shuffleArray(allPlayers.filter(p => p.gender === 'male' && !p.is_setter));
  
  // Clear existing team assignments and initialize counters
  teams.forEach(team => {
    team.players = [];
    team.maleCount = 0;
    team.femaleCount = 0;
    team.setterCount = 0;
  });
  
  // Distribute players evenly across teams
  [femaleSetters, maleSetters, femaleNonSetters, maleNonSetters].forEach(players => {
    distributePlayersEvenly(teams, players, players.length > 0 ? players[0].gender : 'male', players.length > 0 ? players[0].is_setter : false);
  });
}

function distributePlayersEvenly(teams, players, gender, isSetter) {
  for (let i = 0; i < players.length; i++) {
    // Find the best team for this player
    const sortedTeams = [...teams].sort((a, b) => {
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
      
      // Priority 3: Setter balance if this is a setter
      if (isSetter && a.setterCount !== b.setterCount) {
        return a.setterCount - b.setterCount;
      }
      
      return 0;
    });
    
    const selectedTeam = sortedTeams[0];
    selectedTeam.players.push(players[i]);
    
    if (gender === 'male') {
      selectedTeam.maleCount = (selectedTeam.maleCount || 0) + 1;
    } else {
      selectedTeam.femaleCount = (selectedTeam.femaleCount || 0) + 1;
    }
    
    if (isSetter) {
      selectedTeam.setterCount = (selectedTeam.setterCount || 0) + 1;
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
  if (roundData.byePlayers) {
    roundData.byePlayers.forEach(player => {
      byeCounts[player.id]++;
    });
  }
}

function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Legacy function for backward compatibility
function generateTeams(players, settings, roundNumber) {
  return generateTeamsForRound(players, 2, settings, roundNumber);
}

function generateTeamsForRound(players, targetTeams, settings, roundNumber) {
  // Simplified version for compatibility
  const teams = [];
  const playersPerTeam = Math.floor(players.length / targetTeams);
  
  for (let i = 0; i < targetTeams; i++) {
    const startIdx = i * playersPerTeam;
    const endIdx = startIdx + playersPerTeam;
    teams.push({
      players: players.slice(startIdx, endIdx)
    });
  }
  
  const matches = [];
  for (let i = 0; i < teams.length; i += 2) {
    if (i + 1 < teams.length) {
      matches.push({
        team1: teams[i],
        team2: teams[i + 1],
        court: Math.floor(i / 2) + 1
      });
    }
  }
  
  return {
    roundNumber,
    teams,
    matches,
    byePlayers: [],
    totalPlayingPlayers: players.length,
    totalByePlayers: 0
  };
}

function balancePlayerMatches(allPlayers, tournamentRounds, matchesPerPlayer) {
  const playerMatchCounts = {};
  allPlayers.forEach(p => playerMatchCounts[p.id] = p.matches_played || 0);
  
  return allPlayers.filter(player => 
    playerMatchCounts[player.id] < matchesPerPlayer
  );
}

module.exports = { generateTeams, generateAllRounds, generateTeamsForRound, balancePlayerMatches };