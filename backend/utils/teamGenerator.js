function generateAllRounds(players, settings) {
  const { courtsAvailable, minPlayersPerTeam, matchesPerPlayer, hasPowerMatch } = settings;
  const maxPlayersPerTeam = 6;
  
  console.log(`\n=== Tournament Generation Start ===`);
  console.log(`Players: ${players.length}, Courts: ${courtsAvailable}, Matches per player: ${matchesPerPlayer}`);
  
  // Calculate tournament structure based on player count
  const tournamentStructure = calculateTournamentStructure(players.length, courtsAvailable, minPlayersPerTeam, maxPlayersPerTeam, matchesPerPlayer);
  
  console.log(`\n=== Final Tournament Structure ===`);
  console.log(`Players per round: ${tournamentStructure.playersPerRound}`);
  console.log(`Byes per round: ~${tournamentStructure.byesPerRound}`);
  console.log(`Total rounds: ${tournamentStructure.totalRounds}`);
  console.log(`Effective courts: ${tournamentStructure.effectiveCourts}`);
  
  // Generate bye assignments
  const byeAssignments = createOptimizedByeRotation(players, tournamentStructure);
  
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
      { ...settings, courtsAvailable: tournamentStructure.effectiveCourts },
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
    console.log(`Round ${roundNumber} complete: ${roundData.matches.length} matches on ${tournamentStructure.effectiveCourts} courts`);
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
  console.log(`\n=== Calculating Tournament Structure ===`);
  console.log(`Total players: ${totalPlayers}, Available courts: ${courtsAvailable}`);
  
  // First, determine how many courts we can actually use based on player count
  let effectiveCourts = courtsAvailable;
  let maxTeamsPerRound = courtsAvailable * 2;
  let maxPlayersPerRound = maxTeamsPerRound * maxPlayersPerTeam;
  let minPlayersPerRound = maxTeamsPerRound * minPlayersPerTeam;
  
  // If we don't have enough players to use all courts with minimum team sizes, reduce courts
  while (totalPlayers < minPlayersPerRound && effectiveCourts > 1) {
    effectiveCourts--;
    maxTeamsPerRound = effectiveCourts * 2;
    maxPlayersPerRound = maxTeamsPerRound * maxPlayersPerTeam;
    minPlayersPerRound = maxTeamsPerRound * minPlayersPerTeam;
    console.log(`Reduced to ${effectiveCourts} courts due to player constraints`);
  }
  
  console.log(`Using ${effectiveCourts} courts (${maxTeamsPerRound} teams max, ${minPlayersPerRound}-${maxPlayersPerRound} players per round)`);
  
  // For smaller tournaments (≤effective capacity), everyone can play every round
  if (totalPlayers <= maxPlayersPerRound) {
    console.log(`All ${totalPlayers} players can play every round`);
    return {
      playersPerRound: totalPlayers,
      byesPerRound: 0,
      totalRounds: matchesPerPlayer,
      effectiveCourts
    };
  }
  
  // For larger tournaments, find the minimum viable round count
  const targetPlayerMatches = totalPlayers * matchesPerPlayer;
  console.log(`Target total player-matches: ${targetPlayerMatches}`);
  
  // Start with the minimum possible rounds and work up
  for (let testRounds = matchesPerPlayer; testRounds <= matchesPerPlayer + 3; testRounds++) {
    console.log(`\n--- Testing ${testRounds} rounds ---`);
    
    // For each round count, find the best team configuration
    let bestConfigForRounds = null;
    let bestScore = -1;
    
    // Try different team configurations
    for (let avgTeamSize = minPlayersPerTeam; avgTeamSize <= maxPlayersPerTeam; avgTeamSize += 0.5) {
      const playersPerRound = Math.floor(maxTeamsPerRound * avgTeamSize);
      
      // Make sure this is within our constraints
      if (playersPerRound < minPlayersPerRound || playersPerRound > maxPlayersPerRound) {
        continue;
      }
      
      // Make sure we can form valid teams
      if (!canFormValidTeams(playersPerRound, maxTeamsPerRound, minPlayersPerTeam, maxPlayersPerTeam)) {
        continue;
      }
      
      const byesPerRound = totalPlayers - playersPerRound;
      if (byesPerRound < 0) continue;
      
      // Calculate total matches generated
      const totalMatchesGenerated = testRounds * playersPerRound;
      
      // Must generate at least target matches
      if (totalMatchesGenerated < targetPlayerMatches) {
        console.log(`  ${playersPerRound} players/round: ${totalMatchesGenerated} matches (too few)`);
        continue;
      }
      
      // Score this configuration - heavily favor fewer rounds
      const matchOverage = totalMatchesGenerated - targetPlayerMatches;
      const matchEfficiency = Math.max(0, 100 - (matchOverage / targetPlayerMatches) * 100);
      const courtUtilization = (playersPerRound / maxPlayersPerRound) * 50;
      const score = matchEfficiency + courtUtilization;
      
      console.log(`  ${playersPerRound} players/round: ${totalMatchesGenerated} matches, score: ${score.toFixed(1)}`);
      
      if (score > bestScore) {
        bestScore = score;
        bestConfigForRounds = {
          playersPerRound,
          byesPerRound,
          totalRounds: testRounds,
          effectiveCourts
        };
      }
    }
    
    // If we found a viable configuration for this round count, use it
    if (bestConfigForRounds) {
      console.log(`✅ Found viable ${testRounds}-round structure`);
      return bestConfigForRounds;
    }
  }
  
  // Fallback - shouldn't reach here with proper logic
  return {
    playersPerRound: Math.min(totalPlayers, maxPlayersPerRound),
    byesPerRound: Math.max(0, totalPlayers - maxPlayersPerRound),
    totalRounds: matchesPerPlayer + 1,
    effectiveCourts
  };
}

function createOptimizedByeRotation(players, structure) {
  const { totalRounds, playersPerRound } = structure;
  const totalPlayers = players.length;
  
  console.log(`\n=== Creating Optimized Bye Rotation ===`);
  console.log(`${totalRounds} rounds with ${playersPerRound} players per round`);
  
  // Special case: if everyone can play every round
  if (playersPerRound >= totalPlayers) {
    console.log('No byes needed - everyone plays every round');
    const byeAssignments = [];
    for (let i = 0; i < totalRounds; i++) {
      byeAssignments.push([]);
    }
    return byeAssignments;
  }
  
  const byesPerRound = totalPlayers - playersPerRound;
  const totalByeSlots = totalRounds * byesPerRound;
  
  console.log(`Base byes per round: ${byesPerRound}`);
  console.log(`Total bye slots available: ${totalByeSlots}`);
  
  // Target: give each player exactly 1 bye if possible, otherwise distribute evenly
  const targetTotalByes = Math.min(totalPlayers, totalByeSlots);
  
  const byeAssignments = [];
  const shuffledPlayers = shuffleArray([...players]);
  const playerByeCount = {};
  
  // Initialize player bye counts
  shuffledPlayers.forEach(player => {
    playerByeCount[player.id] = 0;
  });
  
  // Calculate how many byes each player should get
  const baseByesPerPlayer = Math.floor(targetTotalByes / totalPlayers);
  const extraByeSlots = targetTotalByes % totalPlayers;
  
  console.log(`Target byes per player: ${baseByesPerPlayer} (${extraByeSlots} players get +1)`);
  
  // Assign target bye counts to players
  const playerTargetByes = {};
  shuffledPlayers.forEach((player, index) => {
    playerTargetByes[player.id] = baseByesPerPlayer + (index < extraByeSlots ? 1 : 0);
  });
  
  let totalByesAssigned = 0;
  
  // Distribute byes round by round to hit exactly the target
  for (let roundIndex = 0; roundIndex < totalRounds; roundIndex++) {
    const byePlayersThisRound = [];
    const byesRemaining = targetTotalByes - totalByesAssigned;
    const roundsRemaining = totalRounds - roundIndex;
    
    // Calculate how many byes to assign this round
    let byesThisRound;
    if (roundIndex === totalRounds - 1) {
      // Last round: assign exactly what's remaining
      byesThisRound = Math.min(byesRemaining, byesPerRound);
    } else {
      // Distribute remaining byes as evenly as possible
      byesThisRound = Math.min(byesPerRound, Math.ceil(byesRemaining / roundsRemaining));
    }
    
    console.log(`Round ${roundIndex + 1}: Planning ${byesThisRound} byes (${byesRemaining} remaining)`);
    
    // Select players who need byes, prioritizing those with fewer current byes
    const playersNeedingByes = shuffledPlayers
      .filter(player => playerByeCount[player.id] < playerTargetByes[player.id])
      .sort((a, b) => {
        // Prioritize players with fewer current byes
        const aDifference = playerByeCount[a.id];
        const bDifference = playerByeCount[b.id];
        if (aDifference !== bDifference) {
          return aDifference - bDifference;
        }
        // Secondary: prioritize players who need more total byes
        return playerTargetByes[b.id] - playerTargetByes[a.id];
      });
    
    // Assign byes
    for (let i = 0; i < Math.min(byesThisRound, playersNeedingByes.length); i++) {
      const player = playersNeedingByes[i];
      byePlayersThisRound.push(player);
      playerByeCount[player.id]++;
      totalByesAssigned++;
    }
    
    byeAssignments.push(byePlayersThisRound);
    console.log(`Round ${roundIndex + 1}: ${byePlayersThisRound.length} actual byes`);
  }
  
  // Validation
  console.log(`\n=== Bye Distribution Validation ===`);
  console.log(`Total byes assigned: ${totalByesAssigned}/${targetTotalByes}`);
  
  let playersWithCorrectByes = 0;
  shuffledPlayers.forEach(player => {
    const actualByes = playerByeCount[player.id];
    const targetByes = playerTargetByes[player.id];
    if (actualByes === targetByes) {
      playersWithCorrectByes++;
    } else {
      console.warn(`${player.name}: ${actualByes}/${targetByes} byes`);
    }
  });
  
  console.log(`Players with correct bye counts: ${playersWithCorrectByes}/${totalPlayers}`);
  
  return byeAssignments;
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