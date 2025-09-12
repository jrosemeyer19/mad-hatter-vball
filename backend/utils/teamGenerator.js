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
  
  // CRITICAL: Calculate exactly how many rounds we need
  const totalMatchesNeeded = players.length * matchesPerPlayer;
  const matchesPerRound = courtsAvailable; // 3 courts = 3 matches per round
  const playersPerMatch = 2 * ((minPlayersPerTeam + maxPlayersPerTeam) / 2); // Roughly 11 players per match on average
  const playerMatchesPerRound = matchesPerRound * playersPerMatch; // ~33 player-matches per round
  
  const requiredRounds = Math.ceil(totalMatchesNeeded / playerMatchesPerRound);
  
  console.log(`\n=== Tournament Math ===`);
  console.log(`Players: ${players.length}`);
  console.log(`Matches per player: ${matchesPerPlayer}`);
  console.log(`Total player-matches needed: ${totalMatchesNeeded}`);
  console.log(`Courts available: ${courtsAvailable}`);
  console.log(`Estimated player-matches per round: ${playerMatchesPerRound}`);
  console.log(`REQUIRED ROUNDS: ${requiredRounds}`);
  
  // Target players per round to spread matches evenly across required rounds
  const targetPlayersPerRound = Math.floor(totalMatchesNeeded / requiredRounds);
  
  console.log(`Target players per round: ${targetPlayersPerRound}`);
  
  // Generate exactly the required number of rounds
  for (let roundNumber = 1; roundNumber <= requiredRounds + 1; roundNumber++) {
    // Find players who still need matches
    const playersNeedingMatches = players.filter(player => 
      playerMatchCounts[player.id] < matchesPerPlayer
    );
    
    if (playersNeedingMatches.length === 0) {
      console.log(`\nAll players completed after ${roundNumber - 1} rounds`);
      break;
    }
    
    console.log(`\nRound ${roundNumber}: ${playersNeedingMatches.length} players still need matches`);
    
    // Calculate how many players to include this round
    const remainingRounds = requiredRounds - roundNumber + 1;
    let targetPlayersThisRound;
    
    if (remainingRounds <= 1) {
      // Last round - include everyone who needs matches
      targetPlayersThisRound = playersNeedingMatches.length;
    } else {
      // Distribute remaining players across remaining rounds
      const avgPlayersNeeded = Math.ceil(playersNeedingMatches.length / remainingRounds);
      // But don't go below what we can actually field on available courts
      const minPlayersForCourts = courtsAvailable * 2 * minPlayersPerTeam;
      const maxPlayersForCourts = courtsAvailable * 2 * maxPlayersPerTeam;
      
      targetPlayersThisRound = Math.min(
        Math.max(avgPlayersNeeded, minPlayersForCourts),
        Math.min(maxPlayersForCourts, playersNeedingMatches.length)
      );
    }
    
    console.log(`  Target players this round: ${targetPlayersThisRound} (${remainingRounds} rounds remaining)`);
    
    // Generate round with target player count
    const roundData = generateRoundWithTargetSize(
      playersNeedingMatches,
      targetPlayersThisRound,
      settings,
      roundNumber,
      playerMatchCounts,
      playerByeCount
    );
    
    if (!roundData || roundData.matches.length === 0) {
      console.log(`Cannot generate matches for round ${roundNumber}`);
      break;
    }
    
    // Update tracking
    updatePlayerTracking(roundData, playerMatchCounts, playerOpponents, playerByeCount);
    
    allRounds.push(roundData);
    console.log(`Round ${roundNumber}: ${roundData.totalPlayingPlayers} playing, ${roundData.totalByePlayers} bye, ${roundData.matches.length} matches`);
  }
  
  // Final validation
  console.log('\n=== Final Validation ===');
  const incompleteMatches = [];
  
  players.forEach(player => {
    const matches = playerMatchCounts[player.id];
    const byes = playerByeCount[player.id];
    
    if (matches < matchesPerPlayer) {
      incompleteMatches.push(`${player.name}: ${matches}/${matchesPerPlayer} matches`);
    }
  });
  
  if (incompleteMatches.length === 0) {
    console.log('✅ All players completed their required matches!');
  } else {
    console.log('ERROR: Some players still have incomplete matches:');
    incompleteMatches.forEach(msg => console.log(`- ${msg}`));
  }
  
  console.log(`Total rounds generated: ${allRounds.length}`);
  
  return allRounds;
}

function generateRoundWithTargetSize(playersNeedingMatches, targetPlayerCount, settings, roundNumber, matchCounts, byeCounts) {
  const { courtsAvailable, minPlayersPerTeam } = settings;
  const maxPlayersPerTeam = 6;
  
  // Sort players by priority (fewer matches first, then more byes)
  const prioritizedPlayers = [...playersNeedingMatches].sort((a, b) => {
    const aMatches = matchCounts[a.id];
    const bMatches = matchCounts[b.id];
    const aByes = byeCounts[a.id];
    const bByes = byeCounts[b.id];
    
    if (aMatches !== bMatches) {
      return aMatches - bMatches;
    }
    
    if (aByes !== bByes) {
      return bByes - aByes;
    }
    
    return Math.random() - 0.5;
  });
  
  // Find the best team configuration for our target player count
  let bestConfig = null;
  let bestScore = -1;
  
  const maxTeams = courtsAvailable * 2;
  
  // Try different team configurations
  for (let numTeams = 2; numTeams <= maxTeams; numTeams += 2) {
    for (let teamSize = minPlayersPerTeam; teamSize <= maxPlayersPerTeam; teamSize++) {
      const totalPlayers = numTeams * teamSize;
      
      if (totalPlayers <= prioritizedPlayers.length) {
        // Score this configuration based on how close it is to our target
        const targetDiff = Math.abs(totalPlayers - targetPlayerCount);
        const score = 1000 - targetDiff * 10; // Prefer closer to target
        
        if (score > bestScore) {
          bestScore = score;
          bestConfig = {
            numTeams,
            teamSize,
            totalPlayers,
            type: 'equal'
          };
        }
      }
    }
  }
  
  // Also try mixed team sizes
  for (let numTeams = 2; numTeams <= maxTeams; numTeams += 2) {
    const minTotal = numTeams * minPlayersPerTeam;
    const maxTotal = numTeams * maxPlayersPerTeam;
    
    // Try to hit our target exactly with mixed sizes
    if (targetPlayerCount >= minTotal && targetPlayerCount <= maxTotal && targetPlayerCount <= prioritizedPlayers.length) {
      const score = 1100; // Slight preference for exact target match
      
      if (score > bestScore) {
        bestScore = score;
        bestConfig = {
          numTeams,
          totalPlayers: targetPlayerCount,
          type: 'mixed'
        };
      }
    }
  }
  
  if (!bestConfig) {
    console.log('  No valid configuration found');
    return null;
  }
  
  console.log(`  Using ${bestConfig.numTeams} teams, ${bestConfig.totalPlayers} players (${bestConfig.type} sizes)`);
  
  // Create teams based on configuration
  const playingPlayers = prioritizedPlayers.slice(0, bestConfig.totalPlayers);
  const byePlayers = prioritizedPlayers.slice(bestConfig.totalPlayers);
  
  const teams = [];
  
  if (bestConfig.type === 'equal') {
    // Equal team sizes
    for (let i = 0; i < bestConfig.numTeams; i++) {
      const startIdx = i * bestConfig.teamSize;
      const endIdx = startIdx + bestConfig.teamSize;
      teams.push({ players: playingPlayers.slice(startIdx, endIdx) });
    }
  } else {
    // Mixed team sizes to hit exact target
    const baseSize = minPlayersPerTeam;
    const totalExtra = bestConfig.totalPlayers - (bestConfig.numTeams * baseSize);
    
    // Distribute players
    let playerIndex = 0;
    for (let i = 0; i < bestConfig.numTeams; i++) {
      const extraForThisTeam = Math.floor(totalExtra * (i + 1) / bestConfig.numTeams) - Math.floor(totalExtra * i / bestConfig.numTeams);
      const teamSize = baseSize + extraForThisTeam;
      
      teams.push({ 
        players: playingPlayers.slice(playerIndex, playerIndex + teamSize) 
      });
      playerIndex += teamSize;
    }
  }
  
  // Balance teams
  balanceTeams(teams);
  
  // Create matches
  const matches = [];
  for (let i = 0; i < teams.length; i += 2) {
    if (i + 1 < teams.length) {
      matches.push({
        team1: teams[i],
        team2: teams[i + 1],
        court: Math.floor(i / 2) + 1,
        isPowerMatch: false
      });
    }
  }
  
  return {
    roundNumber,
    teams,
    matches,
    byePlayers: byePlayers || [], // Ensure byePlayers is always an array
    totalPlayingPlayers: playingPlayers.length,
    totalByePlayers: (byePlayers || []).length
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

function distributePlayersEvenly(teams, players, gender, isSetter) {
  for (let i = 0; i < players.length; i++) {
    const sortedTeams = [...teams].sort((a, b) => {
      if (a.players.length !== b.players.length) {
        return a.players.length - b.players.length;
      }
      
      const aGenderCount = gender === 'male' ? (a.maleCount || 0) : (a.femaleCount || 0);
      const bGenderCount = gender === 'male' ? (b.maleCount || 0) : (b.femaleCount || 0);
      
      if (aGenderCount !== bGenderCount) {
        return aGenderCount - bGenderCount;
      }
      
      if (isSetter && (a.setterCount || 0) !== (b.setterCount || 0)) {
        return (a.setterCount || 0) - (b.setterCount || 0);
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
  roundData.teams.forEach(team => {
    const teamHasMatch = roundData.matches.some(match => 
      match.team1 === team || match.team2 === team
    );
    
    if (teamHasMatch) {
      team.players.forEach(player => {
        matchCounts[player.id]++;
        
        team.players.forEach(teammate => {
          if (teammate.id !== player.id) {
            opponents[player.id].add(teammate.id);
          }
        });
      });
    }
  });
  
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

// Legacy compatibility functions (keep unchanged)
function generateTeams(players, settings, roundNumber) {
  return generateTeamsForRound(players, 2, settings, roundNumber);
}

function generateTeamsForRound(players, targetTeams, settings, roundNumber) {
  if (targetTeams % 2 !== 0) {
    throw new Error(`Cannot create odd number of teams: ${targetTeams}`);
  }
  
  if (players.length < targetTeams * 2) {
    throw new Error(`Not enough players (${players.length}) for ${targetTeams} teams`);
  }
  
  const basePlayersPerTeam = Math.floor(players.length / targetTeams);
  const extraPlayers = players.length % targetTeams;
  
  const femaleSetters = shuffleArray([...players.filter(p => p.gender === 'female' && p.is_setter)]);
  const maleSetters = shuffleArray([...players.filter(p => p.gender === 'male' && p.is_setter)]);
  const femaleNonSetters = shuffleArray([...players.filter(p => p.gender === 'female' && !p.is_setter)]);
  const maleNonSetters = shuffleArray([...players.filter(p => p.gender === 'male' && !p.is_setter)]);
  
  const teams = [];
  for (let i = 0; i < targetTeams; i++) {
    teams.push({
      players: [],
      targetSize: basePlayersPerTeam + (i < extraPlayers ? 1 : 0),
      maleCount: 0,
      femaleCount: 0,
      setterCount: 0
    });
  }
  
  distributePlayersEvenly(teams, femaleSetters, 'female', true);
  distributePlayersEvenly(teams, maleSetters, 'male', true);
  distributePlayersEvenly(teams, femaleNonSetters, 'female', false);
  distributePlayersEvenly(teams, maleNonSetters, 'male', false);
  
  const validTeams = teams.filter(team => team.players.length > 0);
  
  const matches = [];
  for (let i = 0; i < validTeams.length; i += 2) {
    if (i + 1 < validTeams.length) {
      matches.push({
        team1: validTeams[i],
        team2: validTeams[i + 1],
        court: Math.floor(i / 2) + 1,
        isPowerMatch: false
      });
    }
  }
  
  return {
    roundNumber,
    teams: validTeams,
    matches,
    totalPlayingPlayers: players.length,
    byePlayers: [],
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