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
  const maxRounds = matchesPerPlayer + 2; // More reasonable limit
  
  console.log(`\n=== Starting Tournament Generation ===`);
  console.log(`Players: ${players.length}, Courts: ${courtsAvailable}, Min per team: ${minPlayersPerTeam}, Matches per player: ${matchesPerPlayer}`);
  
  // Generate rounds until all players complete their matches
  while (roundNumber <= maxRounds) {
    // Find players who still need matches
    const playersNeedingMatches = players.filter(player => 
      playerMatchCounts[player.id] < matchesPerPlayer
    );
    
    if (playersNeedingMatches.length === 0) {
      console.log('All players have completed their required matches');
      break;
    }
    
    console.log(`\nRound ${roundNumber}: ${playersNeedingMatches.length} players still need matches`);
    
    // Generate a round using available courts efficiently
    const roundData = generateEfficientRound(
      playersNeedingMatches, 
      settings, 
      roundNumber,
      playerMatchCounts,
      playerByeCount,
      matchesPerPlayer
    );
    
    if (!roundData || roundData.matches.length === 0) {
      console.log(`Cannot generate meaningful matches for round ${roundNumber}`);
      break;
    }
    
    // Update tracking for this round
    updatePlayerTracking(roundData, playerMatchCounts, playerOpponents, playerByeCount);
    
    allRounds.push(roundData);
    console.log(`Round ${roundNumber}: ${roundData.totalPlayingPlayers} playing (${roundData.teams.length} teams, ${roundData.matches.length} matches), ${roundData.totalByePlayers} bye`);
    
    roundNumber++;
  }
  
  // Final validation and logging
  console.log('\n=== Final Validation ===');
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
  } else {
    console.error('ERROR: Some players still have incomplete matches:');
    incompleteRounds.forEach(name => console.error(`- ${name}: ${playerMatchCounts[players.find(p => p.name === name).id]}/${matchesPerPlayer} matches`));
  }
  
  return allRounds;
}

function generateEfficientRound(playersNeedingMatches, settings, roundNumber, matchCounts, byeCounts, maxMatches) {
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
  
  // Simple strategy: Use all courts, create even teams
  const maxTeams = courtsAvailable * 2;
  
  // Calculate optimal team size
  let bestConfig = null;
  let maxPlayersIncluded = 0;
  
  // Try different team sizes to maximize player inclusion
  for (let teamSize = minPlayersPerTeam; teamSize <= maxPlayersPerTeam; teamSize++) {
    for (let numTeams = 2; numTeams <= maxTeams; numTeams += 2) {
      const totalPlayersNeeded = numTeams * teamSize;
      
      if (totalPlayersNeeded <= prioritizedPlayers.length && totalPlayersNeeded > maxPlayersIncluded) {
        maxPlayersIncluded = totalPlayersNeeded;
        bestConfig = {
          numTeams,
          teamSize,
          totalPlayers: totalPlayersNeeded
        };
      }
    }
  }
  
  // If no perfect fit, try mixed team sizes
  if (!bestConfig || maxPlayersIncluded < prioritizedPlayers.length - 4) {
    for (let numTeams = 2; numTeams <= maxTeams; numTeams += 2) {
      const baseSize = minPlayersPerTeam;
      const maxExtra = maxPlayersPerTeam - baseSize;
      
      // Try adding extra players up to the limit
      for (let extraPlayers = 0; extraPlayers <= numTeams * maxExtra; extraPlayers++) {
        const totalPlayers = numTeams * baseSize + extraPlayers;
        
        if (totalPlayers <= prioritizedPlayers.length && totalPlayers > maxPlayersIncluded) {
          maxPlayersIncluded = totalPlayers;
          bestConfig = {
            numTeams,
            teamSize: 'mixed',
            baseSize,
            extraPlayers,
            totalPlayers
          };
        }
      }
    }
  }
  
  if (!bestConfig) {
    console.log('No valid team configuration found');
    return null;
  }
  
  console.log(`  Using ${bestConfig.numTeams} teams, ${bestConfig.totalPlayers} players (${prioritizedPlayers.length - bestConfig.totalPlayers} bye)`);
  
  // Create the round with this configuration
  const playingPlayers = prioritizedPlayers.slice(0, bestConfig.totalPlayers);
  const byePlayers = prioritizedPlayers.slice(bestConfig.totalPlayers);
  
  // Create teams
  const teams = [];
  
  if (bestConfig.teamSize === 'mixed') {
    // Mixed team sizes - distribute players as evenly as possible
    const playersPerTeam = new Array(bestConfig.numTeams).fill(bestConfig.baseSize);
    
    // Distribute extra players
    for (let i = 0; i < bestConfig.extraPlayers; i++) {
      playersPerTeam[i % bestConfig.numTeams]++;
    }
    
    // Create teams
    let playerIndex = 0;
    for (let i = 0; i < bestConfig.numTeams; i++) {
      const teamPlayers = playingPlayers.slice(playerIndex, playerIndex + playersPerTeam[i]);
      teams.push({ players: teamPlayers });
      playerIndex += playersPerTeam[i];
    }
  } else {
    // Equal team sizes
    for (let i = 0; i < bestConfig.numTeams; i++) {
      const startIdx = i * bestConfig.teamSize;
      const endIdx = startIdx + bestConfig.teamSize;
      teams.push({ players: playingPlayers.slice(startIdx, endIdx) });
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

// Keep existing legacy functions unchanged
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
  
  // Calculate players per team
  const basePlayersPerTeam = Math.floor(players.length / targetTeams);
  const extraPlayers = players.length % targetTeams;
  
  // Separate and shuffle players by category
  const femaleSetters = shuffleArray([...players.filter(p => p.gender === 'female' && p.is_setter)]);
  const maleSetters = shuffleArray([...players.filter(p => p.gender === 'male' && p.is_setter)]);
  const femaleNonSetters = shuffleArray([...players.filter(p => p.gender === 'female' && !p.is_setter)]);
  const maleNonSetters = shuffleArray([...players.filter(p => p.gender === 'male' && !p.is_setter)]);
  
  // Create teams
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
  
  // Distribute players evenly across teams
  distributePlayersEvenly(teams, femaleSetters, 'female', true);
  distributePlayersEvenly(teams, maleSetters, 'male', true);
  distributePlayersEvenly(teams, femaleNonSetters, 'female', false);
  distributePlayersEvenly(teams, maleNonSetters, 'male', false);
  
  // Validate all teams have players
  const validTeams = teams.filter(team => team.players.length > 0);
  if (validTeams.length !== targetTeams) {
    console.warn(`Expected ${targetTeams} teams, got ${validTeams.length} valid teams`);
  }
  
  // Create matches by pairing teams
  const matches = [];
  for (let i = 0; i < validTeams.length; i += 2) {
    if (i + 1 < validTeams.length) {
      const court = Math.floor(i / 2) + 1;
      matches.push({
        team1: validTeams[i],
        team2: validTeams[i + 1],
        court: court,
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