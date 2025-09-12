function generateAllRounds(players, settings) {
  const { courtsAvailable, minPlayersPerTeam, matchesPerPlayer, hasPowerMatch } = settings;
  const maxPlayersPerTeam = 6;
  
  console.log(`\n=== Tournament Generation Start ===`);
  console.log(`Players: ${players.length}, Courts: ${courtsAvailable}, Matches per player: ${matchesPerPlayer}`);
  
  // PRE-ASSIGN BYES: Each player gets exactly one bye round
  const byeAssignments = preAssignByes(players, matchesPerPlayer);
  
  console.log(`\n=== Bye Assignments ===`);
  byeAssignments.forEach((playersOnBye, roundIndex) => {
    console.log(`Round ${roundIndex + 1}: ${playersOnBye.length} players on bye`);
  });
  
  const totalAssignedByes = byeAssignments.reduce((sum, round) => sum + round.length, 0);
  console.log(`Total byes assigned: ${totalAssignedByes} (should equal ${players.length})`);
  
  if (totalAssignedByes !== players.length) {
    console.error(`ERROR: Bye assignment failed - ${totalAssignedByes} byes assigned instead of ${players.length}`);
  }
  
  // Generate rounds based on pre-assigned byes
  const allRounds = [];
  const playerMatchCounts = {};
  
  // Initialize match tracking
  players.forEach(p => {
    playerMatchCounts[p.id] = 0;
  });
  
  for (let roundIndex = 0; roundIndex < byeAssignments.length; roundIndex++) {
    const roundNumber = roundIndex + 1;
    const playersOnByeThisRound = byeAssignments[roundIndex];
    const playersPlayingThisRound = players.filter(p => 
      !playersOnByeThisRound.some(byePlayer => byePlayer.id === p.id)
    );
    
    console.log(`\n=== Generating Round ${roundNumber} ===`);
    console.log(`Playing: ${playersPlayingThisRound.length}, Bye: ${playersOnByeThisRound.length}`);
    
    // Generate teams and matches for playing players
    const roundData = generateRoundFromPlayers(
      playersPlayingThisRound,
      playersOnByeThisRound,
      settings,
      roundNumber
    );
    
    if (!roundData) {
      console.error(`Failed to generate round ${roundNumber}`);
      break;
    }
    
    // Update match counts
    roundData.teams.forEach(team => {
      const teamHasMatch = roundData.matches.some(match => 
        match.team1 === team || match.team2 === team
      );
      
      if (teamHasMatch) {
        team.players.forEach(player => {
          playerMatchCounts[player.id]++;
        });
      }
    });
    
    allRounds.push(roundData);
    console.log(`Round ${roundNumber} complete: ${roundData.matches.length} matches, ${roundData.totalPlayingPlayers} playing, ${roundData.totalByePlayers} bye`);
  }
  
  // Final validation
  console.log('\n=== Final Validation ===');
  let playersWithWrongMatches = 0;
  players.forEach(player => {
    const matches = playerMatchCounts[player.id];
    if (matches !== matchesPerPlayer) {
      console.warn(`${player.name}: ${matches}/${matchesPerPlayer} matches`);
      playersWithWrongMatches++;
    }
  });
  
  if (playersWithWrongMatches === 0) {
    console.log('✅ All players have correct number of matches!');
  } else {
    console.error(`❌ ${playersWithWrongMatches} players have incorrect match counts`);
  }
  
  return allRounds;
}

function preAssignByes(players, matchesPerPlayer) {
  const totalPlayers = players.length;
  const estimatedRounds = matchesPerPlayer + 1; // Each player plays (matchesPerPlayer) and sits 1
  
  console.log(`Pre-assigning byes for ${totalPlayers} players across ${estimatedRounds} rounds`);
  
  // Create rounds array
  const byeAssignments = [];
  for (let i = 0; i < estimatedRounds; i++) {
    byeAssignments.push([]);
  }
  
  // Shuffle players for random distribution
  const shuffledPlayers = shuffleArray([...players]);
  
  // Assign each player to exactly one bye round
  shuffledPlayers.forEach((player, index) => {
    const roundIndex = index % estimatedRounds;
    byeAssignments[roundIndex].push(player);
  });
  
  // If we have extra players (totalPlayers > estimatedRounds), distribute them
  // This shouldn't happen with our math, but just in case
  const extraPlayers = totalPlayers % estimatedRounds;
  if (extraPlayers > 0) {
    console.log(`Note: ${extraPlayers} players will need additional bye assignment handling`);
  }
  
  return byeAssignments;
}

function generateRoundFromPlayers(playingPlayers, byePlayers, settings, roundNumber) {
  const { courtsAvailable, minPlayersPerTeam } = settings;
  const maxPlayersPerTeam = 6;
  const maxTeams = courtsAvailable * 2;
  
  if (playingPlayers.length < minPlayersPerTeam * 2) {
    console.warn(`Not enough players to form teams: ${playingPlayers.length}`);
    return {
      roundNumber,
      teams: [],
      matches: [],
      byePlayers,
      totalPlayingPlayers: 0,
      totalByePlayers: byePlayers.length
    };
  }
  
  // Find best team configuration for the available players
  let bestConfig = null;
  let bestScore = -1;
  
  // Try different team configurations
  for (let numTeams = 2; numTeams <= maxTeams; numTeams += 2) {
    for (let teamSize = minPlayersPerTeam; teamSize <= maxPlayersPerTeam; teamSize++) {
      const totalPlayersNeeded = numTeams * teamSize;
      
      if (totalPlayersNeeded <= playingPlayers.length) {
        // Score: prefer using more players and more courts
        const playerUtilization = totalPlayersNeeded / playingPlayers.length;
        const courtUtilization = numTeams / maxTeams;
        const score = (playerUtilization * 100) + (courtUtilization * 50);
        
        if (score > bestScore) {
          bestScore = score;
          bestConfig = {
            numTeams,
            teamSize,
            totalPlayers: totalPlayersNeeded,
            type: 'equal'
          };
        }
      }
    }
  }
  
  // Try mixed team sizes to use more players
  for (let numTeams = 2; numTeams <= maxTeams; numTeams += 2) {
    const minTotal = numTeams * minPlayersPerTeam;
    const maxTotal = numTeams * maxPlayersPerTeam;
    
    // Try to use as many players as possible with mixed sizes
    for (let totalUsed = maxTotal; totalUsed >= minTotal; totalUsed--) {
      if (totalUsed <= playingPlayers.length) {
        const playerUtilization = totalUsed / playingPlayers.length;
        const courtUtilization = numTeams / maxTeams;
        const score = (playerUtilization * 100) + (courtUtilization * 50) + 25; // Bonus for mixed
        
        if (score > bestScore) {
          bestScore = score;
          bestConfig = {
            numTeams,
            totalPlayers: totalUsed,
            type: 'mixed'
          };
        }
        break; // Take the first (highest) valid count
      }
    }
  }
  
  if (!bestConfig) {
    console.error(`No valid team configuration found for ${playingPlayers.length} players`);
    return null;
  }
  
  console.log(`  Using ${bestConfig.numTeams} teams, ${bestConfig.totalPlayers}/${playingPlayers.length} players`);
  
  // Create teams
  const selectedPlayers = playingPlayers.slice(0, bestConfig.totalPlayers);
  const teams = [];
  
  if (bestConfig.type === 'equal') {
    // Equal team sizes
    for (let i = 0; i < bestConfig.numTeams; i++) {
      const startIdx = i * bestConfig.teamSize;
      const endIdx = startIdx + bestConfig.teamSize;
      teams.push({ players: selectedPlayers.slice(startIdx, endIdx) });
    }
  } else {
    // Mixed team sizes
    const baseSize = minPlayersPerTeam;
    const totalExtra = bestConfig.totalPlayers - (bestConfig.numTeams * baseSize);
    
    let playerIndex = 0;
    for (let i = 0; i < bestConfig.numTeams; i++) {
      const extraForThisTeam = Math.floor(totalExtra * (i + 1) / bestConfig.numTeams) - Math.floor(totalExtra * i / bestConfig.numTeams);
      const teamSize = baseSize + extraForThisTeam;
      
      teams.push({ 
        players: selectedPlayers.slice(playerIndex, playerIndex + teamSize) 
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
  
  // Add any remaining players to bye list
  const remainingPlayers = playingPlayers.slice(bestConfig.totalPlayers);
  const allByePlayers = [...byePlayers, ...remainingPlayers];
  
  return {
    roundNumber,
    teams,
    matches,
    byePlayers: allByePlayers,
    totalPlayingPlayers: selectedPlayers.length,
    totalByePlayers: allByePlayers.length
  };
}

function balanceTeams(teams) {
  const allPlayers = [];
  teams.forEach(team => allPlayers.push(...team.players));
  
  const femaleSetters = shuffleArray(allPlayers.filter(p => p.gender === 'female' && p.is_setter));
  const maleSetters = shuffleArray(allPlayers.filter(p => p.gender === 'male' && p.is_setter));
  const femaleNonSetters = shuffleArray(allPlayers.filter(p => p.gender === 'female' && !p.is_setter));
  const maleNonSetters = shuffleArray(allPlayers.filter(p => p.gender === 'male' && !p.is_setter));
  
  // Clear teams
  teams.forEach(team => {
    team.players = [];
    team.maleCount = 0;
    team.femaleCount = 0;
    team.setterCount = 0;
  });
  
  // Distribute players
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

function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Legacy compatibility functions
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