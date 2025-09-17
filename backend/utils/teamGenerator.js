function generateAllRounds(players, settings) {
  const { courtsAvailable, minPlayersPerTeam, matchesPerPlayer, hasPowerMatch } = settings;
  const maxPlayersPerTeam = 6;
  
  console.log(`\n=== Tournament Generation Start ===`);
  console.log(`Players: ${players.length}, Courts: ${courtsAvailable}, Matches per player: ${matchesPerPlayer}`);
  
  // Calculate tournament structure based on player count
  const tournamentStructure = calculateTournamentStructure(players.length, courtsAvailable, minPlayersPerTeam, maxPlayersPerTeam, matchesPerPlayer);
  
  console.log(`\n=== Tournament Structure ===`);
  console.log(`Players per round: ${tournamentStructure.playersPerRound}`);
  console.log(`Byes per round: ${tournamentStructure.byesPerRound}`);
  console.log(`Total rounds: ${tournamentStructure.totalRounds}`);
  console.log(`Bye rounds per player: ${tournamentStructure.byeRoundsPerPlayer} (${tournamentStructure.extraByePlayers} players get +1)`);
  
  // Generate bye assignments
  const byeAssignments = createBalancedByeRotation(players, tournamentStructure);
  
  // Generate rounds
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
    console.log(`Round ${roundNumber} complete: ${roundData.matches.length} matches on ${courtsAvailable} courts`);
  }
  
  // Final validation
  console.log('\n=== Final Validation ===');
  let playersWithCorrectMatches = 0;
  players.forEach(player => {
    const matches = playerMatchCounts[player.id];
    if (matches === matchesPerPlayer) {
      playersWithCorrectMatches++;
    } else {
      console.warn(`${player.name}: ${matches}/${matchesPerPlayer} matches`);
    }
  });
  
  if (playersWithCorrectMatches === players.length) {
    console.log('✅ All players have correct number of matches!');
  } else {
    console.error(`❌ ${players.length - playersWithCorrectMatches} players have incorrect match counts`);
  }
  
  return allRounds;
}

function calculateTournamentStructure(totalPlayers, courtsAvailable, minPlayersPerTeam, maxPlayersPerTeam, matchesPerPlayer) {
  const maxTeamsPerRound = courtsAvailable * 2;
  const maxPlayersPerRound = maxTeamsPerRound * maxPlayersPerTeam;
  
  // For smaller tournaments (≤max capacity), everyone can play every round
  if (totalPlayers <= maxPlayersPerRound) {
    return {
      playersPerRound: totalPlayers,
      byesPerRound: 0,
      totalRounds: matchesPerPlayer,
      byeRoundsPerPlayer: 0,
      extraByePlayers: 0
    };
  }
  
  // For larger tournaments, find the optimal structure
  // The key insight: we want each player to get exactly matchesPerPlayer matches
  // So total rounds should be close to matchesPerPlayer (not much more)
  
  let bestStructure = null;
  let bestScore = -1;
  
  // Try different players per round, but also try different round counts
  // Focus on round counts close to matchesPerPlayer
  for (let testRounds = matchesPerPlayer; testRounds <= matchesPerPlayer + 2; testRounds++) {
    
    // For each round count, try different team configurations
    for (let avgTeamSize = minPlayersPerTeam; avgTeamSize <= maxPlayersPerTeam; avgTeamSize += 0.5) {
      const playersPerRound = Math.floor(maxTeamsPerRound * avgTeamSize);
      
      // Make sure we can form valid teams
      if (!canFormValidTeams(playersPerRound, maxTeamsPerRound, minPlayersPerTeam, maxPlayersPerTeam)) {
        continue;
      }
      
      const byesPerRound = totalPlayers - playersPerRound;
      if (byesPerRound <= 0) continue;
      
      // Calculate total matches generated with this structure
      const totalMatchesGenerated = testRounds * playersPerRound;
      const targetMatches = totalPlayers * matchesPerPlayer;
      
      // We want to generate close to (but at least) the target matches
      if (totalMatchesGenerated < targetMatches) continue; // Not enough matches
      
      const totalByeSlots = testRounds * byesPerRound;
      const byeRoundsPerPlayer = Math.floor(totalByeSlots / totalPlayers);
      const extraByePlayers = totalByeSlots % totalPlayers;
      
      // Score this configuration
      // 1. Prefer fewer total rounds
      const roundScore = Math.max(0, 100 - (testRounds - matchesPerPlayer) * 25);
      
      // 2. Prefer generating close to target matches (but not way over)
      const matchOverage = totalMatchesGenerated - targetMatches;
      const matchScore = Math.max(0, 100 - matchOverage * 2);
      
      // 3. Prefer even bye distribution
      const byeEqualityScore = 100 - (extraByePlayers / totalPlayers) * 50;
      
      // 4. Court utilization
      const courtScore = (playersPerRound / maxPlayersPerRound) * 50;
      
      const totalScore = roundScore + matchScore + byeEqualityScore + courtScore;
      
      console.log(`Testing: ${testRounds} rounds, ${playersPerRound} players/round, ${byesPerRound} byes/round, ${byeRoundsPerPlayer} byes/player, score: ${totalScore.toFixed(1)}`);
      
      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestStructure = {
          playersPerRound,
          byesPerRound,
          totalRounds: testRounds,
          byeRoundsPerPlayer,
          extraByePlayers
        };
      }
    }
  }
  
  return bestStructure || {
    // Fallback
    playersPerRound: maxPlayersPerRound,
    byesPerRound: totalPlayers - maxPlayersPerRound,
    totalRounds: matchesPerPlayer + 1,
    byeRoundsPerPlayer: 1,
    extraByePlayers: 0
  };
}

function canFormValidTeams(totalPlayers, maxTeams, minTeamSize, maxTeamSize) {
  if (totalPlayers < minTeamSize * 2) return false; // Need at least 2 teams
  
  // Try to see if we can distribute players into valid team sizes
  for (let numTeams = 2; numTeams <= maxTeams; numTeams += 2) { // Even number of teams
    const avgTeamSize = totalPlayers / numTeams;
    
    if (avgTeamSize >= minTeamSize && avgTeamSize <= maxTeamSize) {
      // Check if we can actually create this configuration
      const baseSize = Math.floor(avgTeamSize);
      const remainder = totalPlayers % numTeams;
      
      // All teams get baseSize, some get baseSize + 1
      const smallTeamSize = baseSize;
      const largeTeamSize = baseSize + 1;
      
      if (smallTeamSize >= minTeamSize && smallTeamSize <= maxTeamSize &&
          largeTeamSize >= minTeamSize && largeTeamSize <= maxTeamSize) {
        return true;
      }
    }
  }
  
  return false;
}

function createBalancedByeRotation(players, structure) {
  const { totalRounds, playersPerRound } = structure;
  const totalPlayers = players.length;
  
  // Calculate how many total bye slots we need across all rounds
  // Goal: Each player gets exactly 1 bye across the entire tournament
  const targetTotalByes = totalPlayers;
  
  console.log(`Creating flexible bye rotation:`);
  console.log(`- ${totalRounds} rounds with ${playersPerRound} players playing per round`);
  console.log(`- Target total byes: ${targetTotalByes} (1 per player)`);
  
  const byeAssignments = [];
  const shuffledPlayers = shuffleArray([...players]);
  const playerByeCount = {};
  
  // Initialize player bye counts
  shuffledPlayers.forEach(player => {
    playerByeCount[player.id] = 0;
  });
  
  // Distribute byes across rounds to reach exactly the target total
  let totalByesAssigned = 0;
  
  for (let roundIndex = 0; roundIndex < totalRounds; roundIndex++) {
    const byesNeeded = totalPlayers - playersPerRound;
    const byesRemaining = targetTotalByes - totalByesAssigned;
    const roundsRemaining = totalRounds - roundIndex;
    
    // Calculate how many byes to assign this round
    // Try to distribute remaining byes evenly across remaining rounds
    let byesThisRound = Math.min(byesNeeded, Math.ceil(byesRemaining / roundsRemaining));
    
    // But make sure we can still form valid teams with remaining players
    const playersAfterByes = totalPlayers - byesThisRound;
    const minPlayersForTeams = 10; // Need at least 2 teams of 5
    
    if (playersAfterByes < minPlayersForTeams) {
      byesThisRound = totalPlayers - minPlayersForTeams;
    }
    
    // Final adjustment: if this is the last round, assign exactly what's needed
    if (roundIndex === totalRounds - 1) {
      byesThisRound = byesRemaining;
    }
    
    console.log(`Round ${roundIndex + 1}: Planning ${byesThisRound} byes (${byesRemaining} total remaining)`);
    
    // Select players for bye this round
    const byePlayersThisRound = [];
    
    // Get players who haven't had a bye yet, prioritized
    const playersNeedingByes = shuffledPlayers
      .filter(player => playerByeCount[player.id] === 0)
      .slice(0, byesThisRound);
    
    // Add them to bye list
    playersNeedingByes.forEach(player => {
      byePlayersThisRound.push(player);
      playerByeCount[player.id]++;
      totalByesAssigned++;
    });
    
    // If we need more byes and ran out of players with 0 byes, 
    // add players who have had the fewest byes
    while (byePlayersThisRound.length < byesThisRound && totalByesAssigned < targetTotalByes) {
      const availablePlayers = shuffledPlayers
        .filter(player => !byePlayersThisRound.some(p => p.id === player.id))
        .sort((a, b) => playerByeCount[a.id] - playerByeCount[b.id]);
      
      if (availablePlayers.length > 0) {
        const player = availablePlayers[0];
        byePlayersThisRound.push(player);
        playerByeCount[player.id]++;
        totalByesAssigned++;
      } else {
        break; // Safety break
      }
    }
    
    byeAssignments.push(byePlayersThisRound);
    console.log(`Round ${roundIndex + 1}: ${byePlayersThisRound.length} players on bye`);
  }
  
  // Validation
  console.log(`\n=== Bye Assignment Validation ===`);
  let playersWithOneBye = 0;
  let playersWithZeroByes = 0;
  let playersWithMultipleByes = 0;
  
  shuffledPlayers.forEach(player => {
    const byeCount = playerByeCount[player.id];
    if (byeCount === 0) {
      playersWithZeroByes++;
      console.warn(`${player.name}: 0 bye rounds`);
    } else if (byeCount === 1) {
      playersWithOneBye++;
    } else {
      playersWithMultipleByes++;
      console.warn(`${player.name}: ${byeCount} bye rounds`);
    }
  });
  
  console.log(`Total bye assignments: ${totalByesAssigned}`);
  console.log(`Players with 0 byes: ${playersWithZeroByes}`);
  console.log(`Players with 1 bye: ${playersWithOneBye}`);
  console.log(`Players with 2+ byes: ${playersWithMultipleByes}`);
  
  if (playersWithZeroByes === 0) {
    console.log('✅ Perfect bye distribution - everyone gets at least one bye!');
  }
  
  return byeAssignments;
}

function createNoByeRounds(matchesPerPlayer) {
  // Create empty bye assignments for each round when no byes are needed
  const rounds = [];
  for (let i = 0; i < matchesPerPlayer; i++) {
    rounds.push([]); // Empty array = no players on bye
  }
  return rounds;
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
  
  // Calculate team configuration - use all available courts
  const numTeams = Math.min(maxTeams, Math.floor(playingPlayers.length / minPlayersPerTeam));
  // Ensure even number of teams for matches
  const evenNumTeams = numTeams % 2 === 0 ? numTeams : numTeams - 1;
  
  if (evenNumTeams < 2) {
    console.warn(`Cannot form enough teams with ${playingPlayers.length} players`);
    return {
      roundNumber,
      teams: [],
      matches: [],
      byePlayers: [...byePlayers, ...playingPlayers],
      totalPlayingPlayers: 0,
      totalByePlayers: byePlayers.length + playingPlayers.length
    };
  }
  
  // Calculate team sizes
  const playersToUse = Math.min(playingPlayers.length, evenNumTeams * maxPlayersPerTeam);
  const baseTeamSize = Math.floor(playersToUse / evenNumTeams);
  const extraPlayers = playersToUse % evenNumTeams;
  
  console.log(`  Using ${evenNumTeams} teams, base size ${baseTeamSize}, ${extraPlayers} teams get +1 player`);
  
  // Create team size array
  const teamSizes = [];
  for (let i = 0; i < evenNumTeams; i++) {
    teamSizes.push(baseTeamSize + (i < extraPlayers ? 1 : 0));
  }
  
  // Create teams
  const teams = createTeamsWithSizes(playingPlayers.slice(0, playersToUse), teamSizes);
  
  // Balance teams for skill/gender distribution
  balanceTeams(teams);
  
  // Create matches - pair teams sequentially across available courts
  const matches = [];
  for (let i = 0; i < teams.length - 1; i += 2) {
    const courtNumber = Math.floor(i / 2) + 1;
    matches.push({
      team1: teams[i],
      team2: teams[i + 1],
      court: courtNumber,
      isPowerMatch: false
    });
    
    console.log(`    Match ${matches.length}: Team ${i + 1} vs Team ${i + 2} on Court ${courtNumber}`);
  }
  
  // Add unused players to bye list
  const unusedPlayers = playingPlayers.slice(playersToUse);
  const allByePlayers = [...byePlayers, ...unusedPlayers];
  
  return {
    roundNumber,
    teams,
    matches,
    byePlayers: allByePlayers,
    totalPlayingPlayers: playersToUse,
    totalByePlayers: allByePlayers.length
  };
}

function createTeamsWithSizes(players, teamSizes) {
  const teams = [];
  let playerIndex = 0;
  
  teamSizes.forEach((size, teamIndex) => {
    teams.push({
      players: players.slice(playerIndex, playerIndex + size),
      targetSize: size
    });
    playerIndex += size;
  });
  
  return teams;
}

function balanceTeams(teams) {
  const allPlayers = [];
  teams.forEach(team => allPlayers.push(...team.players));
  
  // Categorize players for balanced distribution
  const playerCategories = {
    femaleSettersA: shuffleArray(allPlayers.filter(p => p.gender === 'female' && p.is_setter && p.skill_level === 'A')),
    femaleSettersBB: shuffleArray(allPlayers.filter(p => p.gender === 'female' && p.is_setter && p.skill_level === 'BB')),
    femaleSettersB: shuffleArray(allPlayers.filter(p => p.gender === 'female' && p.is_setter && p.skill_level === 'B')),
    maleSettersA: shuffleArray(allPlayers.filter(p => p.gender === 'male' && p.is_setter && p.skill_level === 'A')),
    maleSettersBB: shuffleArray(allPlayers.filter(p => p.gender === 'male' && p.is_setter && p.skill_level === 'BB')),
    maleSettersB: shuffleArray(allPlayers.filter(p => p.gender === 'male' && p.is_setter && p.skill_level === 'B')),
    femaleNonSettersA: shuffleArray(allPlayers.filter(p => p.gender === 'female' && !p.is_setter && p.skill_level === 'A')),
    femaleNonSettersBB: shuffleArray(allPlayers.filter(p => p.gender === 'female' && !p.is_setter && p.skill_level === 'BB')),
    femaleNonSettersB: shuffleArray(allPlayers.filter(p => p.gender === 'female' && !p.is_setter && p.skill_level === 'B')),
    maleNonSettersA: shuffleArray(allPlayers.filter(p => p.gender === 'male' && !p.is_setter && p.skill_level === 'A')),
    maleNonSettersBB: shuffleArray(allPlayers.filter(p => p.gender === 'male' && !p.is_setter && p.skill_level === 'BB')),
    maleNonSettersB: shuffleArray(allPlayers.filter(p => p.gender === 'male' && !p.is_setter && p.skill_level === 'B'))
  };
  
  // Clear teams and initialize stats
  teams.forEach(team => {
    team.players = [];
    team.stats = {
      maleCount: 0,
      femaleCount: 0,
      setterCount: 0,
      skillA: 0,
      skillBB: 0,
      skillB: 0
    };
  });
  
  // Distribution order (most important categories first)
  const distributionOrder = [
    { category: 'femaleSettersA', gender: 'female', skill: 'A', isSetter: true },
    { category: 'maleSettersA', gender: 'male', skill: 'A', isSetter: true },
    { category: 'femaleSettersBB', gender: 'female', skill: 'BB', isSetter: true },
    { category: 'maleSettersBB', gender: 'male', skill: 'BB', isSetter: true },
    { category: 'femaleSettersB', gender: 'female', skill: 'B', isSetter: true },
    { category: 'maleSettersB', gender: 'male', skill: 'B', isSetter: true },
    { category: 'femaleNonSettersA', gender: 'female', skill: 'A', isSetter: false },
    { category: 'maleNonSettersA', gender: 'male', skill: 'A', isSetter: false },
    { category: 'femaleNonSettersBB', gender: 'female', skill: 'BB', isSetter: false },
    { category: 'maleNonSettersBB', gender: 'male', skill: 'BB', isSetter: false },
    { category: 'femaleNonSettersB', gender: 'female', skill: 'B', isSetter: false },
    { category: 'maleNonSettersB', gender: 'male', skill: 'B', isSetter: false }
  ];
  
  // Distribute players
  distributionOrder.forEach(({ category, gender, skill, isSetter }) => {
    const playersInCategory = playerCategories[category];
    playersInCategory.forEach(player => {
      const bestTeam = findBestTeamForPlayer(teams, player, gender, skill, isSetter);
      bestTeam.players.push(player);
      updateTeamStats(bestTeam, player, gender, skill, isSetter);
    });
  });
}

function findBestTeamForPlayer(teams, player, gender, skill, isSetter) {
  return teams
    .filter(team => team.players.length < team.targetSize)
    .sort((a, b) => {
      // Priority 1: Teams with fewer players
      if (a.players.length !== b.players.length) {
        return a.players.length - b.players.length;
      }
      
      // Priority 2: Setter balance (if this player is a setter)
      if (isSetter) {
        const aSetterDeficit = (a.stats.setterCount === 0) ? -10 : 0;
        const bSetterDeficit = (b.stats.setterCount === 0) ? -10 : 0;
        if (aSetterDeficit !== bSetterDeficit) {
          return aSetterDeficit - bSetterDeficit;
        }
      }
      
      // Priority 3: Gender balance
      const aGenderCount = gender === 'male' ? a.stats.maleCount : a.stats.femaleCount;
      const bGenderCount = gender === 'male' ? b.stats.maleCount : b.stats.femaleCount;
      if (aGenderCount !== bGenderCount) {
        return aGenderCount - bGenderCount;
      }
      
      // Priority 4: Skill level balance
      const aSkillCount = getSkillCount(a.stats, skill);
      const bSkillCount = getSkillCount(b.stats, skill);
      return aSkillCount - bSkillCount;
    })[0];
}

function updateTeamStats(team, player, gender, skill, isSetter) {
  team.stats.maleCount += gender === 'male' ? 1 : 0;
  team.stats.femaleCount += gender === 'female' ? 1 : 0;
  team.stats.setterCount += isSetter ? 1 : 0;
  team.stats.skillA += skill === 'A' ? 1 : 0;
  team.stats.skillBB += skill === 'BB' ? 1 : 0;
  team.stats.skillB += skill === 'B' ? 1 : 0;
}

function getSkillCount(stats, skillLevel) {
  switch (skillLevel) {
    case 'A': return stats.skillA || 0;
    case 'BB': return stats.skillBB || 0;
    case 'B': return stats.skillB || 0;
    default: return 0;
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
  
  // Calculate team sizes
  const baseTeamSize = Math.floor(players.length / targetTeams);
  const extraPlayers = players.length % targetTeams;
  
  const teamSizes = [];
  for (let i = 0; i < targetTeams; i++) {
    teamSizes.push(baseTeamSize + (i < extraPlayers ? 1 : 0));
  }
  
  const teams = createTeamsWithSizes(players, teamSizes);
  balanceTeams(teams);
  
  // Create matches - pair teams sequentially
  const matches = [];
  for (let i = 0; i < teams.length - 1; i += 2) {
    const courtNumber = Math.floor(i / 2) + 1;
    matches.push({
      team1: teams[i],
      team2: teams[i + 1],
      court: courtNumber,
      isPowerMatch: false
    });
  }
  
  return {
    roundNumber,
    teams,
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