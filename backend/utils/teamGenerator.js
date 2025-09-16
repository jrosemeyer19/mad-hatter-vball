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
  
  // Create matches with intelligent team size pairing
  const matches = createOptimalMatches(teams);
  
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

function createOptimalMatches(teams) {
  if (teams.length % 2 !== 0) {
    console.error(`Cannot create matches with odd number of teams: ${teams.length}`);
    return [];
  }
  
  // Group teams by size
  const teamsBySize = {};
  teams.forEach(team => {
    const size = team.players.length;
    if (!teamsBySize[size]) {
      teamsBySize[size] = [];
    }
    teamsBySize[size].push(team);
  });
  
  console.log(`  Team sizes: ${Object.keys(teamsBySize).map(size => `${teamsBySize[size].length}x${size}`).join(', ')}`);
  
  const matches = [];
  const usedTeams = new Set();
  let courtNumber = 1;
  
  // First pass: Create matches between teams of equal sizes
  Object.keys(teamsBySize).forEach(size => {
    const teamsOfThisSize = teamsBySize[size].filter(team => !usedTeams.has(team));
    
    // Pair teams of the same size
    for (let i = 0; i < teamsOfThisSize.length - 1; i += 2) {
      if (!usedTeams.has(teamsOfThisSize[i]) && !usedTeams.has(teamsOfThisSize[i + 1])) {
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
    }
  });
  
  // Second pass: Pair remaining teams (will be mixed sizes)
  const remainingTeams = teams.filter(team => !usedTeams.has(team));
  
  for (let i = 0; i < remainingTeams.length - 1; i += 2) {
    matches.push({
      team1: remainingTeams[i],
      team2: remainingTeams[i + 1],
      court: courtNumber,
      isPowerMatch: false
    });
    
    courtNumber++;
    
    const size1 = remainingTeams[i].players.length;
    const size2 = remainingTeams[i + 1].players.length;
    console.log(`    Match ${matches.length}: ${size1}v${size2} on Court ${courtNumber - 1}`);
  }
  
  return matches;
}

function balanceTeams(teams) {
  const allPlayers = [];
  teams.forEach(team => allPlayers.push(...team.players));
  
  // Organize players by gender, skill level, and setter status for better distribution
  const playerGroups = {
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
  
  // Clear teams and initialize enhanced counters
  teams.forEach(team => {
    team.players = [];
    team.maleCount = 0;
    team.femaleCount = 0;
    team.setterCount = 0;
    // Add skill level counters
    team.skillA = 0;
    team.skillBB = 0;
    team.skillB = 0;
    // Add gender+skill counters for better balancing
    team.maleA = 0;
    team.maleBB = 0;
    team.maleB = 0;
    team.femaleA = 0;
    team.femaleBB = 0;
    team.femaleB = 0;
  });
  
  // Distribute players in priority order:
  // 1. Female setters (most important for balance)
  // 2. Male setters  
  // 3. High skill non-setters (A level)
  // 4. Medium skill non-setters (BB level)
  // 5. Lower skill non-setters (B level)
  
  const distributionOrder = [
    // Female setters first (highest priority)
    { players: playerGroups.femaleSettersA, gender: 'female', skill: 'A', setter: true },
    { players: playerGroups.femaleSettersBB, gender: 'female', skill: 'BB', setter: true },
    { players: playerGroups.femaleSettersB, gender: 'female', skill: 'B', setter: true },
    
    // Male setters second
    { players: playerGroups.maleSettersA, gender: 'male', skill: 'A', setter: true },
    { players: playerGroups.maleSettersBB, gender: 'male', skill: 'BB', setter: true },
    { players: playerGroups.maleSettersB, gender: 'male', skill: 'B', setter: true },
    
    // A-level non-setters (high skill distribution priority)
    { players: playerGroups.femaleNonSettersA, gender: 'female', skill: 'A', setter: false },
    { players: playerGroups.maleNonSettersA, gender: 'male', skill: 'A', setter: false },
    
    // BB-level non-setters
    { players: playerGroups.femaleNonSettersBB, gender: 'female', skill: 'BB', setter: false },
    { players: playerGroups.maleNonSettersBB, gender: 'male', skill: 'BB', setter: false },
    
    // B-level non-setters (lowest priority but still balanced)
    { players: playerGroups.femaleNonSettersB, gender: 'female', skill: 'B', setter: false },
    { players: playerGroups.maleNonSettersB, gender: 'male', skill: 'B', setter: false }
  ];
  
  // Distribute each group using enhanced balancing
  distributionOrder.forEach(group => {
    distributePlayersWithSkillBalance(teams, group.players, group.gender, group.skill, group.setter);
  });
}

function distributePlayersWithSkillBalance(teams, players, gender, skillLevel, isSetter) {
  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    
    // Sort teams by multiple balancing criteria
    const sortedTeams = [...teams].sort((a, b) => {
      // Priority 1: Team with fewer total players
      if (a.players.length !== b.players.length) {
        return a.players.length - b.players.length;
      }
      
      // Priority 2: Better setter balance (if this is a setter)
      if (isSetter && a.setterCount !== b.setterCount) {
        return a.setterCount - b.setterCount;
      }
      
      // Priority 3: Better skill level distribution for this specific skill
      const aSkillCount = getSkillCount(a, skillLevel);
      const bSkillCount = getSkillCount(b, skillLevel);
      if (aSkillCount !== bSkillCount) {
        return aSkillCount - bSkillCount;
      }
      
      // Priority 4: Better gender+skill combination balance
      const aGenderSkillCount = getGenderSkillCount(a, gender, skillLevel);
      const bGenderSkillCount = getGenderSkillCount(b, gender, skillLevel);
      if (aGenderSkillCount !== bGenderSkillCount) {
        return aGenderSkillCount - bGenderSkillCount;
      }
      
      // Priority 5: Better overall gender balance
      const aGenderCount = gender === 'male' ? (a.maleCount || 0) : (a.femaleCount || 0);
      const bGenderCount = gender === 'male' ? (b.maleCount || 0) : (b.femaleCount || 0);
      if (aGenderCount !== bGenderCount) {
        return aGenderCount - bGenderCount;
      }
      
      // Priority 6: Overall skill balance
      const aOverallSkill = (a.skillA || 0) * 3 + (a.skillBB || 0) * 2 + (a.skillB || 0) * 1;
      const bOverallSkill = (b.skillA || 0) * 3 + (b.skillBB || 0) * 2 + (b.skillB || 0) * 1;
      if (aOverallSkill !== bOverallSkill) {
        return aOverallSkill - bOverallSkill;
      }
      
      return 0;
    });
    
    const selectedTeam = sortedTeams[0];
    selectedTeam.players.push(player);
    
    // Update all counters
    if (gender === 'male') {
      selectedTeam.maleCount = (selectedTeam.maleCount || 0) + 1;
    } else {
      selectedTeam.femaleCount = (selectedTeam.femaleCount || 0) + 1;
    }
    
    if (isSetter) {
      selectedTeam.setterCount = (selectedTeam.setterCount || 0) + 1;
    }
    
    // Update skill level counters
    if (skillLevel === 'A') {
      selectedTeam.skillA = (selectedTeam.skillA || 0) + 1;
    } else if (skillLevel === 'BB') {
      selectedTeam.skillBB = (selectedTeam.skillBB || 0) + 1;
    } else if (skillLevel === 'B') {
      selectedTeam.skillB = (selectedTeam.skillB || 0) + 1;
    }
    
    // Update gender+skill counters
    if (gender === 'male') {
      if (skillLevel === 'A') {
        selectedTeam.maleA = (selectedTeam.maleA || 0) + 1;
      } else if (skillLevel === 'BB') {
        selectedTeam.maleBB = (selectedTeam.maleBB || 0) + 1;
      } else if (skillLevel === 'B') {
        selectedTeam.maleB = (selectedTeam.maleB || 0) + 1;
      }
    } else {
      if (skillLevel === 'A') {
        selectedTeam.femaleA = (selectedTeam.femaleA || 0) + 1;
      } else if (skillLevel === 'BB') {
        selectedTeam.femaleBB = (selectedTeam.femaleBB || 0) + 1;
      } else if (skillLevel === 'B') {
        selectedTeam.femaleB = (selectedTeam.femaleB || 0) + 1;
      }
    }
  }
}

function getSkillCount(team, skillLevel) {
  switch (skillLevel) {
    case 'A': return team.skillA || 0;
    case 'BB': return team.skillBB || 0;
    case 'B': return team.skillB || 0;
    default: return 0;
  }
}

function getGenderSkillCount(team, gender, skillLevel) {
  if (gender === 'male') {
    switch (skillLevel) {
      case 'A': return team.maleA || 0;
      case 'BB': return team.maleBB || 0;
      case 'B': return team.maleB || 0;
      default: return 0;
    }
  } else {
    switch (skillLevel) {
      case 'A': return team.femaleA || 0;
      case 'BB': return team.femaleBB || 0;
      case 'B': return team.femaleB || 0;
      default: return 0;
    }
  }
}

// Legacy function kept for compatibility in generateTeamsForRound
function distributePlayersEvenly(teams, players, gender, isSetter) {
  // Use the enhanced skill-based distribution for better balance
  if (players.length > 0) {
    const skillLevel = players[0].skill_level || 'B'; // Default to B if not specified
    distributePlayersWithSkillBalance(teams, players, gender, skillLevel, isSetter);
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
  
  // Use the new optimal match creation here too
  const matches = createOptimalMatches(validTeams);
  
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