function generateAllRounds(players, settings) {
  const { courtsAvailable, minPlayersPerTeam, matchesPerPlayer, hasPowerMatch } = settings;
  const maxPlayersPerTeam = 6;
  
  console.log(`\n=== Tournament Generation Start ===`);
  console.log(`Players: ${players.length}, Courts: ${courtsAvailable}, Matches per player: ${matchesPerPlayer}`);
  
  // Calculate tournament structure
  const maxTeamsPerRound = courtsAvailable * 2;
  const maxPlayersPerRound = maxTeamsPerRound * maxPlayersPerTeam;
  const minPlayersPerRound = maxTeamsPerRound * minPlayersPerTeam;
  
  console.log(`Max teams per round: ${maxTeamsPerRound}, Max players per round: ${maxPlayersPerRound}`);
  
  // Determine if we need byes
  const needsByes = players.length > maxPlayersPerRound;
  const byeAssignments = needsByes ? 
    preAssignByes(players, matchesPerPlayer, courtsAvailable, minPlayersPerTeam, maxPlayersPerTeam) :
    createNoByeRounds(matchesPerPlayer);
  
  console.log(`\n=== Tournament Structure ===`);
  if (needsByes) {
    console.log(`Total byes assigned: ${byeAssignments.reduce((sum, round) => sum + round.length, 0)}`);
    byeAssignments.forEach((playersOnBye, roundIndex) => {
      console.log(`Round ${roundIndex + 1}: ${playersOnBye.length} players on bye`);
    });
  } else {
    console.log(`All players can play every round - no byes needed!`);
    console.log(`Tournament will have ${matchesPerPlayer} rounds with all ${players.length} players participating`);
  }
  
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

function createNoByeRounds(matchesPerPlayer) {
  // Create empty bye assignments for each round when no byes are needed
  const rounds = [];
  for (let i = 0; i < matchesPerPlayer; i++) {
    rounds.push([]); // Empty array = no players on bye
  }
  return rounds;
}

function preAssignByes(players, matchesPerPlayer, courtsAvailable, minPlayersPerTeam, maxPlayersPerTeam) {
  const totalPlayers = players.length;
  const maxTeamsPerRound = courtsAvailable * 2;
  const maxPlayersPerRound = maxTeamsPerRound * maxPlayersPerTeam;
  const minPlayersPerRound = maxTeamsPerRound * minPlayersPerTeam;
  
  console.log(`Pre-assigning byes for ${totalPlayers} players (max per round: ${maxPlayersPerRound})`);
  
  if (totalPlayers <= maxPlayersPerRound) {
    console.log('All players can play every round - no byes needed!');
    return createNoByeRounds(matchesPerPlayer);
  }
  
  // Calculate optimal tournament structure when byes are needed
  const optimalPlayersPerRound = Math.min(totalPlayers, maxPlayersPerRound);
  const playersOnByePerRound = totalPlayers - optimalPlayersPerRound;
  
  // Calculate total rounds needed
  const totalPlayerMatches = totalPlayers * matchesPerPlayer;
  const playerMatchesPerRound = optimalPlayersPerRound;
  const estimatedRounds = Math.ceil(totalPlayerMatches / playerMatchesPerRound);
  
  console.log(`Estimated rounds needed: ${estimatedRounds}`);
  console.log(`Players on bye per round: ${playersOnByePerRound}`);
  
  // Create bye assignments
  const byeAssignments = [];
  for (let i = 0; i < estimatedRounds; i++) {
    byeAssignments.push([]);
  }
  
  // Distribute bye assignments evenly
  const shuffledPlayers = shuffleArray([...players]);
  const totalByeSlotsNeeded = estimatedRounds * playersOnByePerRound;
  const byeRoundsPerPlayer = Math.floor(totalByeSlotsNeeded / totalPlayers);
  const extraByeSlots = totalByeSlotsNeeded % totalPlayers;
  
  console.log(`Bye rounds per player: ${byeRoundsPerPlayer} (with ${extraByeSlots} players getting 1 extra)`);
  
  // Assign byes to players
  const playerByeCount = {};
  shuffledPlayers.forEach(player => {
    playerByeCount[player.id] = 0;
  });
  
  // Distribute byes round by round
  for (let roundIndex = 0; roundIndex < estimatedRounds; roundIndex++) {
    // Sort players by current bye count, prioritizing those who need more byes
    const availablePlayers = shuffledPlayers.filter(player => {
      const maxByesForPlayer = byeRoundsPerPlayer + (shuffledPlayers.indexOf(player) < extraByeSlots ? 1 : 0);
      return playerByeCount[player.id] < maxByesForPlayer;
    }).sort((a, b) => playerByeCount[a.id] - playerByeCount[b.id]);
    
    // Assign the required number of players to bye for this round
    const playersForByeThisRound = availablePlayers.slice(0, playersOnByePerRound);
    playersForByeThisRound.forEach(player => {
      byeAssignments[roundIndex].push(player);
      playerByeCount[player.id]++;
    });
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
  
  // Calculate optimal team configuration
  const teamConfig = calculateOptimalTeamConfiguration(playingPlayers.length, maxTeams, minPlayersPerTeam, maxPlayersPerTeam);
  
  console.log(`  Using ${teamConfig.numTeams} teams with sizes: ${teamConfig.teamSizes.join(', ')}`);
  
  // Create teams with the calculated configuration
  const teams = createTeamsWithSizes(playingPlayers, teamConfig.teamSizes);
  
  // Balance teams for skill/gender distribution
  balanceTeams(teams);
  
  // Create matches
  const matches = createOptimalMatches(teams);
  
  return {
    roundNumber,
    teams,
    matches,
    byePlayers,
    totalPlayingPlayers: playingPlayers.length,
    totalByePlayers: byePlayers.length
  };
}

function calculateOptimalTeamConfiguration(availablePlayers, maxTeams, minTeamSize, maxTeamSize) {
  let bestConfig = null;
  let bestScore = -1;
  
  // Try different numbers of teams (must be even for matches)
  for (let numTeams = 2; numTeams <= maxTeams && numTeams <= Math.floor(availablePlayers / minTeamSize); numTeams += 2) {
    const config = calculateTeamSizes(availablePlayers, numTeams, minTeamSize, maxTeamSize);
    
    if (config) {
      // Score based on player utilization and balance
      const totalUsed = config.teamSizes.reduce((sum, size) => sum + size, 0);
      const utilizationScore = (totalUsed / availablePlayers) * 100;
      const sizeVariance = Math.max(...config.teamSizes) - Math.min(...config.teamSizes);
      const balanceScore = Math.max(0, 100 - (sizeVariance * 20));
      const score = utilizationScore + balanceScore;
      
      if (score > bestScore) {
        bestScore = score;
        bestConfig = { numTeams, teamSizes: config.teamSizes };
      }
    }
  }
  
  return bestConfig || { numTeams: 2, teamSizes: [Math.floor(availablePlayers / 2), Math.ceil(availablePlayers / 2)] };
}

function calculateTeamSizes(totalPlayers, numTeams, minSize, maxSize) {
  const baseSize = Math.floor(totalPlayers / numTeams);
  const remainder = totalPlayers % numTeams;
  
  // Check if configuration is valid
  if (baseSize < minSize || baseSize > maxSize) return null;
  if (baseSize === maxSize && remainder > 0) return null; // Can't add extra players
  
  // Create team sizes
  const teamSizes = [];
  for (let i = 0; i < numTeams; i++) {
    teamSizes.push(baseSize + (i < remainder ? 1 : 0));
  }
  
  // Verify all sizes are within bounds
  if (teamSizes.some(size => size < minSize || size > maxSize)) {
    return null;
  }
  
  return { teamSizes };
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

function createOptimalMatches(teams) {
  if (teams.length % 2 !== 0) {
    console.error(`Cannot create matches with odd number of teams: ${teams.length}`);
    return [];
  }
  
  const matches = [];
  let courtNumber = 1;
  
  // Group teams by size for optimal pairing
  const teamsBySize = {};
  teams.forEach(team => {
    const size = team.players.length;
    if (!teamsBySize[size]) {
      teamsBySize[size] = [];
    }
    teamsBySize[size].push(team);
  });
  
  console.log(`  Team sizes: ${Object.keys(teamsBySize).map(size => `${teamsBySize[size].length}x${size}`).join(', ')}`);
  
  const usedTeams = new Set();
  
  // First pass: Pair teams of equal sizes
  Object.keys(teamsBySize).forEach(size => {
    const teamsOfThisSize = teamsBySize[size].filter(team => !usedTeams.has(team));
    
    for (let i = 0; i < teamsOfThisSize.length - 1; i += 2) {
      matches.push({
        team1: teamsOfThisSize[i],
        team2: teamsOfThisSize[i + 1],
        court: courtNumber,
        isPowerMatch: false
      });
      
      usedTeams.add(teamsOfThisSize[i]);
      usedTeams.add(teamsOfThisSize[i + 1]);
      courtNumber++;
      
      console.log(`    Match ${matches.length}: ${size}v${size} on Court ${courtNumber - 1}`);
    }
  });
  
  // Second pass: Pair remaining teams (mixed sizes)
  const remainingTeams = teams.filter(team => !usedTeams.has(team));
  for (let i = 0; i < remainingTeams.length - 1; i += 2) {
    const size1 = remainingTeams[i].players.length;
    const size2 = remainingTeams[i + 1].players.length;
    
    matches.push({
      team1: remainingTeams[i],
      team2: remainingTeams[i + 1],
      court: courtNumber,
      isPowerMatch: false
    });
    
    courtNumber++;
    console.log(`    Match ${matches.length}: ${size1}v${size2} on Court ${courtNumber - 1}`);
  }
  
  return matches;
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
  
  const teamConfig = calculateOptimalTeamConfiguration(players.length, targetTeams, 5, 6);
  const teams = createTeamsWithSizes(players, teamConfig.teamSizes);
  balanceTeams(teams);
  const matches = createOptimalMatches(teams);
  
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