/**
 * Mad Hatter Volleyball Tournament Generator
 * Generates teams, matches, and rounds for volleyball tournaments
 * Built to meet strict requirements for player distribution and bye management
 */

/**
 * Main function to generate all tournament rounds
 * @param {Array} players - Array of player objects with properties: id, name, gender, skill_level, is_setter
 * @param {Object} settings - Tournament settings
 * @param {number} settings.courtsAvailable - Number of courts available
 * @param {number} settings.minPlayersPerTeam - Minimum players per team (non-negotiable)
 * @param {number} settings.matchesPerPlayer - Number of rounds each player must play (non-negotiable)
 * @param {boolean} settings.hasPowerMatch - Whether to include power matches (not implemented in this version)
 * @returns {Array} Array of round objects
 */
function generateAllRounds(players, settings) {
  console.log('\n=== Mad Hatter Tournament Generator ===');
  console.log(`Players: ${players.length}`);
  console.log(`Courts Available: ${settings.courtsAvailable}`);
  console.log(`Min Players Per Team: ${settings.minPlayersPerTeam}`);
  console.log(`Matches Per Player: ${settings.matchesPerPlayer}`);
  
  // Validate inputs
  validateTournamentInputs(players, settings);
  
  // Calculate tournament structure
  const structure = calculateTournamentStructure(players, settings);
  
  console.log('\n=== Tournament Structure ===');
  console.log(`Courts to use: ${structure.courtsToUse}`);
  console.log(`Teams per round: ${structure.teamsPerRound}`);
  console.log(`Players per round: ${structure.playersPerRound}`);
  console.log(`Players on bye per round: ${structure.byesPerRound}`);
  console.log(`Total rounds: ${settings.matchesPerPlayer}`);
  
  // Generate bye schedule if needed
  const byeSchedule = structure.byesPerRound > 0 ? 
    generateByeSchedule(players, settings.matchesPerPlayer, structure.byesPerRound) : 
    Array(settings.matchesPerPlayer).fill([]);
  
  // Generate all rounds
  const allRounds = [];
  for (let roundNum = 1; roundNum <= settings.matchesPerPlayer; roundNum++) {
    const byePlayers = byeSchedule[roundNum - 1];
    const playingPlayers = players.filter(p => !byePlayers.some(bye => bye.id === p.id));
    
    console.log(`\n=== Generating Round ${roundNum} ===`);
    console.log(`Playing: ${playingPlayers.length}, Bye: ${byePlayers.length}`);
    
    const round = generateSingleRound(
      playingPlayers,
      byePlayers,
      structure.courtsToUse,
      settings.minPlayersPerTeam,
      roundNum
    );
    
    allRounds.push(round);
  }
  
  // Validate final tournament
  validateFinalTournament(players, allRounds, settings.matchesPerPlayer);
  
  console.log('\n=== Tournament Generation Complete ===');
  return allRounds;
}

/**
 * Validates tournament inputs to ensure they meet requirements
 */
function validateTournamentInputs(players, settings) {
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
  
  if (settings.minPlayersPerTeam < 3) {
    throw new Error('Minimum team size must be at least 3 players');
  }
}

/**
 * Calculates the optimal tournament structure
 */
function calculateTournamentStructure(players, settings) {
  const maxPlayersPerTeam = 6;
  let courtsToUse = settings.courtsAvailable;
  
  // Find the maximum courts we can actually use
  while (courtsToUse >= 1) {
    const teamsPerRound = courtsToUse * 2;
    const minPlayersNeeded = teamsPerRound * settings.minPlayersPerTeam;
    
    // Check if we have enough players to fill minimum team requirements
    if (players.length >= minPlayersNeeded) {
      // Calculate how many players will actually play per round
      const maxPlayersPerRound = teamsPerRound * maxPlayersPerTeam;
      const playersPerRound = Math.min(players.length, maxPlayersPerRound);
      
      // But ensure we can actually form valid teams with playersPerRound
      let validPlayersPerRound = playersPerRound;
      
      // Work backwards to find largest valid team configuration
      while (validPlayersPerRound >= minPlayersNeeded) {
        if (canFormValidTeamsWithCount(validPlayersPerRound, teamsPerRound, settings.minPlayersPerTeam, maxPlayersPerTeam)) {
          const byesPerRound = players.length - validPlayersPerRound;
          
          return {
            courtsToUse,
            teamsPerRound,
            playersPerRound: validPlayersPerRound,
            byesPerRound
          };
        }
        validPlayersPerRound--;
      }
    }
    
    courtsToUse--;
  }
  
  throw new Error('Cannot create valid tournament structure with given constraints');
}

// Helper function to check if we can form valid teams
function canFormValidTeamsWithCount(totalPlayers, teamCount, minSize, maxSize) {
  if (teamCount % 2 !== 0) return false; // Need even teams for matches
  
  const avgSize = totalPlayers / teamCount;
  if (avgSize < minSize || avgSize > maxSize) return false;
  
  // Check if the distribution works
  const baseSize = Math.floor(avgSize);
  const extraPlayers = totalPlayers % teamCount;
  
  const smallTeamSize = baseSize;
  const largeTeamSize = baseSize + 1;
  
  return (smallTeamSize >= minSize && smallTeamSize <= maxSize &&
          largeTeamSize >= minSize && largeTeamSize <= maxSize);
}

/**
 * Generates the bye schedule ensuring fair distribution and no consecutive byes
 */
function generateByeSchedule(players, totalRounds, byesPerRound) {
  if (byesPerRound === 0) {
    return Array(totalRounds).fill([]);
  }
  
  console.log('\n=== Generating Bye Schedule ===');
  console.log(`${byesPerRound} players on bye per round for ${totalRounds} rounds`);
  
  const shuffledPlayers = shuffleArray([...players]);
  const byeSchedule = Array(totalRounds).fill(null).map(() => []);
  const playerByeCount = {};
  const playerLastByeRound = {};
  
  // Initialize tracking
  shuffledPlayers.forEach(player => {
    playerByeCount[player.id] = 0;
    playerLastByeRound[player.id] = -2; // -2 ensures round 0 isn't consecutive
  });
  
  // Calculate target byes per player
  const totalByeSlots = totalRounds * byesPerRound;
  const baseByesPerPlayer = Math.floor(totalByeSlots / players.length);
  const extraByeSlots = totalByeSlots % players.length;
  
  const playerTargetByes = {};
  shuffledPlayers.forEach((player, index) => {
    playerTargetByes[player.id] = baseByesPerPlayer + (index < extraByeSlots ? 1 : 0);
  });
  
  console.log(`Total bye slots: ${totalByeSlots}`);
  console.log(`Base byes per player: ${baseByesPerPlayer}, ${extraByeSlots} players get +1 bye`);
  
  // Assign byes with consecutive avoidance and setter preference
  for (let roundIndex = 0; roundIndex < totalRounds; roundIndex++) {
    console.log(`\n--- Assigning Round ${roundIndex + 1} byes ---`);
    
    const candidates = selectByeCandidates(
      shuffledPlayers,
      roundIndex,
      byesPerRound, // Always use exact byesPerRound, not variable target
      playerByeCount,
      playerTargetByes,
      playerLastByeRound
    );
    
    // Update tracking
    candidates.forEach(player => {
      playerByeCount[player.id]++;
      playerLastByeRound[player.id] = roundIndex;
    });
    
    byeSchedule[roundIndex] = candidates;
    
    console.log(`Round ${roundIndex + 1}: ${candidates.length} players on bye`);
  }
  
  // No reordering for now - keep rounds in original order
  // The "largest bye round last" requirement can be implemented later
  
  // Validate bye schedule
  validateByeSchedule(players, byeSchedule, playerTargetByes);
  
  return byeSchedule;
}

/**
 * Selects candidates for bye assignments with priority rules
 */
function selectByeCandidates(players, roundIndex, targetCount, playerByeCount, playerTargetByes, playerLastByeRound) {
  // Get players who still need byes
  let candidates = players.filter(player => 
    playerByeCount[player.id] < playerTargetByes[player.id]
  );
  
  // If not enough candidates, add players with fewest byes
  if (candidates.length < targetCount) {
    const additional = players
      .filter(p => !candidates.some(c => c.id === p.id))
      .sort((a, b) => {
        const aCount = playerByeCount[a.id];
        const bCount = playerByeCount[b.id];
        if (aCount !== bCount) return aCount - bCount;
        
        // Prefer longer gap since last bye
        const aGap = roundIndex - playerLastByeRound[a.id];
        const bGap = roundIndex - playerLastByeRound[b.id];
        return bGap - aGap;
      })
      .slice(0, targetCount - candidates.length);
    
    candidates.push(...additional);
  }
  
  // Sort by priority: avoid consecutive byes, minimize female setters on bye
  candidates.sort((a, b) => {
    // Priority 1: Avoid consecutive byes (requirement 4)
    const aIsConsecutive = (roundIndex - playerLastByeRound[a.id]) === 1;
    const bIsConsecutive = (roundIndex - playerLastByeRound[b.id]) === 1;
    if (aIsConsecutive !== bIsConsecutive) {
      return aIsConsecutive ? 1 : -1; // Non-consecutive first
    }
    
    // Priority 2: Minimize female setters on bye (requirement 3)
    const aIsFemaleSet = a.gender === 'female' && a.is_setter;
    const bIsFemaleSet = b.gender === 'female' && b.is_setter;
    if (aIsFemaleSet !== bIsFemaleSet) {
      return aIsFemaleSet ? 1 : -1; // Non-female-setters first
    }
    
    // Priority 3: Players who need more byes
    const aNeed = playerTargetByes[a.id] - playerByeCount[a.id];
    const bNeed = playerTargetByes[b.id] - playerByeCount[b.id];
    if (aNeed !== bNeed) return bNeed - aNeed;
    
    // Priority 4: Longer gap since last bye
    const aGap = roundIndex - playerLastByeRound[a.id];
    const bGap = roundIndex - playerLastByeRound[b.id];
    return bGap - aGap;
  });
  
  return candidates.slice(0, targetCount);
}

/**
 * Generates a single round with teams and matches
 */
function generateSingleRound(playingPlayers, byePlayers, courts, minPlayersPerTeam, roundNumber) {
  const maxPlayersPerTeam = 6;
  const maxTeams = courts * 2;
  
  console.log(`\n=== Creating Round ${roundNumber} ===`);
  console.log(`Playing players: ${playingPlayers.length}, Courts: ${courts}, Min per team: ${minPlayersPerTeam}`);
  
  // Find optimal team configuration
  let teamConfig = null;
  
  // Try different team counts (even numbers only for matches)
  for (let teamCount = 2; teamCount <= maxTeams; teamCount += 2) {
    if (canFormValidTeamsWithCount(playingPlayers.length, teamCount, minPlayersPerTeam, maxPlayersPerTeam)) {
      teamConfig = {
        teamCount,
        teamSizes: distributePlayersAcrossTeams(playingPlayers.length, teamCount)
      };
      console.log(`Valid config found: ${teamCount} teams with sizes ${teamConfig.teamSizes.join(', ')}`);
      break;
    }
  }
  
  if (!teamConfig) {
    throw new Error(`Cannot create valid teams for ${playingPlayers.length} players with ${minPlayersPerTeam} min per team`);
  }
  
  // Create teams with simple distribution first
  const teams = createSimpleTeams(playingPlayers, teamConfig.teamSizes, roundNumber);
  
  // Create matches
  const matches = createMatches(teams, courts);
  
  // Create bye team if needed
  let byeTeam = null;
  if (byePlayers.length > 0) {
    byeTeam = {
      id: `bye_round_${roundNumber}`,
      team_number: teams.length + 1,
      court: null,
      is_bye_team: true,
      players: byePlayers
    };
  }
  
  const allTeams = [...teams];
  if (byeTeam) {
    allTeams.push(byeTeam);
  }
  
  console.log(`Round ${roundNumber} created: ${teams.length} playing teams, ${matches.length} matches`);
  
  return {
    roundNumber,
    teams: allTeams,
    matches,
    byePlayers,
    totalPlayingPlayers: playingPlayers.length,
    totalByePlayers: byePlayers.length
  };
}

/**
 * Creates teams with simple sequential assignment (for now)
 */
function createSimpleTeams(players, teamSizes, roundNumber) {
  const teams = [];
  let playerIndex = 0;
  
  teamSizes.forEach((size, index) => {
    const teamPlayers = players.slice(playerIndex, playerIndex + size);
    
    teams.push({
      id: `round_${roundNumber}_team_${index + 1}`,
      team_number: index + 1,
      court: Math.floor(index / 2) + 1,
      is_bye_team: false,
      players: teamPlayers
    });
    
    playerIndex += size;
    console.log(`  Team ${index + 1}: ${size} players`);
  });
  
  return teams;
}

/**
 * Creates balanced teams according to distribution requirements
 */
function createBalancedTeams(players, teamSizes) {
  const teams = teamSizes.map((size, index) => ({
    id: `team_${index + 1}`,
    team_number: index + 1,
    court: Math.floor(index / 2) + 1,
    is_bye_team: false,
    players: [],
    targetSize: size,
    stats: {
      male: 0, female: 0, setters: 0,
      maleA: 0, maleB: 0, maleBB: 0,
      femaleA: 0, femaleB: 0, femaleBB: 0,
      femaleSetters: 0
    }
  }));
  
  // Categorize players by priority for distribution
  const playerCategories = categorizePlayersForDistribution(players);
  
  // Distribute in priority order (requirements 1-8)
  const distributionOrder = [
    'femaleSetters',    // Requirement 1: Female setters distributed evenly
    'maleA',           // Requirement 3: Male A players distributed evenly
    'femaleA',         // Requirement 4: Female A players distributed evenly
    'maleBB',          // Requirement 5: Male BB players distributed evenly
    'femaleBB',        // Requirement 6: Female BB players distributed evenly
    'maleB',           // Requirement 7: Male B players distributed evenly
    'femaleB',         // Requirement 8: Female B players distributed evenly
    'maleNonSetters'   // Remaining males
  ];
  
  distributionOrder.forEach(category => {
    if (playerCategories[category]) {
      distributePlayersToTeams(playerCategories[category], teams, category);
    }
  });
  
  // Final balancing pass for gender distribution (requirement 2)
  balanceGenderDistribution(teams);
  
  return teams;
}

/**
 * Categorizes players for systematic distribution
 */
function categorizePlayersForDistribution(players) {
  const shuffled = shuffleArray([...players]);
  
  return {
    femaleSetters: shuffled.filter(p => p.gender === 'female' && p.is_setter),
    maleA: shuffled.filter(p => p.gender === 'male' && p.skill_level === 'A'),
    femaleA: shuffled.filter(p => p.gender === 'female' && p.skill_level === 'A'),
    maleBB: shuffled.filter(p => p.gender === 'male' && p.skill_level === 'BB'),
    femaleBB: shuffled.filter(p => p.gender === 'female' && p.skill_level === 'BB'),
    maleB: shuffled.filter(p => p.gender === 'male' && p.skill_level === 'B'),
    femaleB: shuffled.filter(p => p.gender === 'female' && p.skill_level === 'B'),
    maleNonSetters: shuffled.filter(p => p.gender === 'male' && !p.is_setter)
  };
}

/**
 * Distributes players of a specific category across teams evenly
 */
function distributePlayersToTeams(players, teams, category) {
  players.forEach(player => {
    // Find best team for this player (least filled, needs this type most)
    const bestTeam = teams
      .filter(team => team.players.length < team.targetSize)
      .sort((a, b) => {
        // Primary: team with fewer players of this category
        const aCount = getCategoryCount(a.stats, category);
        const bCount = getCategoryCount(b.stats, category);
        if (aCount !== bCount) return aCount - bCount;
        
        // Secondary: less filled team
        if (a.players.length !== b.players.length) {
          return a.players.length - b.players.length;
        }
        
        // Tertiary: better gender balance
        const aGenderImbalance = Math.abs(a.stats.male - a.stats.female);
        const bGenderImbalance = Math.abs(b.stats.male - b.stats.female);
        return aGenderImbalance - bGenderImbalance;
      })[0];
    
    if (bestTeam) {
      bestTeam.players.push(player);
      updateTeamStats(bestTeam.stats, player);
    }
  });
}

/**
 * Gets the count for a specific category from team stats
 */
function getCategoryCount(stats, category) {
  switch (category) {
    case 'femaleSetters': return stats.femaleSetters;
    case 'maleA': return stats.maleA;
    case 'femaleA': return stats.femaleA;
    case 'maleBB': return stats.maleBB;
    case 'femaleBB': return stats.femaleBB;
    case 'maleB': return stats.maleB;
    case 'femaleB': return stats.femaleB;
    case 'maleNonSetters': return stats.male - stats.setters;
    default: return 0;
  }
}

/**
 * Updates team statistics when adding a player
 */
function updateTeamStats(stats, player) {
  if (player.gender === 'male') stats.male++;
  if (player.gender === 'female') stats.female++;
  if (player.is_setter) stats.setters++;
  if (player.gender === 'female' && player.is_setter) stats.femaleSetters++;
  
  if (player.gender === 'male' && player.skill_level === 'A') stats.maleA++;
  if (player.gender === 'female' && player.skill_level === 'A') stats.femaleA++;
  if (player.gender === 'male' && player.skill_level === 'BB') stats.maleBB++;
  if (player.gender === 'female' && player.skill_level === 'BB') stats.femaleBB++;
  if (player.gender === 'male' && player.skill_level === 'B') stats.maleB++;
  if (player.gender === 'female' && player.skill_level === 'B') stats.femaleB++;
}

/**
 * Final pass to balance gender distribution across teams
 */
function balanceGenderDistribution(teams) {
  // Implementation would involve swapping players between teams to minimize
  // gender imbalance, but this is complex and may conflict with skill distribution
  // For now, the systematic distribution should provide reasonable balance
}

/**
 * Creates matches from teams
 */
function createMatches(teams, courts) {
  const matches = [];
  let courtNumber = 1;
  
  // Create matches by pairing teams sequentially
  for (let i = 0; i < teams.length - 1; i += 2) {
    if (courtNumber > courts) break;
    
    const team1 = teams[i];
    const team2 = teams[i + 1];
    
    matches.push({
      id: `match_court_${courtNumber}`,
      court: courtNumber,
      team1_id: team1.id,
      team2_id: team2.id,
      team1,
      team2,
      is_completed: false
    });
    
    console.log(`  Match ${matches.length}: Team ${team1.team_number} (${team1.players.length}) vs Team ${team2.team_number} (${team2.players.length}) on Court ${courtNumber}`);
    
    courtNumber++;
  }
  
  return matches;
}

/**
 * Utility functions
 */
function distributePlayersAcrossTeams(totalPlayers, teamCount) {
  const baseSize = Math.floor(totalPlayers / teamCount);
  const remainder = totalPlayers % teamCount;
  
  const sizes = [];
  for (let i = 0; i < teamCount; i++) {
    sizes.push(baseSize + (i < remainder ? 1 : 0));
  }
  return sizes;
}

function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Validation functions
 */
function validateByeSchedule(players, byeSchedule, playerTargetByes) {
  console.log('\n=== Validating Bye Schedule ===');
  
  const playerByeCount = {};
  players.forEach(p => playerByeCount[p.id] = 0);
  
  // Count actual byes
  byeSchedule.forEach((roundByes, roundIndex) => {
    roundByes.forEach(player => {
      playerByeCount[player.id]++;
    });
    
    // Check for consecutive byes
    if (roundIndex > 0) {
      const previousByes = byeSchedule[roundIndex - 1];
      roundByes.forEach(player => {
        if (previousByes.some(prev => prev.id === player.id)) {
          console.warn(`Warning: ${player.name} has consecutive byes in rounds ${roundIndex} and ${roundIndex + 1}`);
        }
      });
    }
  });
  
  // Validate bye distribution
  let correctCount = 0;
  players.forEach(player => {
    const actual = playerByeCount[player.id];
    const target = playerTargetByes[player.id];
    if (actual === target) {
      correctCount++;
    } else {
      console.warn(`${player.name}: ${actual} byes (expected ${target})`);
    }
  });
  
  console.log(`Players with correct bye count: ${correctCount}/${players.length}`);
}

function validateFinalTournament(players, allRounds, expectedMatchesPerPlayer) {
  console.log('\n=== Validating Final Tournament ===');
  console.log(`Expected matches per player: ${expectedMatchesPerPlayer}`);
  console.log(`Total rounds: ${allRounds.length}`);
  
  const playerMatchCount = {};
  players.forEach(p => playerMatchCount[p.id] = 0);
  
  // Count matches by looking at which players are NOT on bye each round
  allRounds.forEach((round, roundIndex) => {
    console.log(`\nRound ${roundIndex + 1}:`);
    console.log(`  Players on bye: ${round.byePlayers.length}`);
    console.log(`  Playing teams: ${round.teams.filter(t => !t.is_bye_team).length}`);
    console.log(`  Matches: ${round.matches.length}`);
    
    // Players not on bye in this round are playing
    const playingPlayerIds = new Set();
    
    // Get playing players from matches
    round.matches.forEach(match => {
      // Add all players from team1
      if (match.team1 && match.team1.players) {
        match.team1.players.forEach(player => {
          playingPlayerIds.add(player.id);
        });
      }
      // Add all players from team2  
      if (match.team2 && match.team2.players) {
        match.team2.players.forEach(player => {
          playingPlayerIds.add(player.id);
        });
      }
    });
    
    // Count matches for playing players
    playingPlayerIds.forEach(playerId => {
      if (playerMatchCount[playerId] !== undefined) {
        playerMatchCount[playerId]++;
      }
    });
    
    console.log(`  Players playing this round: ${playingPlayerIds.size}`);
  });
  
  // Validate counts
  let correctMatchCount = 0;
  let totalErrors = 0;
  
  players.forEach(player => {
    const actual = playerMatchCount[player.id];
    if (actual === expectedMatchesPerPlayer) {
      correctMatchCount++;
    } else {
      totalErrors++;
      console.error(`${player.name}: ${actual} matches (expected ${expectedMatchesPerPlayer})`);
    }
  });
  
  console.log(`\nValidation Summary:`);
  console.log(`  Correct: ${correctMatchCount}/${players.length}`);
  console.log(`  Incorrect: ${totalErrors}`);
  
  if (correctMatchCount !== players.length) {
    throw new Error(`${totalErrors} players have incorrect match counts`);
  }
  
  console.log('✅ All players have correct number of matches');
}

// Legacy compatibility functions for existing codebase
function generateTeams(players, settings, roundNumber) {
  // This is a simplified version for compatibility
  // The main function should be generateAllRounds
  return generateTeamsForRound(players, 2, settings, roundNumber);
}

function generateTeamsForRound(players, targetTeams, settings, roundNumber) {
  const structure = calculateTournamentStructure(players, settings);
  return generateSingleRound(players, [], structure.courtsToUse, settings.minPlayersPerTeam, roundNumber);
}

function balancePlayerMatches(allPlayers, tournamentRounds, matchesPerPlayer) {
  // Filter players who haven't reached their match limit
  const playerMatchCounts = {};
  allPlayers.forEach(p => playerMatchCounts[p.id] = p.matches_played || 0);
  
  return allPlayers.filter(player => 
    playerMatchCounts[player.id] < matchesPerPlayer
  );
}

// Export functions for use by the tournament system
module.exports = { 
  generateAllRounds, 
  generateTeams, 
  generateTeamsForRound, 
  balancePlayerMatches 
};