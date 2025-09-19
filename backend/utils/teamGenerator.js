/**
 * Mad Hatter Volleyball Tournament Generator
 * Complete implementation handling 10-60+ players with flexible court usage
 */

function generateAllRounds(players, settings) {
  console.log('\n=== Mad Hatter Tournament Generator (Flexible) ===');
  console.log(`Players: ${players.length}`);
  console.log(`Courts Available: ${settings.courtsAvailable}`);
  console.log(`Min Players Per Team: ${settings.minPlayersPerTeam}`);
  console.log(`Matches Per Player: ${settings.matchesPerPlayer}`);
  
  // Step 1: Validate inputs
  validateInputs(players, settings);
  
  // Step 2: Calculate flexible tournament structure
  const structure = calculateOptimalStructure(players.length, settings);
  
  // Step 3: Generate flexible bye schedule
  const byeSchedule = generateFlexibleByeSchedule(players, structure.flexibleRounds);
  
  // Step 4: Generate all rounds with varying player counts
  const allRounds = [];
  
  structure.flexibleRounds.forEach((roundConfig, roundIndex) => {
    const roundNum = roundIndex + 1;
    console.log(`\n--- Generating Round ${roundNum} ---`);
    
    // Get bye players for this round
    const byePlayers = byeSchedule[roundIndex];
    
    // Get playing players (everyone except those on bye)
    const playingPlayers = players.filter(player => 
      !byePlayers.some(byePlayer => byePlayer.id === player.id)
    );
    
    console.log(`Expected playing: ${roundConfig.playersPlaying}, Actual playing: ${playingPlayers.length}`);
    console.log(`Expected byes: ${roundConfig.playersBye}, Actual byes: ${byePlayers.length}`);
    
    // Validate counts match expectations
    if (playingPlayers.length !== roundConfig.playersPlaying) {
      console.error(`❌ Round ${roundNum} player count mismatch!`);
    }
    
    // Generate round with dynamic structure
    const round = generateFlexibleRound(playingPlayers, byePlayers, structure.courtsUsed, settings.minPlayersPerTeam, roundNum);
    allRounds.push(round);
  });
  
  // Step 5: Validate final tournament
  validateFlexibleTournament(players, allRounds, settings.matchesPerPlayer);
  
  console.log('\n=== Flexible Tournament Generation Complete ===');
  return allRounds;
}

function generateFlexibleRound(playingPlayers, byePlayers, courtsUsed, minPlayersPerTeam, roundNumber) {
  const maxPlayersPerTeam = 6;
  const maxTeams = courtsUsed * 2;
  
  console.log(`\n=== Creating Flexible Round ${roundNumber} ===`);
  console.log(`Playing players: ${playingPlayers.length}, Courts available: ${courtsUsed}`);
  
  if (playingPlayers.length === 0) {
    // Handle edge case where everyone is on bye
    return {
      roundNumber,
      teams: byePlayers.length > 0 ? [{
        id: `bye_round_${roundNumber}`,
        team_number: 1,
        court: null,
        is_bye_team: true,
        players: byePlayers
      }] : [],
      matches: [],
      byePlayers,
      totalPlayingPlayers: 0,
      totalByePlayers: byePlayers.length
    };
  }
  
  // Find best team configuration
  let teamConfig = null;
  
  for (let teamCount = 2; teamCount <= maxTeams; teamCount += 2) {
    const avgTeamSize = playingPlayers.length / teamCount;
    
    if (avgTeamSize >= minPlayersPerTeam && avgTeamSize <= maxPlayersPerTeam) {
      // Check if this distribution actually works
      const baseSize = Math.floor(avgTeamSize);
      const remainder = playingPlayers.length % teamCount;
      
      const teamSizes = [];
      for (let i = 0; i < teamCount; i++) {
        teamSizes.push(baseSize + (i < remainder ? 1 : 0));
      }
      
      // Verify all team sizes are valid
      if (teamSizes.every(size => size >= minPlayersPerTeam && size <= maxPlayersPerTeam)) {
        teamConfig = { teamCount, teamSizes };
        console.log(`Using ${teamCount} teams: ${teamSizes.join(', ')} players`);
        break;
      }
    }
  }
  
  if (!teamConfig) {
    console.error(`❌ Cannot create teams for ${playingPlayers.length} players`);
    throw new Error(`Cannot create teams for ${playingPlayers.length} players`);
  }
  
  // Create teams with balanced distribution
  const teams = createBalancedTeams(playingPlayers, teamConfig, roundNumber);
  
  // Create matches
  const matches = createSimpleMatches(teams);
  
  // Add bye team if needed
  if (byePlayers.length > 0) {
    teams.push({
      id: `bye_round_${roundNumber}`,
      team_number: teams.length + 1,
      court: null,
      is_bye_team: true,
      players: byePlayers
    });
  }
  
  console.log(`Flexible round ${roundNumber} created: ${teams.filter(t => !t.is_bye_team).length} playing teams, ${matches.length} matches`);
  
  return {
    roundNumber,
    teams,
    matches,
    byePlayers,
    totalPlayingPlayers: playingPlayers.length,
    totalByePlayers: byePlayers.length
  };
}

function validateFlexibleTournament(players, allRounds, expectedMatches) {
  console.log('\n=== Flexible Tournament Validation ===');
  
  const playerMatchCount = {};
  players.forEach(p => playerMatchCount[p.id] = 0);
  
  // Count matches for each player
  allRounds.forEach(round => {
    round.matches.forEach(match => {
      match.team1.players.forEach(player => {
        playerMatchCount[player.id]++;
      });
      match.team2.players.forEach(player => {
        playerMatchCount[player.id]++;
      });
    });
  });
  
  // Validate counts
  let correctCount = 0;
  const errors = [];
  
  players.forEach(player => {
    const actual = playerMatchCount[player.id];
    if (actual === expectedMatches) {
      correctCount++;
    } else {
      errors.push(`${player.name}: ${actual}/${expectedMatches} matches`);
    }
  });
  
  console.log(`Match count validation: ${correctCount}/${players.length} correct`);
  
  if (errors.length > 0) {
    console.error('Match count errors:');
    errors.forEach(error => console.error(`  ${error}`));
    throw new Error(`${errors.length} players have incorrect match counts`);
  }
  
  console.log('✅ All players have correct match counts');
}

function validateInputs(players, settings) {
  const minTotalPlayers = settings.minPlayersPerTeam * 2;
  
  if (players.length < minTotalPlayers) {
    throw new Error(`Need at least ${minTotalPlayers} players for minimum team size of ${settings.minPlayersPerTeam}`);
  }
  
  if (settings.courtsAvailable < 1) {
    throw new Error('Must have at least 1 court available');
  }
  
  if (settings.matchesPerPlayer < 1) {
    throw new Error('Players must play at least 1 match');
  }
}

function calculateOptimalStructure(totalPlayers, settings) {
  console.log(`\n--- Flexible Structure Calculation ---`);
  console.log(`Total players: ${totalPlayers}`);
  console.log(`Available courts: ${settings.courtsAvailable}`);
  console.log(`Matches per player: ${settings.matchesPerPlayer}`);
  console.log(`Min per team: ${settings.minPlayersPerTeam}`);
  
  // Calculate total player-matches needed
  const totalPlayerMatches = totalPlayers * settings.matchesPerPlayer;
  console.log(`Total player-matches needed: ${totalPlayerMatches}`);
  
  // Determine court usage (reduce if not enough players)
  let courtsToUse = settings.courtsAvailable;
  const maxPlayersPerTeam = 6;
  
  while (courtsToUse >= 1) {
    const maxTeamsPerRound = courtsToUse * 2;
    const minPlayersNeeded = maxTeamsPerRound * settings.minPlayersPerTeam;
    
    if (totalPlayers >= minPlayersNeeded) {
      console.log(`Can use ${courtsToUse} courts (need ${minPlayersNeeded}+ players)`);
      break;
    }
    courtsToUse--;
  }
  
  if (courtsToUse < 1) {
    throw new Error(`Need at least ${settings.minPlayersPerTeam * 2} players for minimum court usage`);
  }
  
  // Helper function to find valid player count for team formation
  const canFormValidTeams = (totalPlayers, maxTeams, minPerTeam, maxPerTeam) => {
    // Try different team counts (must be even for matches)
    for (let teamCount = 2; teamCount <= maxTeams; teamCount += 2) {
      const avgTeamSize = totalPlayers / teamCount;
      
      if (avgTeamSize >= minPerTeam && avgTeamSize <= maxPerTeam) {
        // Check if distribution works
        const baseSize = Math.floor(avgTeamSize);
        const remainder = totalPlayers % teamCount;
        
        const smallTeams = teamCount - remainder;
        const largeTeams = remainder;
        
        const smallTeamSize = baseSize;
        const largeTeamSize = baseSize + 1;
        
        if (smallTeamSize >= minPerTeam && largeTeamSize <= maxPerTeam) {
          return true;
        }
      }
    }
    return false;
  };
  
  const findValidPlayerCount = (targetPlayers, maxTeams, minPerTeam, maxPerTeam) => {
    // Try the target first, then work downward
    for (let players = targetPlayers; players >= minPerTeam * 2; players--) {
      if (canFormValidTeams(players, maxTeams, minPerTeam, maxPerTeam)) {
        return players;
      }
    }
    // If we can't find a valid count, return the minimum possible
    return minPerTeam * 2;
  };
  
  // Calculate maximum players that can play per round
  const maxTeamsPerRound = courtsToUse * 2;
  const maxPlayersPerRound = maxTeamsPerRound * maxPlayersPerTeam;
  const minPlayersPerRound = maxTeamsPerRound * settings.minPlayersPerTeam;
  
  // Use a greedy algorithm to distribute player-matches across rounds
  const rounds = [];
  let remainingPlayerMatches = totalPlayerMatches;
  let roundNumber = 1;
  
  while (remainingPlayerMatches > 0) {
    // Calculate how many players we want in this round
    let idealPlayersThisRound;
    
    if (rounds.length === 0) {
      // For the first round, try to use as many players as possible
      idealPlayersThisRound = Math.min(totalPlayers, maxPlayersPerRound);
    } else {
      // For subsequent rounds, calculate based on remaining needs
      const roundsRemaining = Math.max(1, Math.ceil(remainingPlayerMatches / maxPlayersPerRound));
      idealPlayersThisRound = Math.ceil(remainingPlayerMatches / roundsRemaining);
    }
    
    // Constrain to valid range
    let playersThisRound = Math.max(
      minPlayersPerRound,
      Math.min(idealPlayersThisRound, maxPlayersPerRound)
    );
    
    // Ensure we can form valid teams
    playersThisRound = findValidPlayerCount(
      playersThisRound, 
      maxTeamsPerRound, 
      settings.minPlayersPerTeam, 
      maxPlayersPerTeam
    );
    
    // Don't exceed total players
    playersThisRound = Math.min(playersThisRound, totalPlayers);
    
    const byesThisRound = totalPlayers - playersThisRound;
    
    rounds.push({
      roundNumber: roundNumber,
      playersPlaying: playersThisRound,
      playersBye: byesThisRound
    });
    
    remainingPlayerMatches -= playersThisRound;
    roundNumber++;
    
    console.log(`Round ${rounds.length}: ${playersThisRound} playing, ${byesThisRound} bye (${remainingPlayerMatches} matches remaining)`);
    
    // Safety check to prevent infinite loops
    if (rounds.length > 20) {
      throw new Error('Too many rounds generated - check tournament parameters');
    }
  }
  
  // Validate the math works out
  const totalPlayerMatchesGenerated = rounds.reduce((sum, round) => sum + round.playersPlaying, 0);
  if (totalPlayerMatchesGenerated !== totalPlayerMatches) {
    console.error(`❌ Math error: Generated ${totalPlayerMatchesGenerated} player-matches, need ${totalPlayerMatches}`);
    throw new Error('Cannot create mathematically valid tournament structure');
  }
  
  // Ensure everyone gets at least one bye (if byes are needed)
  const totalByeSlots = rounds.reduce((sum, round) => sum + round.playersBye, 0);
  if (totalByeSlots > 0 && totalByeSlots < totalPlayers) {
    console.warn(`⚠️  Not everyone can get a bye - only ${totalByeSlots} bye slots for ${totalPlayers} players`);
  }
  
  console.log(`✅ Flexible structure created: ${rounds.length} rounds, ${courtsToUse} courts`);
  console.log(`Total bye slots: ${totalByeSlots}, Average byes per player: ${(totalByeSlots / totalPlayers).toFixed(1)}`);
  
  return {
    courtsUsed: courtsToUse,
    flexibleRounds: rounds
  };
}

function generateFlexibleByeSchedule(players, flexibleRounds) {
  console.log(`\n=== Flexible Bye Schedule ===`);
  
  const shuffledPlayers = shuffleArray([...players]);
  const schedule = [];
  const playerByeCount = {};
  const playerLastByeRound = {};
  
  // Initialize tracking
  shuffledPlayers.forEach(player => {
    playerByeCount[player.id] = 0;
    playerLastByeRound[player.id] = -2;
  });
  
  // Calculate target byes per player
  const totalByeSlots = flexibleRounds.reduce((sum, round) => sum + round.playersBye, 0);
  const baseByesPerPlayer = Math.floor(totalByeSlots / players.length);
  const extraByeSlots = totalByeSlots % players.length;
  
  const playerTargetByes = {};
  shuffledPlayers.forEach((player, index) => {
    const minimumByes = totalByeSlots > 0 ? 1 : 0; // Everyone gets at least 1 bye if byes exist
    const calculatedTarget = baseByesPerPlayer + (index < extraByeSlots ? 1 : 0);
    playerTargetByes[player.id] = Math.max(minimumByes, calculatedTarget);
  });
  
  console.log(`Total bye slots: ${totalByeSlots}`);
  console.log(`Target: ${baseByesPerPlayer} base byes per player, ${extraByeSlots} players get +1 bye`);
  
  // Assign byes for each round based on its specific bye count
  flexibleRounds.forEach((roundConfig, roundIndex) => {
    const byesNeeded = roundConfig.playersBye;
    console.log(`\n--- Round ${roundIndex + 1}: ${byesNeeded} byes needed ---`);
    
    if (byesNeeded === 0) {
      schedule.push([]);
      console.log(`Round ${roundIndex + 1}: No byes needed`);
      return;
    }
    
    // Select bye candidates with all our priority rules
    const candidates = selectFlexibleByeCandidates(
      shuffledPlayers,
      roundIndex,
      byesNeeded,
      playerByeCount,
      playerTargetByes,
      playerLastByeRound
    );
    
    // Update tracking
    candidates.forEach(player => {
      playerByeCount[player.id]++;
      playerLastByeRound[player.id] = roundIndex;
    });
    
    schedule.push(candidates);
    console.log(`Round ${roundIndex + 1} byes: ${candidates.map(p => p.name).join(', ')}`);
  });
  
  // Validate bye assignments
  validateFlexibleByeSchedule(players, schedule, playerTargetByes, flexibleRounds);
  
  return schedule;
}

function selectFlexibleByeCandidates(players, roundIndex, byesNeeded, playerByeCount, playerTargetByes, playerLastByeRound) {
  // Use the same smart selection logic but adapted for flexible rounds
  let candidates = [...players];
  
  candidates.sort((a, b) => {
    // Priority 1: Players who haven't had any byes yet (when byes are required)
    const aByeCount = playerByeCount[a.id];
    const bByeCount = playerByeCount[b.id];
    const aNeedsBye = aByeCount < playerTargetByes[a.id];
    const bNeedsBye = bByeCount < playerTargetByes[b.id];
    
    if (aNeedsBye !== bNeedsBye) {
      return aNeedsBye ? -1 : 1; // Players needing byes first
    }
    
    // Priority 2: Avoid consecutive byes
    const aLastBye = playerLastByeRound[a.id];
    const bLastBye = playerLastByeRound[b.id];
    const aIsConsecutive = (roundIndex - aLastBye) === 1;
    const bIsConsecutive = (roundIndex - bLastBye) === 1;
    
    if (aIsConsecutive !== bIsConsecutive) {
      return aIsConsecutive ? 1 : -1; // Non-consecutive first
    }
    
    // Priority 3: Minimize female setters on bye
    const aIsFemaleSet = a.gender === 'female' && a.is_setter;
    const bIsFemaleSet = b.gender === 'female' && b.is_setter;
    
    if (aIsFemaleSet !== bIsFemaleSet) {
      return aIsFemaleSet ? 1 : -1; // Non-female-setters first
    }
    
    // Priority 4: Players with fewer byes
    if (aByeCount !== bByeCount) {
      return aByeCount - bByeCount; // Fewer byes first
    }
    
    // Priority 5: Longer gap since last bye
    const aGap = roundIndex - aLastBye;
    const bGap = roundIndex - bLastBye;
    return bGap - aGap; // Longer gap first
  });
  
  return candidates.slice(0, byesNeeded);
}

function validateFlexibleByeSchedule(players, schedule, playerTargetByes, flexibleRounds) {
  console.log('\n=== Flexible Bye Schedule Validation ===');
  
  const playerByeCount = {};
  players.forEach(p => playerByeCount[p.id] = 0);
  
  // Count actual byes
  schedule.forEach((roundByes) => {
    roundByes.forEach(player => {
      playerByeCount[player.id]++;
    });
  });
  
  let correctByeCount = 0;
  let playersWithNoByes = 0;
  const totalByeSlots = flexibleRounds.reduce((sum, round) => sum + round.playersBye, 0);
  
  players.forEach(player => {
    const actual = playerByeCount[player.id];
    const target = playerTargetByes[player.id];
    
    if (actual === target) {
      correctByeCount++;
    }
    
    if (actual === 0 && totalByeSlots > 0) {
      playersWithNoByes++;
      console.warn(`  ${player.name}: NO BYES (requirement violation)`);
    }
  });
  
  console.log(`Players with correct bye count: ${correctByeCount}/${players.length}`);
  
  if (totalByeSlots > 0) {
    console.log(`Players with at least one bye: ${players.length - playersWithNoByes}/${players.length}`);
    if (playersWithNoByes === 0) {
      console.log('✅ All players have at least one bye');
    } else {
      console.log(`❌ ${playersWithNoByes} players have no byes`);
    }
  }
}

function canFormTeams(totalPlayers, maxTeams, minPerTeam, maxPerTeam) {
  // Try different team counts (must be even for matches)
  for (let teamCount = 2; teamCount <= maxTeams; teamCount += 2) {
    const avgTeamSize = totalPlayers / teamCount;
    
    if (avgTeamSize >= minPerTeam && avgTeamSize <= maxPerTeam) {
      // Check if distribution works
      const baseSize = Math.floor(avgTeamSize);
      const remainder = totalPlayers % teamCount;
      
      const smallTeams = teamCount - remainder;
      const largeTeams = remainder;
      
      const smallTeamSize = baseSize;
      const largeTeamSize = baseSize + 1;
      
      if (smallTeamSize >= minPerTeam && largeTeamSize <= maxPerTeam) {
        return true;
      }
    }
  }
  
  return false;
}

function generateSimpleByeSchedule(players, totalRounds, byesPerRound) {
  if (byesPerRound === 0) {
    return Array(totalRounds).fill([]);
  }
  
  console.log(`\n=== Advanced Bye Schedule (${byesPerRound} per round) ===`);
  
  const shuffledPlayers = shuffleArray([...players]);
  const schedule = Array(totalRounds).fill(null).map(() => []);
  const playerByeCount = {};
  const playerLastByeRound = {};
  
  // Initialize tracking
  shuffledPlayers.forEach(player => {
    playerByeCount[player.id] = 0;
    playerLastByeRound[player.id] = -2; // -2 ensures round 0 isn't considered consecutive
  });
  
  // Calculate target byes per player for fair distribution
  const totalByeSlots = totalRounds * byesPerRound;
  const baseByesPerPlayer = Math.floor(totalByeSlots / players.length);
  const extraByeSlots = totalByeSlots % players.length;
  
  const playerTargetByes = {};
  shuffledPlayers.forEach((player, index) => {
    // Ensure everyone gets at least one bye when byes are required
    const minimumByes = 1; // Everyone must have at least 1 bye
    const calculatedTarget = baseByesPerPlayer + (index < extraByeSlots ? 1 : 0);
    playerTargetByes[player.id] = Math.max(minimumByes, calculatedTarget);
  });
  
  console.log(`Target distribution: ${baseByesPerPlayer} base byes per player, ${extraByeSlots} players get +1 bye`);
  console.log(`Minimum bye requirement: Everyone gets at least 1 bye`);
  
  // Phase 1: Ensure everyone gets at least one bye first
  const playersWithoutByes = new Set(shuffledPlayers.map(p => p.id));
  let currentRound = 0;
  
  console.log('\n--- Phase 1: Ensuring everyone gets at least one bye ---');
  
  while (playersWithoutByes.size > 0 && currentRound < totalRounds - 1) {
    const roundIndex = currentRound;
    console.log(`\n--- Assigning Round ${roundIndex + 1} byes (ensuring minimum) ---`);
    
    // Prioritize players who haven't had any byes yet
    const candidates = selectByeCandidatesWithMinimumByeRequirement(
      shuffledPlayers,
      roundIndex,
      byesPerRound,
      playerByeCount,
      playerTargetByes,
      playerLastByeRound,
      playersWithoutByes
    );
    
    // Update tracking
    candidates.forEach(player => {
      playerByeCount[player.id]++;
      playerLastByeRound[player.id] = roundIndex;
      playersWithoutByes.delete(player.id); // Remove from "needs first bye" set
    });
    
    schedule[roundIndex] = candidates;
    console.log(`Round ${roundIndex + 1} byes: ${candidates.map(p => p.name).join(', ')}`);
    console.log(`Players still needing first bye: ${playersWithoutByes.size}`);
    
    currentRound++;
  }
  
  // Phase 2: Handle remaining rounds with normal distribution
  console.log('\n--- Phase 2: Completing remaining rounds ---');
  
  for (let roundIndex = currentRound; roundIndex < totalRounds - 1; roundIndex++) {
    console.log(`\n--- Assigning Round ${roundIndex + 1} byes ---`);
    
    const candidates = selectByeCandidatesWithConsecutiveAvoidance(
      shuffledPlayers,
      roundIndex,
      byesPerRound,
      playerByeCount,
      playerTargetByes,
      playerLastByeRound
    );
    
    candidates.forEach(player => {
      playerByeCount[player.id]++;
      playerLastByeRound[player.id] = roundIndex;
    });
    
    schedule[roundIndex] = candidates;
    console.log(`Round ${roundIndex + 1} byes: ${candidates.map(p => p.name).join(', ')}`);
  }
  
  // Phase 3: Handle final round (largest bye round)
  const finalRoundIndex = totalRounds - 1;
  console.log(`\n--- Assigning Final Round ${totalRounds} byes (largest bye round) ---`);
  
  // Find players who still need byes to reach their target
  const playersNeedingFinalByes = shuffledPlayers.filter(player => 
    playerByeCount[player.id] < playerTargetByes[player.id]
  );
  
  // Ensure any players who still haven't had a bye get one (safety check)
  const playersStillWithoutByes = shuffledPlayers.filter(player => 
    playerByeCount[player.id] === 0
  );
  
  // Combine players who need byes, prioritizing those without any byes
  let finalRoundCandidates = [...playersStillWithoutByes, ...playersNeedingFinalByes.filter(
    p => !playersStillWithoutByes.some(without => without.id === p.id)
  )];
  
  // Ensure this is the largest bye round
  const maxPreviousRoundByes = Math.max(...schedule.slice(0, -1).map(round => round.length));
  const minFinalRoundByes = Math.max(byesPerRound, maxPreviousRoundByes + 1, finalRoundCandidates.length);
  
  // Add more players if needed to make this the largest round
  if (finalRoundCandidates.length < minFinalRoundByes) {
    const additionalPlayers = shuffledPlayers
      .filter(p => !finalRoundCandidates.some(candidate => candidate.id === p.id))
      .sort((a, b) => {
        // Avoid consecutive byes if possible
        const aIsConsecutive = (finalRoundIndex - playerLastByeRound[a.id]) === 1;
        const bIsConsecutive = (finalRoundIndex - playerLastByeRound[b.id]) === 1;
        
        if (aIsConsecutive !== bIsConsecutive) {
          return aIsConsecutive ? 1 : -1;
        }
        
        // Prefer players with fewer total byes
        return playerByeCount[a.id] - playerByeCount[b.id];
      })
      .slice(0, minFinalRoundByes - finalRoundCandidates.length);
    
    finalRoundCandidates.push(...additionalPlayers);
  }
  
  // Update tracking for final round
  finalRoundCandidates.forEach(player => {
    playerByeCount[player.id]++;
    playerLastByeRound[player.id] = finalRoundIndex;
  });
  
  schedule[finalRoundIndex] = finalRoundCandidates;
  
  console.log(`Final round ${totalRounds} byes: ${finalRoundCandidates.map(p => p.name).join(', ')}`);
  console.log(`Final round bye count: ${finalRoundCandidates.length} (largest: ${finalRoundCandidates.length >= maxPreviousRoundByes ? 'YES' : 'NO'})`);
  
  // Validate all requirements
  validateMinimumByeRequirement(players, schedule);
  validateByeRoundPositioning(schedule);
  validateByeQuality(players, schedule, playerTargetByes);
  
  return schedule;
}

function selectByeCandidatesWithMinimumByeRequirement(
  players,
  roundIndex,
  byesNeeded,
  playerByeCount,
  playerTargetByes,
  playerLastByeRound,
  playersWithoutByes
) {
  // Get all potential candidates
  let candidates = [...players];
  
  // Sort with special priority for players who haven't had any byes
  candidates.sort((a, b) => {
    // Priority 1: Players who haven't had any byes yet (critical for minimum requirement)
    const aHasNoByes = playersWithoutByes.has(a.id);
    const bHasNoByes = playersWithoutByes.has(b.id);
    
    if (aHasNoByes !== bHasNoByes) {
      return aHasNoByes ? -1 : 1; // Players without byes first
    }
    
    // Priority 2: Avoid consecutive byes
    const aLastBye = playerLastByeRound[a.id];
    const bLastBye = playerLastByeRound[b.id];
    const aIsConsecutive = (roundIndex - aLastBye) === 1;
    const bIsConsecutive = (roundIndex - bLastBye) === 1;
    
    if (aIsConsecutive !== bIsConsecutive) {
      return aIsConsecutive ? 1 : -1; // Non-consecutive candidates first
    }
    
    // Priority 3: Minimize female setters on bye
    const aIsFemaleSet = a.gender === 'female' && a.is_setter;
    const bIsFemaleSet = b.gender === 'female' && b.is_setter;
    
    if (aIsFemaleSet !== bIsFemaleSet) {
      return aIsFemaleSet ? 1 : -1; // Non-female-setters first
    }
    
    // Priority 4: Players who need more byes
    const aNeed = Math.max(0, playerTargetByes[a.id] - playerByeCount[a.id]);
    const bNeed = Math.max(0, playerTargetByes[b.id] - playerByeCount[b.id]);
    if (aNeed !== bNeed) {
      return bNeed - aNeed; // Higher need first
    }
    
    // Priority 5: Longer gap since last bye
    const aGap = roundIndex - aLastBye;
    const bGap = roundIndex - bLastBye;
    return bGap - aGap; // Longer gap first
  });
  
  const selectedCandidates = candidates.slice(0, byesNeeded);
  
  // Analysis
  const playersGettingFirstBye = selectedCandidates.filter(p => playersWithoutByes.has(p.id)).length;
  
  console.log(`  Players getting their first bye: ${playersGettingFirstBye}/${byesNeeded}`);
  
  return selectedCandidates;
}

function validateMinimumByeRequirement(players, schedule) {
  console.log('\n=== Minimum Bye Requirement Validation ===');
  
  const playerByeCount = {};
  players.forEach(p => playerByeCount[p.id] = 0);
  
  // Count actual byes
  schedule.forEach((roundByes) => {
    roundByes.forEach(player => {
      playerByeCount[player.id]++;
    });
  });
  
  // Check minimum bye requirement
  let playersWithNoByes = 0;
  let playersWithAtLeastOneBye = 0;
  
  players.forEach(player => {
    const byeCount = playerByeCount[player.id];
    if (byeCount === 0) {
      playersWithNoByes++;
      console.warn(`  ${player.name}: NO BYES (requirement violation)`);
    } else {
      playersWithAtLeastOneBye++;
    }
  });
  
  console.log(`Players with at least one bye: ${playersWithAtLeastOneBye}/${players.length}`);
  console.log(`Players with no byes: ${playersWithNoByes}`);
  
  if (playersWithNoByes === 0) {
    console.log('✅ Perfect: All players have at least one bye');
  } else {
    console.log(`❌ Requirement violation: ${playersWithNoByes} players have no byes`);
  }
}

function validateByeRoundPositioning(schedule) {
  console.log('\n=== Bye Round Positioning Validation ===');
  
  const byeCountsPerRound = schedule.map((round, index) => ({
    round: index + 1,
    count: round.length
  }));
  
  console.log('Bye counts by round:');
  byeCountsPerRound.forEach(({ round, count }) => {
    console.log(`  Round ${round}: ${count} byes`);
  });
  
  const maxByeCount = Math.max(...byeCountsPerRound.map(r => r.count));
  const finalRoundByeCount = byeCountsPerRound[byeCountsPerRound.length - 1].count;
  
  const roundsWithMaxByes = byeCountsPerRound.filter(r => r.count === maxByeCount);
  
  if (finalRoundByeCount === maxByeCount && roundsWithMaxByes.length === 1) {
    console.log(`✅ Perfect: Final round has the most byes (${finalRoundByeCount})`);
  } else if (finalRoundByeCount === maxByeCount) {
    console.log(`✅ Good: Final round tied for most byes (${finalRoundByeCount})`);
  } else {
    console.log(`⚠️  Issue: Final round (${finalRoundByeCount} byes) does not have the most byes (max: ${maxByeCount})`);
  }
}

function selectByeCandidatesWithConsecutiveAvoidance(
  players, 
  roundIndex, 
  byesNeeded, 
  playerByeCount, 
  playerTargetByes, 
  playerLastByeRound
) {
  // Get all potential candidates
  let candidates = [...players];
  
  // Sort candidates by priority to avoid consecutive byes, minimize female setters, and ensure fair distribution
  candidates.sort((a, b) => {
    // Priority 1: Avoid consecutive byes (critical requirement)
    const aLastBye = playerLastByeRound[a.id];
    const bLastBye = playerLastByeRound[b.id];
    const aIsConsecutive = (roundIndex - aLastBye) === 1;
    const bIsConsecutive = (roundIndex - bLastBye) === 1;
    
    if (aIsConsecutive !== bIsConsecutive) {
      return aIsConsecutive ? 1 : -1; // Non-consecutive candidates first
    }
    
    // Priority 2: Minimize female setters on bye (new requirement)
    const aIsFemaleSet = a.gender === 'female' && a.is_setter;
    const bIsFemaleSet = b.gender === 'female' && b.is_setter;
    
    if (aIsFemaleSet !== bIsFemaleSet) {
      return aIsFemaleSet ? 1 : -1; // Non-female-setters first
    }
    
    // Priority 3: Players who still need byes to reach their target
    const aNeed = Math.max(0, playerTargetByes[a.id] - playerByeCount[a.id]);
    const bNeed = Math.max(0, playerTargetByes[b.id] - playerByeCount[b.id]);
    if (aNeed !== bNeed) {
      return bNeed - aNeed; // Higher need first
    }
    
    // Priority 4: Players with fewer total byes so far
    if (playerByeCount[a.id] !== playerByeCount[b.id]) {
      return playerByeCount[a.id] - playerByeCount[b.id]; // Fewer byes first
    }
    
    // Priority 5: Players with longer gap since last bye
    const aGap = roundIndex - aLastBye;
    const bGap = roundIndex - bLastBye;
    return bGap - aGap; // Longer gap first
  });
  
  // Select the best candidates
  const selectedCandidates = candidates.slice(0, byesNeeded);
  
  // Analyze the selection quality
  const consecutiveCount = selectedCandidates.filter(player => {
    const lastBye = playerLastByeRound[player.id];
    return (roundIndex - lastBye) === 1;
  }).length;
  
  const femaleSetterCount = selectedCandidates.filter(player => 
    player.gender === 'female' && player.is_setter
  ).length;
  
  const totalFemaleSetters = players.filter(p => p.gender === 'female' && p.is_setter).length;
  
  // Log selection analysis
  if (consecutiveCount > 0) {
    console.warn(`  Warning: ${consecutiveCount}/${byesNeeded} players will have consecutive byes (unavoidable)`);
  }
  
  if (femaleSetterCount > 0) {
    console.warn(`  Female setters on bye: ${femaleSetterCount}/${totalFemaleSetters} (${Math.round((femaleSetterCount/totalFemaleSetters)*100)}%)`);
  } else {
    console.log(`  Success: No female setters on bye this round`);
  }
  
  if (consecutiveCount === 0 && femaleSetterCount === 0) {
    console.log(`  Perfect selection: No consecutive byes, no female setters`);
  }
  
  return selectedCandidates;
}

function validateByeQuality(players, schedule, playerTargetByes) {
  console.log('\n=== Bye Quality Validation ===');
  
  const playerByeCount = {};
  players.forEach(p => playerByeCount[p.id] = 0);
  
  // Count actual byes
  schedule.forEach((roundByes) => {
    roundByes.forEach(player => {
      playerByeCount[player.id]++;
    });
  });
  
  // Check bye distribution accuracy
  let correctByeCount = 0;
  let byeDistributionErrors = [];
  
  players.forEach(player => {
    const actual = playerByeCount[player.id];
    const target = playerTargetByes[player.id];
    if (actual === target) {
      correctByeCount++;
    } else {
      byeDistributionErrors.push(`${player.name}: ${actual}/${target} byes`);
    }
  });
  
  // Check consecutive byes
  let consecutiveByeInstances = 0;
  let playersWithConsecutiveByes = 0;
  
  players.forEach(player => {
    let hasConsecutiveByes = false;
    
    for (let roundIndex = 0; roundIndex < schedule.length - 1; roundIndex++) {
      const inThisRound = schedule[roundIndex].some(p => p.id === player.id);
      const inNextRound = schedule[roundIndex + 1].some(p => p.id === player.id);
      
      if (inThisRound && inNextRound) {
        consecutiveByeInstances++;
        if (!hasConsecutiveByes) {
          playersWithConsecutiveByes++;
          hasConsecutiveByes = true;
        }
        console.warn(`  ${player.name}: consecutive byes in rounds ${roundIndex + 1}-${roundIndex + 2}`);
      }
    }
  });
  
  // Check female setter bye minimization
  const totalFemaleSetters = players.filter(p => p.gender === 'female' && p.is_setter).length;
  let femaleSetterByeInstances = 0;
  let roundsWithFemaleSetterByes = 0;
  
  schedule.forEach((roundByes, roundIndex) => {
    const femaleSettersOnBye = roundByes.filter(p => p.gender === 'female' && p.is_setter);
    if (femaleSettersOnBye.length > 0) {
      roundsWithFemaleSetterByes++;
      femaleSetterByeInstances += femaleSettersOnBye.length;
      console.log(`  Round ${roundIndex + 1}: ${femaleSettersOnBye.length} female setters on bye (${femaleSettersOnBye.map(p => p.name).join(', ')})`);
    }
  });
  
  // Summary
  console.log(`\n--- Summary ---`);
  console.log(`Bye distribution accuracy: ${correctByeCount}/${players.length} players correct`);
  console.log(`Consecutive bye instances: ${consecutiveByeInstances}`);
  console.log(`Players with consecutive byes: ${playersWithConsecutiveByes}/${players.length}`);
  
  if (totalFemaleSetters > 0) {
    console.log(`Female setter bye instances: ${femaleSetterByeInstances} total`);
    console.log(`Rounds with female setter byes: ${roundsWithFemaleSetterByes}/${schedule.length}`);
    const femaleSetterByePercentage = Math.round((femaleSetterByeInstances / (totalFemaleSetters * schedule.length)) * 100);
    console.log(`Female setter bye percentage: ${femaleSetterByePercentage}% of possible bye slots`);
  } else {
    console.log(`No female setters in tournament`);
  }
  
  if (byeDistributionErrors.length > 0) {
    console.warn('Bye distribution errors:');
    byeDistributionErrors.forEach(error => console.warn(`  ${error}`));
  }
  
  // Quality ratings
  const consecutivePercentage = players.length > 0 ? Math.round((playersWithConsecutiveByes / players.length) * 100) : 0;
  const femaleSetterByeRate = totalFemaleSetters > 0 ? Math.round((femaleSetterByeInstances / (totalFemaleSetters * schedule.length)) * 100) : 0;
  
  if (consecutiveByeInstances === 0) {
    console.log('✅ Perfect: No consecutive byes');
  } else if (consecutivePercentage <= 10) {
    console.log(`✅ Good: Only ${consecutivePercentage}% of players have consecutive byes`);
  } else {
    console.log(`⚠️  Suboptimal: ${consecutivePercentage}% of players have consecutive byes`);
  }
  
  if (totalFemaleSetters > 0) {
    if (femaleSetterByeInstances === 0) {
      console.log('✅ Perfect: No female setters on bye');
    } else if (femaleSetterByeRate <= 25) {
      console.log(`✅ Good: Female setters on bye only ${femaleSetterByeRate}% of the time`);
    } else {
      console.log(`⚠️  Suboptimal: Female setters on bye ${femaleSetterByeRate}% of the time`);
    }
  }
}

function generateRound(playingPlayers, byePlayers, structure, roundNumber) {
  const maxPlayersPerTeam = 6;
  const maxTeams = structure.courtsUsed * 2;
  
  // Find best team configuration
  let teamConfig = null;
  
  for (let teamCount = 2; teamCount <= maxTeams; teamCount += 2) {
    const avgTeamSize = playingPlayers.length / teamCount;
    
    if (avgTeamSize >= 5 && avgTeamSize <= maxPlayersPerTeam) {
      // Check if this distribution actually works
      const baseSize = Math.floor(avgTeamSize);
      const remainder = playingPlayers.length % teamCount;
      
      const teamSizes = [];
      for (let i = 0; i < teamCount; i++) {
        teamSizes.push(baseSize + (i < remainder ? 1 : 0));
      }
      
      // Verify all team sizes are valid
      if (teamSizes.every(size => size >= 5 && size <= maxPlayersPerTeam)) {
        teamConfig = { teamCount, teamSizes };
        console.log(`Using ${teamCount} teams: ${teamSizes.join(', ')} players`);
        break;
      }
    }
  }
  
  if (!teamConfig) {
    throw new Error(`Cannot create teams for ${playingPlayers.length} players`);
  }
  
  // Create teams with balanced distribution
  const teams = createBalancedTeams(playingPlayers, teamConfig, roundNumber);
  
  // Create matches
  const matches = createSimpleMatches(teams);
  
  // Add bye team if needed
  if (byePlayers.length > 0) {
    teams.push({
      id: `bye_round_${roundNumber}`,
      team_number: teams.length + 1,
      court: null,
      is_bye_team: true,
      players: byePlayers
    });
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

function createBalancedTeams(players, teamConfig, roundNumber) {
  const { teamCount, teamSizes } = teamConfig;
  
  // Create empty teams with tracking
  const teams = [];
  for (let i = 0; i < teamCount; i++) {
    teams.push({
      id: `round_${roundNumber}_team_${i + 1}`,
      team_number: i + 1,
      court: Math.floor(i / 2) + 1,
      is_bye_team: false,
      players: [],
      targetSize: teamSizes[i],
      stats: {
        male: 0,
        female: 0,
        femaleSetters: 0,
        maleA: 0, femaleA: 0,
        maleBB: 0, femaleBB: 0,
        maleB: 0, femaleB: 0
      }
    });
  }
  
  // Categorize players for systematic distribution
  const shuffledPlayers = shuffleArray([...players]);
  const categories = {
    femaleSetters: shuffledPlayers.filter(p => p.gender === 'female' && p.is_setter),
    maleA: shuffledPlayers.filter(p => p.gender === 'male' && p.skill_level === 'A'),
    femaleA: shuffledPlayers.filter(p => p.gender === 'female' && p.skill_level === 'A' && !p.is_setter),
    maleBB: shuffledPlayers.filter(p => p.gender === 'male' && p.skill_level === 'BB'),
    femaleBB: shuffledPlayers.filter(p => p.gender === 'female' && p.skill_level === 'BB' && !p.is_setter),
    maleB: shuffledPlayers.filter(p => p.gender === 'male' && p.skill_level === 'B'),
    femaleB: shuffledPlayers.filter(p => p.gender === 'female' && p.skill_level === 'B' && !p.is_setter),
    maleOther: shuffledPlayers.filter(p => 
      p.gender === 'male' && !p.is_setter && 
      !['A', 'BB', 'B'].includes(p.skill_level)
    )
  };
  
  // Distribution order (requirement priority)
  const distributionOrder = [
    'femaleSetters',  // Requirement 1: Female setters distributed evenly
    'maleA',         // Requirement 3: Male A players distributed evenly
    'femaleA',       // Requirement 4: Female A players distributed evenly
    'maleBB',        // Requirement 5: Male BB players distributed evenly
    'femaleBB',      // Requirement 6: Female BB players distributed evenly
    'maleB',         // Requirement 7: Male B players distributed evenly
    'femaleB',       // Requirement 8: Female B players distributed evenly
    'maleOther'      // Remaining males
  ];
  
  // Distribute each category
  distributionOrder.forEach(category => {
    const playersInCategory = categories[category];
    
    playersInCategory.forEach(player => {
      const bestTeam = findBestTeamForPlayer(teams, player, category);
      if (bestTeam) {
        bestTeam.players.push(player);
        updateTeamStats(bestTeam.stats, player);
      }
    });
    
    console.log(`Distributed ${playersInCategory.length} ${category} players`);
  });
  
  // Final assignment check
  const assignedPlayerIds = new Set();
  teams.forEach(team => {
    team.players.forEach(player => assignedPlayerIds.add(player.id));
  });
  
  const unassignedPlayers = shuffledPlayers.filter(p => !assignedPlayerIds.has(p.id));
  unassignedPlayers.forEach(player => {
    const availableTeams = teams.filter(team => team.players.length < team.targetSize);
    if (availableTeams.length > 0) {
      // Sort by best gender balance for this player
      availableTeams.sort((a, b) => {
        const aImbalance = calculateGenderImbalanceAfterAdding(a, player);
        const bImbalance = calculateGenderImbalanceAfterAdding(b, player);
        return aImbalance - bImbalance;
      });
      
      const bestTeam = availableTeams[0];
      bestTeam.players.push(player);
      updateTeamStats(bestTeam.stats, player);
    }
  });
  
  // Log final team composition
  teams.forEach(team => {
    const genderRatio = `${team.stats.male}M:${team.stats.female}F`;
    console.log(`Team ${team.team_number}: ${team.players.length} players (${genderRatio})`);
  });
  
  // Validate gender balance
  validateGenderBalance(teams);
  
  return teams;
}

function findBestTeamForPlayer(teams, player, category) {
  const availableTeams = teams.filter(team => team.players.length < team.targetSize);
  
  if (availableTeams.length === 0) return null;
  
  // Sort teams by multiple criteria
  availableTeams.sort((a, b) => {
    // Primary: Team with fewest of this category
    const aCategoryCount = getCategoryCount(a.stats, category);
    const bCategoryCount = getCategoryCount(b.stats, category);
    if (aCategoryCount !== bCategoryCount) {
      return aCategoryCount - bCategoryCount;
    }
    
    // Secondary: Better gender balance after adding this player
    const aGenderImbalance = calculateGenderImbalanceAfterAdding(a, player);
    const bGenderImbalance = calculateGenderImbalanceAfterAdding(b, player);
    if (aGenderImbalance !== bGenderImbalance) {
      return aGenderImbalance - bGenderImbalance;
    }
    
    // Tertiary: Less filled team
    return a.players.length - b.players.length;
  });
  
  return availableTeams[0];
}

function getCategoryCount(stats, category) {
  switch (category) {
    case 'femaleSetters': return stats.femaleSetters;
    case 'maleA': return stats.maleA;
    case 'femaleA': return stats.femaleA;
    case 'maleBB': return stats.maleBB;
    case 'femaleBB': return stats.femaleBB;
    case 'maleB': return stats.maleB;
    case 'femaleB': return stats.femaleB;
    case 'maleOther': return stats.male - stats.maleA - stats.maleBB - stats.maleB;
    default: return 0;
  }
}

function calculateGenderImbalanceAfterAdding(team, player) {
  const currentMale = team.stats.male;
  const currentFemale = team.stats.female;
  
  const newMale = currentMale + (player.gender === 'male' ? 1 : 0);
  const newFemale = currentFemale + (player.gender === 'female' ? 1 : 0);
  
  // Return absolute difference between male and female count
  return Math.abs(newMale - newFemale);
}

function updateTeamStats(stats, player) {
  // Update gender counts
  if (player.gender === 'male') stats.male++;
  if (player.gender === 'female') stats.female++;
  
  // Update specific categories
  if (player.gender === 'female' && player.is_setter) stats.femaleSetters++;
  if (player.gender === 'male' && player.skill_level === 'A') stats.maleA++;
  if (player.gender === 'female' && player.skill_level === 'A') stats.femaleA++;
  if (player.gender === 'male' && player.skill_level === 'BB') stats.maleBB++;
  if (player.gender === 'female' && player.skill_level === 'BB') stats.femaleBB++;
  if (player.gender === 'male' && player.skill_level === 'B') stats.maleB++;
  if (player.gender === 'female' && player.skill_level === 'B') stats.femaleB++;
}

function validateGenderBalance(teams) {
  console.log('\n--- Gender Balance Validation ---');
  
  let severeImbalances = 0;
  const imbalanceThreshold = 2; // More than 2 player difference is concerning
  
  teams.forEach(team => {
    const imbalance = Math.abs(team.stats.male - team.stats.female);
    const ratio = `${team.stats.male}M:${team.stats.female}F`;
    
    if (imbalance > imbalanceThreshold) {
      console.warn(`Team ${team.team_number}: Severe gender imbalance (${ratio})`);
      severeImbalances++;
    } else {
      console.log(`Team ${team.team_number}: Good balance (${ratio})`);
    }
  });
  
  console.log(`Teams with severe gender imbalance: ${severeImbalances}/${teams.length}`);
}

function createSimpleMatches(teams) {
  const matches = [];
  
  // Group teams by size for optimal matching
  const teamsBySize = {};
  teams.forEach(team => {
    const size = team.players.length;
    if (!teamsBySize[size]) teamsBySize[size] = [];
    teamsBySize[size].push(team);
  });
  
  console.log('\n--- Team Size Distribution ---');
  Object.keys(teamsBySize).forEach(size => {
    console.log(`${size} players: ${teamsBySize[size].length} teams`);
  });
  
  const usedTeams = new Set();
  let courtNumber = 1;
  
  // Phase 1: Match equal-sized teams first (requirement: equal sizes should play each other)
  Object.keys(teamsBySize).forEach(size => {
    const teamsOfThisSize = teamsBySize[size].filter(team => !usedTeams.has(team.id));
    
    // Pair teams of the same size
    for (let i = 0; i < teamsOfThisSize.length - 1; i += 2) {
      if (usedTeams.has(teamsOfThisSize[i].id) || usedTeams.has(teamsOfThisSize[i + 1].id)) {
        continue;
      }
      
      const team1 = teamsOfThisSize[i];
      const team2 = teamsOfThisSize[i + 1];
      
      matches.push({
        id: `match_${courtNumber}`,
        court: courtNumber,
        team1_id: team1.id,
        team2_id: team2.id,
        team1,
        team2,
        is_completed: false,
        matchType: 'equal_size' // Track that this is an optimal match
      });
      
      usedTeams.add(team1.id);
      usedTeams.add(team2.id);
      
      console.log(`Court ${courtNumber}: Team ${team1.team_number} (${team1.players.length}) vs Team ${team2.team_number} (${team2.players.length}) [EQUAL SIZE]`);
      courtNumber++;
    }
  });
  
  // Phase 2: Match any remaining teams (mixed sizes if necessary)
  const remainingTeams = teams.filter(team => !usedTeams.has(team.id));
  
  if (remainingTeams.length >= 2) {
    console.log('\n--- Mixed Size Matches ---');
    
    // Sort remaining teams by size to minimize size differences
    remainingTeams.sort((a, b) => a.players.length - b.players.length);
    
    for (let i = 0; i < remainingTeams.length - 1; i += 2) {
      const team1 = remainingTeams[i];
      const team2 = remainingTeams[i + 1];
      
      matches.push({
        id: `match_${courtNumber}`,
        court: courtNumber,
        team1_id: team1.id,
        team2_id: team2.id,
        team1,
        team2,
        is_completed: false,
        matchType: 'mixed_size' // Track that this is a compromise match
      });
      
      const sizeDiff = Math.abs(team1.players.length - team2.players.length);
      console.log(`Court ${courtNumber}: Team ${team1.team_number} (${team1.players.length}) vs Team ${team2.team_number} (${team2.players.length}) [MIXED SIZE +${sizeDiff}]`);
      courtNumber++;
    }
  }
  
  // Phase 3: Validate match quality
  validateMatchQuality(matches);
  
  return matches;
}

function validateMatchQuality(matches) {
  console.log('\n--- Match Quality Analysis ---');
  
  let equalSizeMatches = 0;
  let mixedSizeMatches = 0;
  let sizeDifferenceTotal = 0;
  
  matches.forEach(match => {
    const team1Size = match.team1.players.length;
    const team2Size = match.team2.players.length;
    const sizeDifference = Math.abs(team1Size - team2Size);
    
    sizeDifferenceTotal += sizeDifference;
    
    if (sizeDifference === 0) {
      equalSizeMatches++;
    } else {
      mixedSizeMatches++;
    }
  });
  
  const totalMatches = matches.length;
  const equalSizePercentage = totalMatches > 0 ? Math.round((equalSizeMatches / totalMatches) * 100) : 0;
  const avgSizeDifference = totalMatches > 0 ? (sizeDifferenceTotal / totalMatches).toFixed(1) : 0;
  
  console.log(`Equal size matches: ${equalSizeMatches}/${totalMatches} (${equalSizePercentage}%)`);
  console.log(`Mixed size matches: ${mixedSizeMatches}/${totalMatches}`);
  console.log(`Average size difference: ${avgSizeDifference} players`);
  
  if (equalSizePercentage >= 80) {
    console.log('✅ Excellent match sizing');
  } else if (equalSizePercentage >= 60) {
    console.log('✅ Good match sizing');  
  } else {
    console.log('⚠️  Suboptimal match sizing - many mixed size matches');
  }
}

function validateTournament(players, allRounds, expectedMatches) {
  console.log('\n=== Tournament Validation ===');
  
  const playerMatchCount = {};
  players.forEach(p => playerMatchCount[p.id] = 0);
  
  // Count matches for each player
  allRounds.forEach(round => {
    round.matches.forEach(match => {
      match.team1.players.forEach(player => {
        playerMatchCount[player.id]++;
      });
      match.team2.players.forEach(player => {
        playerMatchCount[player.id]++;
      });
    });
  });
  
  // Validate counts
  let correctCount = 0;
  const errors = [];
  
  players.forEach(player => {
    const actual = playerMatchCount[player.id];
    if (actual === expectedMatches) {
      correctCount++;
    } else {
      errors.push(`${player.name}: ${actual}/${expectedMatches} matches`);
    }
  });
  
  console.log(`Correct: ${correctCount}/${players.length}`);
  
  if (errors.length > 0) {
    console.error('Match count errors:');
    errors.forEach(error => console.error(`  ${error}`));
    throw new Error(`${errors.length} players have incorrect match counts`);
  }
  
  console.log('✅ All players have correct match counts');
}

function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Legacy compatibility functions for existing codebase
function generateTeams(players, settings, roundNumber) {
  return generateTeamsForRound(players, 2, settings, roundNumber);
}

function generateTeamsForRound(players, targetTeams, settings, roundNumber) {
  const structure = calculateOptimalStructure(players.length, settings);
  return generateRound(players, [], structure, roundNumber);
}

function balancePlayerMatches(allPlayers, tournamentRounds, matchesPerPlayer) {
  const playerMatchCounts = {};
  allPlayers.forEach(p => playerMatchCounts[p.id] = p.matches_played || 0);
  
  return allPlayers.filter(player => 
    playerMatchCounts[player.id] < matchesPerPlayer
  );
}

module.exports = { 
  generateAllRounds, 
  generateTeams, 
  generateTeamsForRound, 
  balancePlayerMatches 
};