function generateAllRounds(players, settings) {
  const { courtsAvailable, minPlayersPerTeam, matchesPerPlayer, hasPowerMatch } = settings;
  const maxPlayersPerTeam = 6;
  
  console.log(`\n=== Tournament Generation Start ===`);
  console.log(`Players: ${players.length}, Courts: ${courtsAvailable}, Matches per player: ${matchesPerPlayer}`);
  
  // Calculate tournament structure based on player count
  const tournamentStructure = calculateOptimalTournamentStructure(players.length, courtsAvailable, minPlayersPerTeam, maxPlayersPerTeam, matchesPerPlayer);
  
  console.log(`\n=== Final Tournament Structure ===`);
  console.log(`Total rounds: ${tournamentStructure.totalRounds}`);
  console.log(`Round configurations: ${JSON.stringify(tournamentStructure.roundConfigs)}`);
  console.log(`Effective courts: ${tournamentStructure.effectiveCourts}`);
  
  // Generate bye assignments based on round configurations
  const byeAssignments = createFlexibleByeRotation(players, tournamentStructure);
  
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

function calculateOptimalTournamentStructure(totalPlayers, courtsAvailable, minPlayersPerTeam, maxPlayersPerTeam, matchesPerPlayer) {
  console.log(`\n=== Calculating Optimal Tournament Structure ===`);
  console.log(`Total players: ${totalPlayers}, Available courts: ${courtsAvailable}`);
  
  // Determine effective courts based on player count
  let effectiveCourts = courtsAvailable;
  let maxTeamsPerRound = courtsAvailable * 2;
  let maxPlayersPerRound = maxTeamsPerRound * maxPlayersPerTeam;
  let minPlayersPerRound = maxTeamsPerRound * minPlayersPerTeam;
  
  // Reduce courts if we don't have enough players
  while (totalPlayers < minPlayersPerRound && effectiveCourts > 1) {
    effectiveCourts--;
    maxTeamsPerRound = effectiveCourts * 2;
    maxPlayersPerRound = maxTeamsPerRound * maxPlayersPerTeam;
    minPlayersPerRound = maxTeamsPerRound * minPlayersPerTeam;
    console.log(`Reduced to ${effectiveCourts} courts due to player constraints`);
  }
  
  console.log(`Using ${effectiveCourts} courts (${maxTeamsPerRound} teams max, ${minPlayersPerRound}-${maxPlayersPerRound} players per round)`);
  
  // For smaller tournaments, everyone can play every round
  if (totalPlayers <= maxPlayersPerRound) {
    console.log(`All ${totalPlayers} players can play every round`);
    return {
      totalRounds: matchesPerPlayer,
      roundConfigs: Array(matchesPerPlayer).fill({ playersPerRound: totalPlayers }),
      effectiveCourts
    };
  }
  
  // For larger tournaments, find the minimum rounds with mixed configurations
  const targetPlayerMatches = totalPlayers * matchesPerPlayer;
  console.log(`Target total player-matches: ${targetPlayerMatches}`);
  
  // Generate possible round configurations
  const possibleRoundConfigs = generatePossibleRoundConfigs(minPlayersPerRound, maxPlayersPerRound, maxTeamsPerRound, minPlayersPerTeam, maxPlayersPerTeam);
  console.log(`Generated ${possibleRoundConfigs.length} possible round configurations`);
  
  // Try to find minimum rounds using mixed configurations
  for (let testRounds = matchesPerPlayer; testRounds <= matchesPerPlayer + 3; testRounds++) {
    console.log(`\n--- Testing ${testRounds} rounds ---`);
    
    const solution = findRoundCombination(possibleRoundConfigs, testRounds, targetPlayerMatches, totalPlayers);
    
    if (solution) {
      console.log(`✅ Found optimal ${testRounds}-round solution`);
      solution.roundConfigs.forEach((config, i) => {
        console.log(`  Round ${i + 1}: ${config.playersPerRound} players (${totalPlayers - config.playersPerRound} byes)`);
      });
      
      return {
        totalRounds: testRounds,
        roundConfigs: solution.roundConfigs,
        effectiveCourts
      };
    }
  }
  
  // Fallback
  console.log('No optimal solution found, using fallback');
  return {
    totalRounds: matchesPerPlayer + 1,
    roundConfigs: Array(matchesPerPlayer + 1).fill({ playersPerRound: Math.min(totalPlayers, maxPlayersPerRound) }),
    effectiveCourts
  };
}

function generatePossibleRoundConfigs(minPlayersPerRound, maxPlayersPerRound, maxTeamsPerRound, minPlayersPerTeam, maxPlayersPerTeam) {
  const configs = [];
  
  // Generate all possible team size combinations
  for (let playersPerRound = minPlayersPerRound; playersPerRound <= maxPlayersPerRound; playersPerRound++) {
    // Check if we can form valid teams with this player count
    for (let numTeams = 2; numTeams <= maxTeamsPerRound; numTeams += 2) {
      if (canFormValidTeams(playersPerRound, numTeams, minPlayersPerTeam, maxPlayersPerTeam)) {
        configs.push({
          playersPerRound,
          numTeams,
          teamSizes: calculateTeamSizeDistribution(playersPerRound, numTeams, minPlayersPerTeam, maxPlayersPerTeam)
        });
        break; // Use the first valid team configuration for this player count
      }
    }
  }
  
  console.log(`Valid round configurations: ${configs.map(c => `${c.playersPerRound}p(${c.teamSizes.join(',')})`).join(', ')}`);
  return configs;
}

function findRoundCombination(possibleConfigs, totalRounds, targetMatches, totalPlayers) {
  // Use dynamic programming to find combination of round configs that exactly hits target
  // This is essentially a "coin change" problem where we need to sum to targetMatches
  
  const memo = new Map();
  
  function solve(roundsLeft, matchesLeft) {
    if (roundsLeft === 0) {
      return matchesLeft === 0 ? [] : null;
    }
    if (matchesLeft <= 0) {
      return matchesLeft === 0 ? [] : null;
    }
    
    const key = `${roundsLeft}-${matchesLeft}`;
    if (memo.has(key)) {
      return memo.get(key);
    }
    
    // Try each possible round configuration
    for (const config of possibleConfigs) {
      const matchesThisRound = config.playersPerRound;
      const byesThisRound = totalPlayers - config.playersPerRound;
      
      // Skip if this would create too many total byes (more than total players)
      if (byesThisRound < 0) continue;
      
      const remaining = solve(roundsLeft - 1, matchesLeft - matchesThisRound);
      if (remaining !== null) {
        const result = [config, ...remaining];
        memo.set(key, result);
        return result;
      }
    }
    
    memo.set(key, null);
    return null;
  }
  
  const solution = solve(totalRounds, targetMatches);
  return solution ? { roundConfigs: solution } : null;
}

function calculateTeamSizeDistribution(totalPlayers, numTeams, minTeamSize, maxTeamSize) {
  const baseSize = Math.floor(totalPlayers / numTeams);
  const remainder = totalPlayers % numTeams;
  
  const teamSizes = [];
  for (let i = 0; i < numTeams; i++) {
    teamSizes.push(baseSize + (i < remainder ? 1 : 0));
  }
  
  return teamSizes;
}

function createFlexibleByeRotation(players, structure) {
  const { totalRounds, roundConfigs } = structure;
  const totalPlayers = players.length;
  
  console.log(`\n=== Creating Flexible Bye Rotation ===`);
  
  const byeAssignments = [];
  const shuffledPlayers = shuffleArray([...players]);
  const playerByeCount = {};
  
  // Initialize player bye counts
  shuffledPlayers.forEach(player => {
    playerByeCount[player.id] = 0;
  });
  
  // Calculate bye counts needed per round
  const byeCountsPerRound = roundConfigs.map(config => totalPlayers - config.playersPerRound);
  
  console.log(`Bye counts per round (before reordering): ${byeCountsPerRound.join(', ')}`);
  
  // MODIFICATION: Reorder rounds so the round with most byes comes last
  const roundIndices = Array.from({ length: totalRounds }, (_, i) => i);
  
  // Sort round indices by bye count (ascending), so rounds with fewer byes come first
  // This puts the round with the most byes at the end
  roundIndices.sort((a, b) => {
    const aByeCount = byeCountsPerRound[a];
    const bByeCount = byeCountsPerRound[b];
    if (aByeCount !== bByeCount) {
      return aByeCount - bByeCount; // Ascending order - fewer byes first
    }
    // If bye counts are equal, maintain original order
    return a - b;
  });
  
  // Reorder the round configurations to match our preferred order
  const reorderedRoundConfigs = roundIndices.map(i => roundConfigs[i]);
  const reorderedByeCounts = roundIndices.map(i => byeCountsPerRound[i]);
  
  console.log(`Round order after reordering: ${roundIndices.map(i => i + 1).join(', ')}`);
  console.log(`Bye counts per round (after reordering): ${reorderedByeCounts.join(', ')}`);
  
  // Calculate total byes needed and target distribution
  const totalByesNeeded = reorderedByeCounts.reduce((sum, count) => sum + count, 0);
  const baseByesPerPlayer = Math.floor(totalByesNeeded / totalPlayers);
  const extraByeSlots = totalByesNeeded % totalPlayers;
  
  console.log(`Total byes needed: ${totalByesNeeded}`);
  console.log(`Base byes per player: ${baseByesPerPlayer}, ${extraByeSlots} players get +1`);
  
  // Assign target bye counts
  const playerTargetByes = {};
  shuffledPlayers.forEach((player, index) => {
    playerTargetByes[player.id] = baseByesPerPlayer + (index < extraByeSlots ? 1 : 0);
  });
  
  // Assign byes round by round using our reordered configuration
  for (let roundIndex = 0; roundIndex < totalRounds; roundIndex++) {
    const byesThisRound = reorderedByeCounts[roundIndex];
    
    console.log(`Round ${roundIndex + 1}: Need ${byesThisRound} byes`);
    
    // Select players for bye, prioritizing those who need more byes
    const playersNeedingByes = shuffledPlayers
      .filter(player => playerByeCount[player.id] < playerTargetByes[player.id])
      .sort((a, b) => {
        const aNeed = playerTargetByes[a.id] - playerByeCount[a.id];
        const bNeed = playerTargetByes[b.id] - playerByeCount[b.id];
        if (aNeed !== bNeed) return bNeed - aNeed; // Higher need first
        return playerByeCount[a.id] - playerByeCount[b.id]; // Fewer current byes first
      });
    
    const byePlayersThisRound = playersNeedingByes.slice(0, byesThisRound);
    byePlayersThisRound.forEach(player => {
      playerByeCount[player.id]++;
    });
    
    byeAssignments.push(byePlayersThisRound);
    console.log(`Round ${roundIndex + 1}: ${byePlayersThisRound.length} actual byes assigned`);
  }
  
  // Validation
  console.log(`\n=== Bye Distribution Validation ===`);
  let correctPlayers = 0;
  shuffledPlayers.forEach(player => {
    const actual = playerByeCount[player.id];
    const target = playerTargetByes[player.id];
    if (actual === target) {
      correctPlayers++;
    } else {
      console.warn(`${player.name}: ${actual}/${target} byes`);
    }
  });
  
  console.log(`Players with correct bye counts: ${correctPlayers}/${totalPlayers}`);
  
  // Log final bye distribution for verification
  console.log(`Final bye distribution by round: ${byeAssignments.map(round => round.length).join(', ')}`);
  
  return byeAssignments;
}

function canFormValidTeams(totalPlayers, numTeams, minTeamSize, maxTeamSize) {
  if (totalPlayers < minTeamSize * 2) return false;
  if (numTeams % 2 !== 0) return false; // Need even number of teams for matches
  
  const avgTeamSize = totalPlayers / numTeams;
  if (avgTeamSize < minTeamSize || avgTeamSize > maxTeamSize) return false;
  
  const baseSize = Math.floor(avgTeamSize);
  const remainder = totalPlayers % numTeams;
  
  const smallTeamSize = baseSize;
  const largeTeamSize = baseSize + 1;
  
  return (smallTeamSize >= minTeamSize && smallTeamSize <= maxTeamSize &&
          largeTeamSize >= minTeamSize && largeTeamSize <= maxTeamSize);
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
  
  // Find optimal team configuration for this specific player count
  let bestConfig = null;
  for (let numTeams = 2; numTeams <= maxTeams; numTeams += 2) {
    if (canFormValidTeams(playingPlayers.length, numTeams, minPlayersPerTeam, maxPlayersPerTeam)) {
      const teamSizes = calculateTeamSizeDistribution(playingPlayers.length, numTeams, minPlayersPerTeam, maxPlayersPerTeam);
      bestConfig = { numTeams, teamSizes };
      break; // Use first valid configuration
    }
  }
  
  if (!bestConfig) {
    console.warn(`Cannot form valid teams with ${playingPlayers.length} players`);
    return {
      roundNumber,
      teams: [],
      matches: [],
      byePlayers: [...byePlayers, ...playingPlayers],
      totalPlayingPlayers: 0,
      totalByePlayers: byePlayers.length + playingPlayers.length
    };
  }
  
  console.log(`  Using ${bestConfig.numTeams} teams with sizes: ${bestConfig.teamSizes.join(', ')}`);
  
  // Create teams
  const teams = createTeamsWithSizes(playingPlayers, bestConfig.teamSizes);
  
  // Balance teams for skill/gender distribution
  balanceTeams(teams);
  
  // Create matches
  const matches = [];
  for (let i = 0; i < teams.length - 1; i += 2) {
    const courtNumber = Math.floor(i / 2) + 1;
    matches.push({
      team1: teams[i],
      team2: teams[i + 1],
      court: courtNumber,
      isPowerMatch: false
    });
    
    console.log(`    Match ${matches.length}: Team ${i + 1} (${teams[i].players.length}) vs Team ${i + 2} (${teams[i + 1].players.length}) on Court ${courtNumber}`);
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
      if (a.players.length !== b.players.length) {
        return a.players.length - b.players.length;
      }
      
      if (isSetter) {
        const aSetterDeficit = (a.stats.setterCount === 0) ? -10 : 0;
        const bSetterDeficit = (b.stats.setterCount === 0) ? -10 : 0;
        if (aSetterDeficit !== bSetterDeficit) {
          return aSetterDeficit - bSetterDeficit;
        }
      }
      
      const aGenderCount = gender === 'male' ? a.stats.maleCount : a.stats.femaleCount;
      const bGenderCount = gender === 'male' ? b.stats.maleCount : b.stats.femaleCount;
      if (aGenderCount !== bGenderCount) {
        return aGenderCount - bGenderCount;
      }
      
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
  
  const teamSizes = calculateTeamSizeDistribution(players.length, targetTeams, 5, 6);
  const teams = createTeamsWithSizes(players, teamSizes);
  balanceTeams(teams);
  
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