function generateAllRounds(players, settings) {
  const { courtsAvailable, minPlayersPerTeam, matchesPerPlayer, hasPowerMatch } = settings;
  const maxPlayersPerTeam = 6;
  
  const allRounds = [];
  const playerMatchCounts = {};
  const playerByeCount = {};
  
  // Initialize tracking
  players.forEach(p => {
    playerMatchCounts[p.id] = 0;
    playerByeCount[p.id] = 0;
  });
  
  // CRITICAL: Calculate the optimal distribution
  const totalPlayers = players.length;
  const totalMatchesNeeded = totalPlayers * matchesPerPlayer;
  const maxTeamsPerRound = courtsAvailable * 2;
  const optimalPlayersPerRound = maxTeamsPerRound * ((minPlayersPerTeam + maxPlayersPerTeam) / 2);
  const estimatedRounds = Math.ceil(totalMatchesNeeded / optimalPlayersPerRound);
  
  // Calculate target bye distribution
  const totalByesNeeded = totalPlayers; // Each player should have exactly 1 bye
  const targetByesPerRound = Math.floor(totalByesNeeded / estimatedRounds);
  const extraByes = totalByesNeeded % estimatedRounds;
  
  console.log(`\n=== Tournament Planning ===`);
  console.log(`Players: ${totalPlayers}`);
  console.log(`Matches per player: ${matchesPerPlayer}`);
  console.log(`Total player-matches needed: ${totalMatchesNeeded}`);
  console.log(`Estimated rounds: ${estimatedRounds}`);
  console.log(`Target byes per round: ${targetByesPerRound} (${extraByes} rounds get +1)`);
  console.log(`Total byes to distribute: ${totalByesNeeded}`);
  
  // Generate rounds with controlled bye distribution
  for (let roundNumber = 1; roundNumber <= estimatedRounds + 1; roundNumber++) {
    // Find players who still need matches
    const playersNeedingMatches = players.filter(player => 
      playerMatchCounts[player.id] < matchesPerPlayer
    );
    
    if (playersNeedingMatches.length === 0) {
      console.log(`\nAll players completed after ${roundNumber - 1} rounds`);
      break;
    }
    
    console.log(`\nRound ${roundNumber}: ${playersNeedingMatches.length} players still need matches`);
    
    // Calculate target byes for this round
    let targetByesThisRound = targetByesPerRound;
    if (roundNumber <= extraByes) {
      targetByesThisRound++;
    }
    
    // Calculate target playing players (but ensure minimum viable teams)
    const targetPlayingPlayers = Math.max(
      playersNeedingMatches.length - targetByesThisRound,
      minPlayersPerTeam * 2 // Minimum for one match
    );
    
    console.log(`  Target: ${targetPlayingPlayers} playing, ${playersNeedingMatches.length - targetPlayingPlayers} bye`);
    
    // Generate round with controlled player distribution
    const roundData = generateControlledRound(
      playersNeedingMatches,
      targetPlayingPlayers,
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
    updatePlayerTracking(roundData, playerMatchCounts, playerByeCount);
    
    allRounds.push(roundData);
    console.log(`Round ${roundNumber}: ${roundData.totalPlayingPlayers} playing, ${roundData.totalByePlayers} bye, ${roundData.matches.length} matches`);
  }
  
  // Validation and reporting
  console.log('\n=== Final Validation ===');
  const byeDistribution = {};
  const matchDistribution = {};
  let totalByes = 0;
  
  players.forEach(player => {
    const matches = playerMatchCounts[player.id];
    const byes = playerByeCount[player.id];
    
    matchDistribution[matches] = (matchDistribution[matches] || 0) + 1;
    byeDistribution[byes] = (byeDistribution[byes] || 0) + 1;
    totalByes += byes;
    
    if (matches !== matchesPerPlayer) {
      console.warn(`${player.name}: ${matches}/${matchesPerPlayer} matches, ${byes} byes`);
    }
  });
  
  console.log(`Total rounds generated: ${allRounds.length}`);
  console.log(`Bye distribution:`, byeDistribution);
  console.log(`Match distribution:`, matchDistribution);
  console.log(`Total byes distributed: ${totalByes} (should be ${totalPlayers})`);
  
  if (totalByes === totalPlayers) {
    console.log('✅ Bye distribution is correct!');
  } else {
    console.error(`❌ Bye distribution error: ${totalByes - totalPlayers} extra byes`);
  }
  
  return allRounds;
}

function generateControlledRound(playersNeedingMatches, targetPlayingPlayers, settings, roundNumber, matchCounts, byeCounts) {
  const { courtsAvailable, minPlayersPerTeam } = settings;
  const maxPlayersPerTeam = 6;
  
  // Sort players by priority - those with MORE byes get LOWER priority to play
  // This ensures even bye distribution
  const prioritizedPlayers = [...playersNeedingMatches].sort((a, b) => {
    const aMatches = matchCounts[a.id];
    const bMatches = matchCounts[b.id];
    const aByes = byeCounts[a.id];
    const bByes = byeCounts[b.id];
    
    // Priority 1: Players with fewer matches get higher priority
    if (aMatches !== bMatches) {
      return aMatches - bMatches;
    }
    
    // Priority 2: Players with MORE byes get LOWER priority (to balance byes)
    if (aByes !== bByes) {
      return aByes - bByes;
    }
    
    // Priority 3: Random for variety
    return Math.random() - 0.5;
  });
  
  // Ensure target is achievable
  const actualTarget = Math.min(
    targetPlayingPlayers,
    prioritizedPlayers.length,
    courtsAvailable * 2 * maxPlayersPerTeam
  );
  
  // Ensure we can form complete teams
  const maxTeams = courtsAvailable * 2;
  let bestConfig = null;
  let bestScore = -1;
  
  // Try different team configurations close to our target
  for (let numTeams = 2; numTeams <= maxTeams; numTeams += 2) {
    for (let teamSize = minPlayersPerTeam; teamSize <= maxPlayersPerTeam; teamSize++) {
      const totalPlayers = numTeams * teamSize;
      
      if (totalPlayers <= prioritizedPlayers.length) {
        // Score based on how close to target and court efficiency
        const targetDiff = Math.abs(totalPlayers - actualTarget);
        const courtEfficiency = numTeams / maxTeams;
        const score = (100 - targetDiff) + (courtEfficiency * 20);
        
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
  
  // Try mixed team sizes for exact target matching
  for (let numTeams = 2; numTeams <= maxTeams; numTeams += 2) {
    const minTotal = numTeams * minPlayersPerTeam;
    const maxTotal = numTeams * maxPlayersPerTeam;
    
    if (actualTarget >= minTotal && actualTarget <= maxTotal && actualTarget <= prioritizedPlayers.length) {
      const score = 150; // Bonus for exact target match
      
      if (score > bestScore) {
        bestScore = score;
        bestConfig = {
          numTeams,
          totalPlayers: actualTarget,
          type: 'mixed'
        };
      }
    }
  }
  
  if (!bestConfig) {
    console.log('  No valid configuration found');
    return null;
  }
  
  console.log(`  Using ${bestConfig.numTeams} teams, ${bestConfig.totalPlayers} players (${bestConfig.type})`);
  
  // Create teams and distribute players
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
    // Mixed team sizes for exact target
    const baseSize = minPlayersPerTeam;
    const totalExtra = bestConfig.totalPlayers - (bestConfig.numTeams * baseSize);
    
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
        isPowerMatch: false
      });
    }
  }
  
  return {
    roundNumber,
    teams,
    matches,
    byePlayers: byePlayers || [],
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

function updatePlayerTracking(roundData, matchCounts, byeCounts) {
  roundData.teams.forEach(team => {
    const teamHasMatch = roundData.matches.some(match => 
      match.team1 === team || match.team2 === team
    );
    
    if (teamHasMatch) {
      team.players.forEach(player => {
        matchCounts[player.id]++;
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