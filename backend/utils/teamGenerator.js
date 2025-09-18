function generateAllRounds(players, settings) {
  const { courtsAvailable, minPlayersPerTeam, matchesPerPlayer, hasPowerMatch } = settings;
  const maxPlayersPerTeam = 6;
  
  console.log(`\n=== Tournament Generation Start ===`);
  console.log(`Players: ${players.length}, Courts: ${courtsAvailable}, Min per team: ${minPlayersPerTeam}, Matches per player: ${matchesPerPlayer}`);
  
  // Early validation
  const absoluteMinimumPlayers = minPlayersPerTeam * 2;
  if (players.length < absoluteMinimumPlayers) {
    throw new Error(`Need at least ${absoluteMinimumPlayers} players for ${minPlayersPerTeam} minimum per team`);
  }
  
  // Calculate effective courts - never change minimum team size, only reduce courts
  let effectiveCourts = courtsAvailable;
  
  // Reduce courts until we can accommodate the players with minimum team sizes
  while (effectiveCourts > 0) {
    const maxTeams = effectiveCourts * 2;
    const playersNeeded = maxTeams * minPlayersPerTeam;
    
    if (players.length >= playersNeeded) {
      console.log(`Can use ${effectiveCourts} courts (${maxTeams} teams, need ${playersNeeded} players, have ${players.length})`);
      break;
    }
    
    effectiveCourts--;
    console.log(`Reducing to ${effectiveCourts} courts due to insufficient players`);
  }
  
  if (effectiveCourts === 0) {
    throw new Error(`Cannot create tournament: need at least ${minPlayersPerTeam * 2} players`);
  }
  
  // Check if we can fit all players with minimum team sizes
  const maxTeamsPerRound = effectiveCourts * 2;
  const maxPlayersPerRound = maxTeamsPerRound * maxPlayersPerTeam;
  const minPlayersPerRound = maxTeamsPerRound * minPlayersPerTeam;
  
  console.log(`Court analysis: ${effectiveCourts} courts = ${maxTeamsPerRound} teams = ${minPlayersPerRound}-${maxPlayersPerRound} players per round`);
  
  if (players.length >= minPlayersPerRound && players.length <= maxPlayersPerRound) {
    console.log(`Simple tournament structure: all players play every round`);
    
    const allRounds = [];
    
    // Generate each round with all players
    for (let roundNum = 1; roundNum <= matchesPerPlayer; roundNum++) {
      console.log(`\n=== Generating Round ${roundNum} ===`);
      console.log(`All ${players.length} players will play this round`);
      
      // Direct team generation - no complex calculation needed
      const roundData = createSimpleRound(players, effectiveCourts, minPlayersPerTeam, maxPlayersPerTeam, roundNum);
      
      if (!roundData || roundData.matches.length === 0) {
        console.error(`FAILED: Round ${roundNum} generated ${roundData ? roundData.matches.length : 0} matches`);
        throw new Error(`Failed to generate matches for round ${roundNum}`);
      }
      
      console.log(`SUCCESS: Round ${roundNum} has ${roundData.matches.length} matches, ${roundData.teams.length} teams`);
      allRounds.push(roundData);
    }
    
    console.log(`\n=== Tournament Generated Successfully ===`);
    console.log(`${allRounds.length} rounds, ${allRounds[0].matches.length} matches per round`);
    
    return allRounds;
  } else {
    // For larger tournaments, use the complex bye rotation system
    console.log(`Complex tournament structure needed - using bye rotation`);
    return generateComplexTournament(players, settings, effectiveCourts);
  }
}

// New function to create a simple round where everyone plays
function createSimpleRound(players, courtsAvailable, minPlayersPerTeam, maxPlayersPerTeam, roundNumber) {
  console.log(`--- Creating Simple Round ${roundNumber} ---`);
  console.log(`Players: ${players.length}, Courts: ${courtsAvailable}`);
  
  const maxTeams = courtsAvailable * 2;
  
  // Find the best team configuration
  let bestTeamCount = null;
  
  for (let teamCount = 2; teamCount <= maxTeams; teamCount += 2) {
    const avgTeamSize = players.length / teamCount;
    
    if (avgTeamSize >= minPlayersPerTeam && avgTeamSize <= maxPlayersPerTeam) {
      console.log(`Valid configuration: ${teamCount} teams, avg ${avgTeamSize.toFixed(1)} players per team`);
      bestTeamCount = teamCount;
      break; // Use the first valid configuration (smallest team count)
    }
  }
  
  if (!bestTeamCount) {
    console.error(`Cannot create valid teams with ${players.length} players`);
    return null;
  }
  
  // Calculate team sizes
  const baseTeamSize = Math.floor(players.length / bestTeamCount);
  const extraPlayers = players.length % bestTeamCount;
  
  const teamSizes = [];
  for (let i = 0; i < bestTeamCount; i++) {
    teamSizes.push(baseTeamSize + (i < extraPlayers ? 1 : 0));
  }
  
  console.log(`Team sizes: ${teamSizes.join(', ')}`);
  
  // Create teams
  const teams = [];
  let playerIndex = 0;
  
  for (let i = 0; i < teamSizes.length; i++) {
    const teamPlayers = players.slice(playerIndex, playerIndex + teamSizes[i]);
    teams.push({
      players: teamPlayers,
      targetSize: teamSizes[i]
    });
    playerIndex += teamSizes[i];
  }
  
  // Balance teams for better distribution
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
    
    console.log(`Match ${matches.length}: Team ${i + 1} (${teams[i].players.length}) vs Team ${i + 2} (${teams[i + 1].players.length}) - Court ${courtNumber}`);
  }
  
  return {
    roundNumber,
    teams,
    matches,
    byePlayers: [], // No bye players in simple rounds
    totalPlayingPlayers: players.length,
    totalByePlayers: 0
  };
}

// Advanced bye rotation algorithm that avoids consecutive byes
function generateAdvancedByeRotation(players, roundsNeeded, playersPerRound) {
  const totalPlayers = players.length;
  const byesPerRound = totalPlayers - playersPerRound;
  
  console.log(`\n=== Advanced Bye Rotation ===`);
  console.log(`Total players: ${totalPlayers}, Rounds: ${roundsNeeded}, Players per round: ${playersPerRound}, Byes per round: ${byesPerRound}`);
  
  const shuffledPlayers = shuffleArray([...players]);
  const byeAssignments = Array.from({ length: roundsNeeded }, () => []);
  const playerByeCount = {};
  const playerLastByeRound = {}; // Track when each player was last on bye
  
  // Initialize tracking
  shuffledPlayers.forEach(player => {
    playerByeCount[player.id] = 0;
    playerLastByeRound[player.id] = -2; // Initialize to -2 so round 0 isn't considered consecutive
  });
  
  // Calculate target byes per player
  const totalByeSlots = roundsNeeded * byesPerRound;
  const baseByesPerPlayer = Math.floor(totalByeSlots / totalPlayers);
  const extraByeSlots = totalByeSlots % totalPlayers;
  
  const playerTargetByes = {};
  shuffledPlayers.forEach((player, index) => {
    playerTargetByes[player.id] = baseByesPerPlayer + (index < extraByeSlots ? 1 : 0);
  });
  
  console.log(`Target byes per player: ${baseByesPerPlayer} base, ${extraByeSlots} players get +1`);
  
  // Assign byes round by round with consecutive avoidance
  for (let roundIndex = 0; roundIndex < roundsNeeded; roundIndex++) {
    console.log(`\n--- Assigning byes for Round ${roundIndex + 1} ---`);
    
    // Get players who still need byes
    const playersNeedingByes = shuffledPlayers.filter(player => 
      playerByeCount[player.id] < playerTargetByes[player.id]
    );
    
    console.log(`Players needing byes: ${playersNeedingByes.length}`);
    
    if (playersNeedingByes.length < byesPerRound) {
      // Not enough players need byes - fill with players who have fewest byes and longest gap
      const additionalPlayers = shuffledPlayers
        .filter(p => !playersNeedingByes.some(needed => needed.id === p.id))
        .sort((a, b) => {
          const aLastBye = playerLastByeRound[a.id];
          const bLastBye = playerLastByeRound[b.id];
          const aGap = roundIndex - aLastBye;
          const bGap = roundIndex - bLastBye;
          
          if (playerByeCount[a.id] !== playerByeCount[b.id]) {
            return playerByeCount[a.id] - playerByeCount[b.id]; // Fewer byes first
          }
          return bGap - aGap; // Longer gap first
        })
        .slice(0, byesPerRound - playersNeedingByes.length);
      
      playersNeedingByes.push(...additionalPlayers);
    }
    
    // Sort candidates by priority (avoid consecutive byes)
    const byeCandidates = playersNeedingByes.sort((a, b) => {
      const aLastBye = playerLastByeRound[a.id];
      const bLastBye = playerLastByeRound[b.id];
      const aIsConsecutive = (roundIndex - aLastBye) === 1;
      const bIsConsecutive = (roundIndex - bLastBye) === 1;
      
      // Primary: avoid consecutive byes
      if (aIsConsecutive !== bIsConsecutive) {
        return aIsConsecutive ? 1 : -1; // Non-consecutive first
      }
      
      // Secondary: prioritize players who need more byes
      const aNeed = playerTargetByes[a.id] - playerByeCount[a.id];
      const bNeed = playerTargetByes[b.id] - playerByeCount[b.id];
      if (aNeed !== bNeed) {
        return bNeed - aNeed; // Higher need first
      }
      
      // Tertiary: prefer players with longer gap since last bye
      const aGap = roundIndex - aLastBye;
      const bGap = roundIndex - bLastBye;
      return bGap - aGap; // Longer gap first
    });
    
    // Select the best candidates for this round
    const roundByePlayers = byeCandidates.slice(0, byesPerRound);
    
    // Update tracking
    roundByePlayers.forEach(player => {
      playerByeCount[player.id]++;
      playerLastByeRound[player.id] = roundIndex;
    });
    
    byeAssignments[roundIndex] = roundByePlayers;
    
    // Log the assignment with consecutive analysis
    const consecutiveInfo = roundByePlayers.map(player => {
      const lastBye = playerLastByeRound[player.id];
      const isConsecutive = roundIndex > 0 && (lastBye === roundIndex - 1);
      return `${player.name}${isConsecutive ? '(CONSEC)' : ''}`;
    });
    
    console.log(`Round ${roundIndex + 1} byes: ${consecutiveInfo.join(', ')}`);
  }
  
  // Final analysis
  console.log(`\n=== Bye Rotation Analysis ===`);
  let consecutiveByeCount = 0;
  let totalByeViolations = 0;
  
  shuffledPlayers.forEach(player => {
    const actualByes = playerByeCount[player.id];
    const targetByes = playerTargetByes[player.id];
    
    if (actualByes !== targetByes) {
      totalByeViolations++;
      console.log(`⚠️  ${player.name}: ${actualByes}/${targetByes} byes`);
    }
    
    // Check for consecutive byes
    let consecutiveByes = 0;
    for (let i = 0; i < roundsNeeded - 1; i++) {
      const inThisRound = byeAssignments[i].some(p => p.id === player.id);
      const inNextRound = byeAssignments[i + 1].some(p => p.id === player.id);
      
      if (inThisRound && inNextRound) {
        consecutiveByes++;
        consecutiveByeCount++;
        console.log(`⚠️  ${player.name}: consecutive byes in rounds ${i + 1}-${i + 2}`);
      }
    }
  });
  
  console.log(`Consecutive bye instances: ${consecutiveByeCount}`);
  console.log(`Players with wrong bye count: ${totalByeViolations}`);
  
  return byeAssignments;
}

// Complex tournament function with advanced bye rotation
function generateComplexTournament(players, settings, effectiveCourts) {
  console.log(`\n=== Complex Tournament Path ===`);
  console.log(`Players: ${players.length}, Effective courts: ${effectiveCourts}`);
  
  const { minPlayersPerTeam, matchesPerPlayer } = settings;
  const maxPlayersPerTeam = 6;
  
  const maxTeamsPerRound = effectiveCourts * 2;
  const maxPlayersPerRound = maxTeamsPerRound * maxPlayersPerTeam;
  const minPlayersPerRound = maxTeamsPerRound * minPlayersPerTeam;
  
  // Calculate optimal players per round
  let actualPlayersPerRound = Math.min(players.length, maxPlayersPerRound);
  
  // Ensure we can form valid teams
  while (actualPlayersPerRound >= minPlayersPerRound) {
    let canFormTeams = false;
    for (let teamCount = 2; teamCount <= maxTeamsPerRound; teamCount += 2) {
      const avgTeamSize = actualPlayersPerRound / teamCount;
      if (avgTeamSize >= minPlayersPerTeam && avgTeamSize <= maxPlayersPerTeam) {
        canFormTeams = true;
        break;
      }
    }
    
    if (canFormTeams) {
      break;
    }
    actualPlayersPerRound -= 2;
  }
  
  if (actualPlayersPerRound < minPlayersPerRound) {
    throw new Error(`Cannot create valid team configuration for complex tournament`);
  }
  
  console.log(`Using ${actualPlayersPerRound} players per round, ${players.length - actualPlayersPerRound} on bye per round`);
  
  // Generate advanced bye rotation
  const byeAssignments = generateAdvancedByeRotation(players, matchesPerPlayer, actualPlayersPerRound);
  
  // Create rounds using the bye assignments
  const allRounds = [];
  
  for (let roundNum = 1; roundNum <= matchesPerPlayer; roundNum++) {
    console.log(`\n=== Generating Complex Round ${roundNum} ===`);
    
    const byePlayers = byeAssignments[roundNum - 1];
    const playingPlayers = players.filter(p => 
      !byePlayers.some(bye => bye.id === p.id)
    );
    
    console.log(`Playing: ${playingPlayers.length}, Bye: ${byePlayers.length}`);
    
    // Generate the round
    const roundData = createSimpleRound(playingPlayers, effectiveCourts, minPlayersPerTeam, maxPlayersPerTeam, roundNum);
    
    if (!roundData || roundData.matches.length === 0) {
      console.error(`Failed to generate complex round ${roundNum}`);
      throw new Error(`Complex round generation failed for round ${roundNum}`);
    }
    
    // Add bye players to the round data
    roundData.byePlayers = byePlayers;
    roundData.totalByePlayers = byePlayers.length;
    
    console.log(`Complex round ${roundNum}: ${roundData.matches.length} matches, ${byePlayers.length} byes`);
    allRounds.push(roundData);
  }
  
  return allRounds;
}

// Updated bye rotation function with round reordering to put largest bye round last
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
  
  // Reorder rounds so the round with most byes comes last
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

function calculateOptimalTournamentStructure(totalPlayers, courtsAvailable, minPlayersPerTeam, maxPlayersPerTeam, matchesPerPlayer) {
  console.log(`\n=== Calculating Optimal Tournament Structure ===`);
  console.log(`Total players: ${totalPlayers}, Available courts: ${courtsAvailable}`);
  
  // Check if we have enough players for the absolute minimum requirements
  const absoluteMinimumPlayers = minPlayersPerTeam * 2; // Need at least 2 teams
  
  if (totalPlayers < absoluteMinimumPlayers) {
    console.error(`❌ FATAL: Not enough players for tournament!`);
    console.error(`   Need minimum: ${absoluteMinimumPlayers} players (2 teams × ${minPlayersPerTeam} players)`);
    console.error(`   Have: ${totalPlayers} players`);
    throw new Error(`Cannot create tournament with ${totalPlayers} players - need at least ${absoluteMinimumPlayers}`);
  }
  
  // Determine effective courts - NEVER change minimum team size, only reduce courts
  let effectiveCourts = courtsAvailable;
  
  // Calculate the maximum teams we can support with current constraints
  let maxPossibleTeams = effectiveCourts * 2;
  let minPlayersNeeded = maxPossibleTeams * minPlayersPerTeam;
  
  // Only reduce courts, never change minimum team size
  while (totalPlayers < minPlayersNeeded && effectiveCourts > 1) {
    effectiveCourts--;
    maxPossibleTeams = effectiveCourts * 2;
    minPlayersNeeded = maxPossibleTeams * minPlayersPerTeam;
    console.log(`Reduced to ${effectiveCourts} courts due to player constraints`);
  }
  
  // Final validation - if still not enough players even with 1 court, tournament is impossible
  if (totalPlayers < minPlayersNeeded) {
    console.error(`❌ FATAL: Cannot create valid teams even with 1 court!`);
    console.error(`   Need: ${minPlayersNeeded} players for ${maxPossibleTeams} teams of ${minPlayersPerTeam}+ each`);
    console.error(`   Have: ${totalPlayers} players`);
    throw new Error(`Cannot create tournament: ${totalPlayers} players insufficient for minimum team sizes`);
  }
  
  const maxTeamsPerRound = effectiveCourts * 2;
  const maxPlayersPerRound = maxTeamsPerRound * maxPlayersPerTeam;
  const minPlayersPerRound = maxTeamsPerRound * minPlayersPerTeam;
  
  console.log(`Final configuration:`);
  console.log(`- Courts: ${effectiveCourts} (reduced from ${courtsAvailable})`);
  console.log(`- Teams per round: ${maxTeamsPerRound}`);
  console.log(`- Players per round: ${minPlayersPerRound}-${maxPlayersPerRound}`);
  console.log(`- Min team size: ${minPlayersPerTeam} (unchanged)`);
  
  // For tournaments where everyone can play every round
  if (totalPlayers <= maxPlayersPerRound) {
    console.log(`All ${totalPlayers} players can play every round`);
    return {
      totalRounds: matchesPerPlayer,
      roundConfigs: Array(matchesPerPlayer).fill({ playersPerRound: totalPlayers }),
      effectiveCourts
    };
  }
  
  // For larger tournaments, use the existing logic
  const targetPlayerMatches = totalPlayers * matchesPerPlayer;
  console.log(`Target total player-matches: ${targetPlayerMatches}`);
  
  // Generate possible round configurations
  const possibleRoundConfigs = generatePossibleRoundConfigs(
    minPlayersPerRound, 
    maxPlayersPerRound, 
    maxTeamsPerRound, 
    minPlayersPerTeam, 
    maxPlayersPerTeam
  );
  
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
  console.log('Using fallback configuration');
  return {
    totalRounds: matchesPerPlayer,
    roundConfigs: Array(matchesPerPlayer).fill({ 
      playersPerRound: Math.min(totalPlayers, maxPlayersPerRound) 
    }),
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
      
      // Skip if this would create too many total byes
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

function canFormValidTeams(totalPlayers, numTeams, minTeamSize, maxTeamSize) {
  if (totalPlayers < minTeamSize * 2) return false; // Need at least 2 teams of minimum size
  if (numTeams % 2 !== 0) return false; // Need even number of teams for matches
  
  const avgTeamSize = totalPlayers / numTeams;
  if (avgTeamSize < minTeamSize || avgTeamSize > maxTeamSize) return false;
  
  const baseSize = Math.floor(avgTeamSize);
  const remainder = totalPlayers % numTeams;
  
  const smallTeamSize = baseSize;
  const largeTeamSize = baseSize + 1;
  
  // Maintain strict minimum team size requirement
  return (smallTeamSize >= minTeamSize && smallTeamSize <= maxTeamSize &&
          largeTeamSize >= minTeamSize && largeTeamSize <= maxTeamSize);
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