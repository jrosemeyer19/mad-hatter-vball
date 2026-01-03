/**
 * Mad Hatter Volleyball Tournament Generator
 * Complete implementation handling 10-60+ players with flexible court usage
 */

// Global tracking for 37-player tournaments
let special37PlayerHistory = {
  playersOn7Teams: {},
  initialized: false
};

function initializeSpecial37PlayerTracking(players) {
  console.log(`Initializing 37-player tracking for ${players.length} players`);
  special37PlayerHistory.playersOn7Teams = {};
  players.forEach(player => {
    special37PlayerHistory.playersOn7Teams[player.id] = 0;
  });
  special37PlayerHistory.initialized = true;
}

function resetSpecial37PlayerTracking() {
  special37PlayerHistory = {
    playersOn7Teams: {},
    initialized: false
  };
  console.log(`37-player tracking reset`);
}

// Global tracking for teammate rotation across tournament
let tournamentTeammateHistory = {};

function initializeTeammateTracking(players) {
  console.log(`\n=== Initializing Teammate Rotation Tracking ===`);
  console.log(`Tracking ${players.length} players across tournament rounds`);
  
  tournamentTeammateHistory = {};
  players.forEach(player => {
    tournamentTeammateHistory[player.id] = {};
    players.forEach(otherPlayer => {
      if (player.id !== otherPlayer.id) {
        tournamentTeammateHistory[player.id][otherPlayer.id] = 0;
      }
    });
  });
}

function recordTeammates(team) {
  if (!team.players || team.players.length === 0) return;
  
  const playerIds = team.players.map(p => p.id);
  
  // Record each pair of teammates
  for (let i = 0; i < playerIds.length; i++) {
    for (let j = i + 1; j < playerIds.length; j++) {
      if (tournamentTeammateHistory[playerIds[i]] && tournamentTeammateHistory[playerIds[j]]) {
        tournamentTeammateHistory[playerIds[i]][playerIds[j]]++;
        tournamentTeammateHistory[playerIds[j]][playerIds[i]]++;
      }
    }
  }
}

function getTeammateCount(playerId, teamPlayers) {
  if (!tournamentTeammateHistory[playerId]) return 0;
  
  let count = 0;
  for (const teammate of teamPlayers) {
    if (tournamentTeammateHistory[playerId][teammate.id]) {
      count += tournamentTeammateHistory[playerId][teammate.id];
    }
  }
  return count;
}

function resetTeammateTracking() {
  tournamentTeammateHistory = {};
  bPlayerSupportHistory = {};
  console.log(`Teammate rotation tracking reset`);
}

// ===== B PLAYER SUPPORT TRACKING =====
// Track which strong players (A/AA/BB) have supported B players across rounds
// This ensures B players get different "mentors" each round for variety and development

let bPlayerSupportHistory = {};

function initializeBPlayerSupportTracking(players) {
  bPlayerSupportHistory = {};

  const bPlayers = players.filter(p => p.skill_level === 'B');
  const strongPlayers = players.filter(p => ['AA', 'A', 'BB'].includes(p.skill_level));

  console.log(`\n=== Initializing B Player Support Tracking ===`);
  console.log(`B players: ${bPlayers.length}, Strong players (AA/A/BB): ${strongPlayers.length}`);

  bPlayers.forEach(bPlayer => {
    bPlayerSupportHistory[bPlayer.id] = {};
    strongPlayers.forEach(strongPlayer => {
      bPlayerSupportHistory[bPlayer.id][strongPlayer.id] = 0;
    });
  });
}

function recordBPlayerSupport(team) {
  if (!team.players || team.players.length === 0) return;

  const bPlayersOnTeam = team.players.filter(p => p.skill_level === 'B');
  const strongPlayersOnTeam = team.players.filter(p => ['AA', 'A', 'BB'].includes(p.skill_level));

  // Record each B player's support from strong players
  bPlayersOnTeam.forEach(bPlayer => {
    if (bPlayerSupportHistory[bPlayer.id]) {
      strongPlayersOnTeam.forEach(strongPlayer => {
        if (bPlayerSupportHistory[bPlayer.id][strongPlayer.id] !== undefined) {
          bPlayerSupportHistory[bPlayer.id][strongPlayer.id]++;
        }
      });
    }
  });
}

// Get how many times a B player has been supported by the strong players on a potential team
function getBPlayerSupportRepeatCount(bPlayerId, teamPlayers) {
  if (!bPlayerSupportHistory[bPlayerId]) return 0;

  let repeatCount = 0;
  const strongPlayers = teamPlayers.filter(p => ['AA', 'A', 'BB'].includes(p.skill_level));

  strongPlayers.forEach(strongPlayer => {
    const timesWithThisPlayer = bPlayerSupportHistory[bPlayerId][strongPlayer.id] || 0;
    repeatCount += timesWithThisPlayer;
  });

  return repeatCount;
}

// Calculate "support score" for a B player on a given team
// Higher score = better support environment for the B player
function calculateBPlayerSupportScore(bPlayer, team) {
  const teammates = team.players.filter(p => p.id !== bPlayer.id);

  if (teammates.length === 0) return 0;

  // Calculate average skill of teammates (excluding other B players)
  const nonBTeammates = teammates.filter(p => p.skill_level !== 'B');
  if (nonBTeammates.length === 0) return 0;

  const totalSkill = nonBTeammates.reduce((sum, p) => sum + getSkillRating(p), 0);
  const avgSkill = totalSkill / nonBTeammates.length;

  // Bonus for having strong players (AA/A)
  const strongPlayerCount = teammates.filter(p => ['AA', 'A'].includes(p.skill_level)).length;
  const strongPlayerBonus = strongPlayerCount * 0.5;

  // Bonus for larger teams (more support)
  const teamSizeBonus = team.targetSize >= 6 ? 0.3 : 0;

  // Penalty for repeat support (same mentors as before)
  const repeatCount = getBPlayerSupportRepeatCount(bPlayer.id, teammates);
  const repeatPenalty = repeatCount * 0.2;

  return avgSkill + strongPlayerBonus + teamSizeBonus - repeatPenalty;
}

function getSkillRating(player) {
  // Enhanced weighting with AA tier at top and improved consistency
  // Gender multiplier is ~1.67-1.7x across all levels
  const skillValues = {
    'male': {
      'AA': 5.0,   // Elite/competitive player
      'A': 3.8,    // Strong player
      'BB': 2.6,   // Intermediate player
      'B': 1.7     // Developing player
    },
    'female': {
      'AA': 3.0,   // Elite/competitive player
      'A': 2.2,    // Strong player
      'BB': 1.5,   // Intermediate player
      'B': 1.0     // Developing player
    }
  };

  const gender = player.gender.toLowerCase();
  const baseSkill = skillValues[gender]?.[player.skill_level] || 1.5;

  // Scale setter bonus based on skill level (better setters have more impact)
  const setterBonus = player.is_setter ? baseSkill * 0.15 : 0;

  return baseSkill + setterBonus;
}

function calculateTeamSkillRating(team) {
  return team.players.reduce((sum, player) => sum + getSkillRating(player), 0);
}

function getOpponentTeam(teams, teamPairs, team) {
  for (const pair of teamPairs) {
    if (pair.team1.id === team.id) return pair.team2;
    if (pair.team2.id === team.id) return pair.team1;
  }
  return null;
}

function calculateMatchBalanceScore(team, opponentTeam, player) {
  if (!opponentTeam) return 0;
  
  const currentTeamSkill = team.stats.skillRating;
  const opponentSkill = opponentTeam.stats.skillRating;
  const currentDiff = Math.abs(currentTeamSkill - opponentSkill);
  
  const playerSkill = getSkillRating(player);
  const newTeamSkill = currentTeamSkill + playerSkill;
  const newDiff = Math.abs(newTeamSkill - opponentSkill);
  
  const improvement = currentDiff - newDiff;
  
  return improvement;
}

function generateAllRounds(players, settings) {
  console.log('\n=== Mad Hatter Tournament Generator (Flexible) ===');
  console.log(`Players: ${players.length}`);
  console.log(`Courts Available: ${settings.courtsAvailable}`);
  console.log(`Min Players Per Team: ${settings.minPlayersPerTeam}`);
  console.log(`Matches Per Player: ${settings.matchesPerPlayer}`);
  if (settings.finalByePlayerName) {
    console.log(`Final Bye Player Requested: ${settings.finalByePlayerName}`);
  }

  initializeTeammateTracking(players);
  initializeBPlayerSupportTracking(players);

  validateInputs(players, settings);

  const structure = calculateOptimalStructure(players.length, settings);

  const byeSchedule = generateFlexibleByeSchedule(players, structure.flexibleRounds, settings.finalByePlayerName, structure.courtsUsed);
  
  const allRounds = [];
  
  structure.flexibleRounds.forEach((roundConfig, roundIndex) => {
    const roundNum = roundIndex + 1;
    console.log(`\n--- Generating Round ${roundNum} ---`);
    
    const byePlayers = byeSchedule[roundIndex];
    
    const playingPlayers = players.filter(player => 
      !byePlayers.some(byePlayer => byePlayer.id === player.id)
    );
    
    console.log(`Expected playing: ${roundConfig.playersPlaying}, Actual playing: ${playingPlayers.length}`);
    console.log(`Expected byes: ${roundConfig.playersBye}, Actual byes: ${byePlayers.length}`);
    
    if (playingPlayers.length !== roundConfig.playersPlaying) {
      console.error(`❌ Round ${roundNum} player count mismatch!`);
    }

    // Check if this round uses 7-player teams
    const maxTeamSize = roundConfig.teamConfiguration?.maxTeamSize || 6;

    // Use the actual min team size from the structure (may be relaxed from settings)
    const minTeamSize = structure.constraintOverrides?.minTeamSizeUsed || settings.minPlayersPerTeam;

    // Pass the special case flag to prevent false triggering of 37-player logic
    const isSpecial37 = roundConfig.specialCase === '37player';

    const round = generateFlexibleRound(playingPlayers, byePlayers, structure.courtsUsed, minTeamSize, roundNum, maxTeamSize, isSpecial37);
    allRounds.push(round);
    
    round.teams.forEach(team => {
      if (!team.is_bye_team) {
        recordTeammates(team);
        recordBPlayerSupport(team);
      }
    });
  });
  
  console.log('\n=== PRE-VALIDATION PLAYER MATCH ANALYSIS ===');
  const playerMatchCount = {};
  players.forEach(p => playerMatchCount[p.id] = 0);
  allRounds.forEach(round => {
    round.matches.forEach(match => {
      match.team1.players.forEach(player => playerMatchCount[player.id]++);
      match.team2.players.forEach(player => playerMatchCount[player.id]++);
    });
  });
  players.forEach(player => {
    const actual = playerMatchCount[player.id];
    if (actual !== settings.matchesPerPlayer) {
      console.error(`  ${player.name}: ${actual}/${settings.matchesPerPlayer} matches`);
    }
  });

  validateFlexibleTournament(players, allRounds, settings.matchesPerPlayer);

  logTeammateRotationStats(players);
  logBPlayerSupportStats(players);

  // ENHANCED: Validate team constraints
  console.log('\n=== Final Tournament Constraint Validation ===');
  const allTeams = allRounds.flatMap(round => round.teams.filter(t => !t.is_bye_team));
  const constraintValidation = validateAllTeamsConstraints(allTeams);
  
  console.log('\n=== Flexible Tournament Generation Complete ===');
  
  // ENHANCED: Return both rounds and validation results
  return {
    rounds: allRounds,
    validation: constraintValidation
  };
}

function logTeammateRotationStats(players) {
  console.log('\n=== Teammate Rotation Statistics ===');
  
  let totalPairings = 0;
  let repeatPairings = 0;
  let maxRepeats = 0;
  
  for (const playerId in tournamentTeammateHistory) {
    for (const teammateId in tournamentTeammateHistory[playerId]) {
      const count = tournamentTeammateHistory[playerId][teammateId];
      if (count > 0) {
        totalPairings++;
        if (count > 1) {
          repeatPairings++;
        }
        maxRepeats = Math.max(maxRepeats, count);
      }
    }
  }
  
  totalPairings = totalPairings / 2;
  repeatPairings = repeatPairings / 2;
  
  const repeatPercentage = totalPairings > 0 ? ((repeatPairings / totalPairings) * 100).toFixed(1) : 0;
  
  console.log(`Total unique pairings: ${totalPairings}`);
  console.log(`Repeat pairings: ${repeatPairings} (${repeatPercentage}%)`);
  console.log(`Maximum times any two players were teammates: ${maxRepeats}`);
  
  if (repeatPercentage < 20) {
    console.log('✅ Excellent teammate rotation - minimal repeats');
  } else if (repeatPercentage < 40) {
    console.log('✅ Good teammate rotation');
  } else {
    console.log('⚠️  High repeat pairing rate - consider algorithm improvements');
  }
}

function logBPlayerSupportStats(players) {
  const bPlayers = players.filter(p => p.skill_level === 'B');

  if (bPlayers.length === 0) {
    console.log('\n=== B Player Support Statistics ===');
    console.log('No B players in tournament');
    return;
  }

  console.log('\n=== B Player Support Statistics ===');
  console.log(`Total B players: ${bPlayers.length}`);

  const strongPlayers = players.filter(p => ['AA', 'A', 'BB'].includes(p.skill_level));
  console.log(`Strong players (AA/A/BB): ${strongPlayers.length}`);

  // Analyze variety of support for each B player
  let totalVariety = 0;
  let totalMaxRepeats = 0;

  bPlayers.forEach(bPlayer => {
    if (!bPlayerSupportHistory[bPlayer.id]) return;

    const supportCounts = Object.values(bPlayerSupportHistory[bPlayer.id]);
    const uniqueSupports = supportCounts.filter(c => c > 0).length;
    const maxRepeat = Math.max(...supportCounts, 0);
    const totalSupports = supportCounts.reduce((a, b) => a + b, 0);

    totalVariety += uniqueSupports;
    totalMaxRepeats += maxRepeat;

    // Find most frequent supporters for this B player
    const supporters = Object.entries(bPlayerSupportHistory[bPlayer.id])
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    const supporterNames = supporters.map(([id, count]) => {
      const supporter = strongPlayers.find(p => p.id == id);
      return supporter ? `${supporter.name} (${count}x)` : `Unknown (${count}x)`;
    }).join(', ');

    console.log(`  ${bPlayer.name} (${bPlayer.gender}): ${uniqueSupports} unique mentors, ${totalSupports} total support instances, max repeat: ${maxRepeat}`);
    if (supporterNames) {
      console.log(`    Top supporters: ${supporterNames}`);
    }
  });

  const avgVariety = totalVariety / bPlayers.length;
  const avgMaxRepeat = totalMaxRepeats / bPlayers.length;

  console.log(`\nAverage unique mentors per B player: ${avgVariety.toFixed(1)}`);
  console.log(`Average max repeat with same mentor: ${avgMaxRepeat.toFixed(1)}`);

  if (avgMaxRepeat <= 2) {
    console.log('✅ Excellent B player support variety - good mentor rotation');
  } else if (avgMaxRepeat <= 3) {
    console.log('✓ Good B player support variety');
  } else {
    console.log('⚠️  B players could benefit from more variety in mentors');
  }
}

function generateFlexibleRound(playingPlayers, byePlayers, courtsUsed, minPlayersPerTeam, roundNumber, maxPlayersPerTeam = 6, isSpecial37PlayerTournament = false) {
  const maxTeams = courtsUsed * 2;

  console.log(`\n=== Creating Flexible Round ${roundNumber} ===`);
  console.log(`Playing players: ${playingPlayers.length}, Courts available: ${courtsUsed}`);
  if (maxPlayersPerTeam === 7) {
    console.log(`🎯 Using 7-player max team size for this round`);
  }

  // Only use special 37-player logic if this is actually a 37-player tournament
  if (isSpecial37PlayerTournament && playingPlayers.length === 37 && courtsUsed === 3) {
    console.log(`🎯 Special 37-player round: creating 5 teams of 6 + 1 team of 7`);

    const teams = createSpecial37PlayerTeams(playingPlayers, roundNumber);
    const matches = createSpecial37PlayerMatches(teams);

    console.log(`Special round ${roundNumber} created: 6 teams (5×6 + 1×7), 3 matches`);

    return {
      roundNumber,
      teams,
      matches,
      byePlayers: [],
      totalPlayingPlayers: playingPlayers.length,
      totalByePlayers: 0,
      specialCase: true
    };
  }

  console.log(`\n=== Debug Round ${roundNumber} ===`);
  console.log(`Bye players (${byePlayers.length}):`, byePlayers.map(p => p.name));
  console.log(`Playing players (${playingPlayers.length}):`, playingPlayers.map(p => p.name));

  const byePlayerIds = new Set(byePlayers.map(p => p.id));
  const duplicates = playingPlayers.filter(p => byePlayerIds.has(p.id));
  if (duplicates.length > 0) {
    console.error(`❌ DUPLICATE PLAYERS FOUND:`, duplicates.map(p => p.name));
  }
  
  if (playingPlayers.length === 0) {
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
  
  let teamConfig = null;
  
  for (let teamCount = 2; teamCount <= maxTeams; teamCount += 2) {
    const avgTeamSize = playingPlayers.length / teamCount;
    
    if (avgTeamSize >= minPlayersPerTeam && avgTeamSize <= maxPlayersPerTeam) {
      const baseSize = Math.floor(avgTeamSize);
      const remainder = playingPlayers.length % teamCount;
      
      const teamSizes = [];
      for (let i = 0; i < teamCount; i++) {
        teamSizes.push(baseSize + (i < remainder ? 1 : 0));
      }
      
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
  
  console.log(`\n=== Team Creation Debug ===`);
  console.log(`Team config:`, teamConfig);
  console.log(`Playing players for team creation:`, playingPlayers.map(p => p.name));
  console.log(`Expected teams: ${teamConfig.teamCount}`);
  
  const teams = createBalancedTeams(playingPlayers, teamConfig, roundNumber);

  console.log(`\n=== Teams Created by createBalancedTeams ===`);
  teams.forEach((team, index) => {
    console.log(`Team ${index + 1}: ${team.players.length} players, is_bye_team: ${team.is_bye_team || false}, court: ${team.court}`);
    console.log(`  Players: ${team.players.map(p => p.name)}`);
  });
  console.log(`Total teams from createBalancedTeams: ${teams.length}`);

  console.log(`\n=== Teams Created ===`);
  teams.forEach((team, index) => {
    console.log(`Team ${index + 1}: ${team.players.length} players - ${team.players.map(p => p.name)}`);
  });
  
  const matches = createSimpleMatches(teams);
  
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

// Try to find a tournament solution using 7-player teams to reduce the number of rounds
// This is called when the standard 6-player solution requires more than matchesPerPlayer + 1 rounds
function trySevenPlayerTeamSolution(totalPlayers, totalPlayerMatches, settings, courtsToUse, targetMaxRounds, minTeamSize) {
  const maxPlayersPerTeam = 7; // Allow 7-player teams
  const maxTeamsPerRound = courtsToUse * 2;
  const minPlayersPerRound = maxTeamsPerRound * minTeamSize;
  const maxPlayersPerRound = maxTeamsPerRound * maxPlayersPerTeam;

  console.log(`   Attempting ${targetMaxRounds} rounds with 7-player max teams...`);
  console.log(`   Round constraints: ${minPlayersPerRound}-${maxPlayersPerRound} players per round`);

  // Helper function to check if players can form valid teams with 7-player max
  const canFormValidTeams7Player = (players, maxTeams, minPerTeam, maxPerTeam) => {
    for (let teamCount = 2; teamCount <= maxTeams; teamCount += 2) {
      const avgTeamSize = players / teamCount;

      if (avgTeamSize >= minPerTeam && avgTeamSize <= maxPerTeam) {
        const baseSize = Math.floor(avgTeamSize);
        const remainder = players % teamCount;
        const smallTeamSize = baseSize;
        const largeTeamSize = remainder > 0 ? baseSize + 1 : baseSize;

        if (smallTeamSize >= minPerTeam && largeTeamSize <= maxPerTeam) {
          return true;
        }
      }
    }
    return false;
  };

  // Try the target number of rounds
  const basePlayersPerRound = Math.floor(totalPlayerMatches / targetMaxRounds);
  const extraMatches = totalPlayerMatches % targetMaxRounds;

  const rounds = [];
  let isValid = true;

  for (let i = 0; i < targetMaxRounds; i++) {
    const playersThisRound = basePlayersPerRound + (i < extraMatches ? 1 : 0);

    if (playersThisRound < minPlayersPerRound || playersThisRound > maxPlayersPerRound) {
      console.log(`   Round ${i + 1}: ${playersThisRound} players - INVALID (out of range ${minPlayersPerRound}-${maxPlayersPerRound})`);
      isValid = false;
      break;
    }

    if (!canFormValidTeams7Player(playersThisRound, maxTeamsPerRound, minTeamSize, maxPlayersPerTeam)) {
      console.log(`   Round ${i + 1}: ${playersThisRound} players - INVALID (cannot form valid teams)`);
      isValid = false;
      break;
    }

    rounds.push({
      roundNumber: i + 1,
      playersPlaying: playersThisRound,
      playersBye: totalPlayers - playersThisRound,
      uses7PlayerTeams: true,
      teamConfiguration: {
        maxTeamSize: 7
      }
    });

    console.log(`   Round ${i + 1}: ${playersThisRound} playing, ${totalPlayers - playersThisRound} bye - VALID`);
  }

  if (!isValid) {
    return null;
  }

  const totalGenerated = rounds.reduce((sum, round) => sum + round.playersPlaying, 0);
  if (totalGenerated !== totalPlayerMatches) {
    console.log(`   Math error: generated ${totalGenerated}, needed ${totalPlayerMatches}`);
    return null;
  }

  return { rounds };
}

function calculateOptimalStructure(totalPlayers, settings) {
  console.log(`\n--- Match-Balanced Structure Calculation ---`);
  console.log(`Total players: ${totalPlayers}`);
  console.log(`Available courts: ${settings.courtsAvailable}`);
  console.log(`Matches per player: ${settings.matchesPerPlayer}`);
  console.log(`Min per team: ${settings.minPlayersPerTeam}`);

  // RESTRICTION: 37-player special case with 7-player teams
  // This ONLY applies to the exact scenario: 37 players, 3 courts, 4 matches per player, 5 min per team
  // This special case should NEVER trigger for any other player count or configuration
  // Maximum player count for any 7-player team feature: 45 players
  if (totalPlayers === 37 &&
      totalPlayers <= 45 &&
      settings.courtsAvailable === 3 &&
      settings.matchesPerPlayer === 4 &&
      settings.minPlayersPerTeam === 5) {

    console.log(`\n🎯 SPECIAL CASE: 37-player tournament with 7-player team override`);
    console.log(`Using constraint override: one team of 7 players per round`);
    console.log(`Restriction: This only applies to exactly 37 players with 3 courts, 4 matches/player, 5 min/team`);

    resetSpecial37PlayerTracking();

    const rounds = [];
    for (let i = 1; i <= 4; i++) {
      rounds.push({
        roundNumber: i,
        playersPlaying: 37,
        playersBye: 0,
        specialCase: '37player',
        teamConfiguration: {
          regularTeams: 5,
          oversizeTeams: 1,
          regularTeamSize: 6,
          oversizeTeamSize: 7
        }
      });
    }

    console.log(`✅ Special 37-player solution: 4 rounds, all players play every round`);
    console.log(`Each round: 5 teams of 6 + 1 team of 7 = 37 players total`);
    console.log(`Total player-matches: ${4 * 37} = 148 (exactly ${totalPlayers} × ${settings.matchesPerPlayer})`);

    return {
      courtsUsed: 3,
      flexibleRounds: rounds,
      specialCase: true,
      description: '37-player special case with one 7-player team per round'
    };
  }

  const totalPlayerMatches = totalPlayers * settings.matchesPerPlayer;
  console.log(`Total player-matches needed: ${totalPlayerMatches}`);

  // Override: For large tournaments (>45 players) with standard settings,
  // try 7-player teams first to avoid exceeding 5 rounds
  let maxPlayersPerTeam = 6;
  if (totalPlayers > 45 &&
      settings.courtsAvailable === 3 &&
      settings.matchesPerPlayer === 4 &&
      settings.minPlayersPerTeam === 5) {
    console.log(`\n🎯 LARGE TOURNAMENT OVERRIDE: ${totalPlayers} players > 45`);
    console.log(`Enabling 7-player teams to minimize rounds (target: ≤5 rounds)`);
    maxPlayersPerTeam = 7;
  }

  const canFormValidTeams = (totalPlayers, maxTeams, minPerTeam, maxPerTeam) => {
    for (let teamCount = 2; teamCount <= maxTeams; teamCount += 2) {
      const avgTeamSize = totalPlayers / teamCount;

      if (avgTeamSize >= minPerTeam && avgTeamSize <= maxPerTeam) {
        const baseSize = Math.floor(avgTeamSize);
        const remainder = totalPlayers % teamCount;
        const smallTeamSize = baseSize;
        const largeTeamSize = remainder > 0 ? baseSize + 1 : baseSize;

        if (smallTeamSize >= minPerTeam && largeTeamSize <= maxPerTeam) {
          return true;
        }
      }
    }
    return false;
  };

  const constraintOptions = [
    {
      minTeamSize: settings.minPlayersPerTeam,
      description: `${settings.minPlayersPerTeam} min players per team`
    },
    {
      minTeamSize: Math.max(4, settings.minPlayersPerTeam - 1),
      description: `${Math.max(4, settings.minPlayersPerTeam - 1)} min players per team (relaxed)`
    }
  ];

  // Track best solution found
  let bestSolution = null;
  let bestSolutionRounds = Infinity;
  const targetMaxRounds = settings.matchesPerPlayer + 1;

  constraintLoop: for (const constraintSet of constraintOptions) {
    console.log(`\nTrying with ${constraintSet.description}...`);
    
    for (let courtsToUse = settings.courtsAvailable; courtsToUse >= 1; courtsToUse--) {
      const maxTeamsPerRound = courtsToUse * 2;
      const minPlayersNeeded = maxTeamsPerRound * constraintSet.minTeamSize;
      
      if (totalPlayers < minPlayersNeeded) {
        console.log(`  Skipping ${courtsToUse} courts (need ${minPlayersNeeded}+ players)`);
        continue;
      }
      
      console.log(`  Trying ${courtsToUse} courts with ${constraintSet.description}...`);
      
      const maxPlayersPerRound = maxTeamsPerRound * maxPlayersPerTeam;
      const minPlayersPerRound = maxTeamsPerRound * constraintSet.minTeamSize;
      
      console.log(`    Round constraints: ${minPlayersPerRound}-${maxPlayersPerRound} players per round`);
      
      const minRoundsNeeded = Math.ceil(totalPlayerMatches / maxPlayersPerRound);
      const maxRoundsAllowed = Math.floor(totalPlayerMatches / minPlayersPerRound);
      
      if (minRoundsNeeded > maxRoundsAllowed) {
        console.log(`    ${courtsToUse} courts: impossible (need ${minRoundsNeeded} rounds, max ${maxRoundsAllowed})`);
        continue;
      }
      
      console.log(`    Testing ${minRoundsNeeded} to ${maxRoundsAllowed} rounds...`);
      
      for (let numRounds = minRoundsNeeded; numRounds <= maxRoundsAllowed; numRounds++) {
        console.log(`      Trying ${numRounds} rounds...`);
        
        const basePlayersPerRound = Math.floor(totalPlayerMatches / numRounds);
        const extraMatches = totalPlayerMatches % numRounds;
        
        console.log(`        Base: ${basePlayersPerRound} players/round, Extra: ${extraMatches}`);
        
        const rounds = [];
        let isValid = true;
        
        for (let i = 0; i < numRounds; i++) {
          const playersThisRound = basePlayersPerRound + (i < extraMatches ? 1 : 0);

          // CRITICAL: Cannot have more players in a round than total players in tournament
          if (playersThisRound > totalPlayers) {
            console.log(`        Round ${i + 1}: ${playersThisRound} players - INVALID (exceeds total players ${totalPlayers})`);
            isValid = false;
            break;
          }

          if (playersThisRound < minPlayersPerRound || playersThisRound > maxPlayersPerRound) {
            console.log(`        Round ${i + 1}: ${playersThisRound} players - INVALID (range)`);
            isValid = false;
            break;
          }

          if (!canFormValidTeams(playersThisRound, maxTeamsPerRound, constraintSet.minTeamSize, maxPlayersPerTeam)) {
            console.log(`        Round ${i + 1}: ${playersThisRound} players - INVALID (teams)`);
            isValid = false;
            break;
          }

          const roundConfig = {
            roundNumber: i + 1,
            playersPlaying: playersThisRound,
            playersBye: totalPlayers - playersThisRound
          };

          // Include team configuration if using 7-player teams
          if (maxPlayersPerTeam === 7) {
            roundConfig.teamConfiguration = {
              maxTeamSize: 7
            };
          }

          rounds.push(roundConfig);

          console.log(`        Round ${i + 1}: ${playersThisRound} playing, ${totalPlayers - playersThisRound} bye - VALID`);
        }
        
        if (isValid) {
          const totalGenerated = rounds.reduce((sum, round) => sum + round.playersPlaying, 0);
          
          if (totalGenerated !== totalPlayerMatches) {
            console.error(`Math error: generated ${totalGenerated}, needed ${totalPlayerMatches}`);
            continue;
          }
          
          const totalByes = rounds.reduce((sum, round) => sum + round.playersBye, 0);
          const avgByesPerPlayer = totalByes / totalPlayers;
          
          const usedConstraintOverride = constraintSet.minTeamSize < settings.minPlayersPerTeam;
          const usedCourtReduction = courtsToUse < settings.courtsAvailable;
          
          console.log(`\n✅ SOLUTION FOUND: ${numRounds} rounds, ${courtsToUse} courts`);
          console.log(`Total byes: ${totalByes}, Avg byes/player: ${avgByesPerPlayer.toFixed(2)}`);

          if (usedConstraintOverride || usedCourtReduction) {
            console.log(`⚠️  CONSTRAINT OVERRIDES USED:`);
            if (usedCourtReduction) {
              console.log(`   - Courts reduced: ${courtsToUse}/${settings.courtsAvailable} courts used`);
            }
            if (usedConstraintOverride) {
              console.log(`   - Min team size relaxed: ${constraintSet.minTeamSize} instead of ${settings.minPlayersPerTeam}`);
            }
          }

          // QUALITY CHECK: Prefer standard team size (5 min) even if it means one extra round
          // Only use relaxed constraints (4 min) if standard requires matchesPerPlayer + 2 or more rounds
          const hasExcessiveRounds = numRounds > targetMaxRounds;
          const isStandardConstraints = !usedConstraintOverride;

          // ALWAYS store valid solutions (even if excessive) so we have a fallback
          const currentSolution = {
            courtsUsed: courtsToUse,
            flexibleRounds: rounds,
            constraintOverrides: {
              minTeamSizeUsed: constraintSet.minTeamSize,
              courtsReduced: usedCourtReduction,
              teamSizeRelaxed: usedConstraintOverride
            },
            numRounds,
            isExcessive: hasExcessiveRounds,
            usesStandardConstraints: isStandardConstraints
          };

          // Update best solution if this is better
          if (numRounds < bestSolutionRounds) {
            bestSolution = currentSolution;
            bestSolutionRounds = numRounds;
            console.log(`💾 Stored as current best solution: ${numRounds} rounds`);
          }

          // Decide if we should stop searching or continue
          if (!hasExcessiveRounds) {
            // Solution has acceptable rounds - ideal, stop searching
            console.log(`✓ Acceptable round count: ${numRounds} ≤ ${targetMaxRounds} target - ending search`);
            break constraintLoop;
          } else if (isStandardConstraints) {
            // Has excessive rounds with standard constraints - continue to try relaxed
            console.log(`⚠️  ${numRounds} rounds exceeds target of ${targetMaxRounds} with standard constraints`);
            console.log(`   Solution stored as fallback, continuing search for relaxed constraints (4 min/team)...`);
            // Continue to next constraint option
            continue;
          } else {
            // Has excessive rounds with relaxed constraints - this is the best we can do
            console.log(`✓ Relaxed constraint solution: ${numRounds} rounds (exceeds ${targetMaxRounds} target, but best available)`);
            // Continue checking 7-player teams, but we have a fallback
          }

          // INTELLIGENT 7-PLAYER TEAM SUGGESTION SYSTEM
          // Check if using 7-player teams could prevent extra rounds
          if (hasExcessiveRounds && totalPlayers <= 45) {
            console.log(`\n🔍 Checking if 7-player teams could reduce rounds from ${numRounds} to ${targetMaxRounds}...`);

            // Try to find a solution with 7-player teams that achieves targetMaxRounds
            const with7PlayerTeamsSolution = trySevenPlayerTeamSolution(
              totalPlayers,
              totalPlayerMatches,
              settings,
              courtsToUse,
              targetMaxRounds,
              constraintSet.minTeamSize
            );

            if (with7PlayerTeamsSolution) {
              const sevenPlayerRounds = with7PlayerTeamsSolution.rounds.length;
              console.log(`✅ 7-PLAYER TEAM SOLUTION FOUND: ${sevenPlayerRounds} rounds (reduced from ${numRounds})`);
              console.log(`   Using 7-player teams can achieve the target of ${targetMaxRounds} rounds or less`);
              console.log(`   Rounds configuration: ${with7PlayerTeamsSolution.rounds.map(r => r.playersPlaying).join(', ')} players`);

              // Store 7-player team solution if better
              if (sevenPlayerRounds < bestSolutionRounds) {
                bestSolution = {
                  courtsUsed: courtsToUse,
                  flexibleRounds: with7PlayerTeamsSolution.rounds,
                  specialCase: true,
                  description: `Intelligent 7-player team solution to reduce rounds to ${sevenPlayerRounds}`,
                  constraintOverrides: {
                    minTeamSizeUsed: constraintSet.minTeamSize,
                    courtsReduced: usedCourtReduction,
                    teamSizeRelaxed: usedConstraintOverride,
                    uses7PlayerTeams: true
                  }
                };
                bestSolutionRounds = sevenPlayerRounds;
                console.log(`💾 7-player solution stored as best`);

                // If 7-player solution meets target, we're done
                if (sevenPlayerRounds <= targetMaxRounds) {
                  console.log(`✓ 7-player solution meets target - ending search`);
                  break constraintLoop;
                }
              }
            } else {
              console.log(`   ℹ️  7-player teams cannot reduce rounds to ${targetMaxRounds} for this configuration`);
            }
          }
        } else {
          console.log(`        ${numRounds} rounds doesn't work`);
        }
      }
    }
  }

  // Return the best solution found
  if (bestSolution) {
    console.log(`\n🏆 RETURNING BEST SOLUTION: ${bestSolutionRounds} rounds, ${bestSolution.courtsUsed} courts`);
    if (bestSolution.specialCase) {
      console.log(`   Special case: ${bestSolution.description}`);
    }
    return bestSolution;
  }

  console.error(`\n❌ NO SOLUTION FOUND`);
  console.error(`Even with constraint overrides:`);
  console.error(`- Courts: 1-${settings.courtsAvailable} tried`);
  console.error(`- Min team size: ${Math.max(4, settings.minPlayersPerTeam - 1)}-${settings.minPlayersPerTeam} tried`);
  console.error(`- Matches per player: ${settings.matchesPerPlayer} (non-negotiable)`);

  throw new Error(`Impossible tournament structure: ${totalPlayers} players cannot form valid tournament with any allowed constraint relaxation`);
}

function tryMixedCourtSolution(totalPlayers, totalPlayerMatches, settings, canFormValidTeams, maxPlayersPerTeam) {
  console.log(`Attempting mixed-court solution...`);
  
  const courtConfigs = [];
  for (let courts = 1; courts <= settings.courtsAvailable; courts++) {
    const maxTeams = courts * 2;
    const minPlayers = maxTeams * settings.minPlayersPerTeam;
    const maxPlayers = maxTeams * maxPlayersPerTeam;
    
    if (totalPlayers >= minPlayers) {
      courtConfigs.push({
        courts,
        minPlayers,
        maxPlayers,
        maxTeams
      });
    }
  }
  
  if (courtConfigs.length === 0) return null;
  
  console.log(`Available configurations: ${courtConfigs.map(c => `${c.courts}c(${c.minPlayers}-${c.maxPlayers})`).join(', ')}`);
  
  const rounds = [];
  let remainingMatches = totalPlayerMatches;
  let roundNumber = 1;
  
  while (remainingMatches > 0 && rounds.length < 15) {
    let bestRound = null;
    let bestScore = 0;
    
    for (const config of courtConfigs) {
      if (config.minPlayers > remainingMatches) continue;
      
      let playersThisRound = Math.min(remainingMatches, config.maxPlayers);
      playersThisRound = Math.max(playersThisRound, config.minPlayers);
      playersThisRound = Math.min(playersThisRound, totalPlayers);
      
      for (let testPlayers = playersThisRound; testPlayers >= config.minPlayers; testPlayers--) {
        if (canFormValidTeams(testPlayers, config.maxTeams, settings.minPlayersPerTeam, maxPlayersPerTeam)) {
          const score = testPlayers + (config.courts * 0.1);
          
          if (score > bestScore) {
            bestScore = score;
            bestRound = {
              roundNumber,
              playersPlaying: testPlayers,
              playersBye: totalPlayers - testPlayers,
              courtsUsed: config.courts
            };
          }
          break;
        }
      }
    }
    
    if (!bestRound) {
      console.log(`Cannot allocate remaining ${remainingMatches} matches`);
      return null;
    }
    
    rounds.push(bestRound);
    remainingMatches -= bestRound.playersPlaying;
    roundNumber++;
    
    console.log(`Mixed Round ${bestRound.roundNumber}: ${bestRound.playersPlaying} playing (${bestRound.courtsUsed} courts), ${bestRound.playersBye} bye`);
  }
  
  if (remainingMatches > 0) {
    console.log(`Mixed solution incomplete: ${remainingMatches} matches remaining`);
    return null;
  }
  
  console.log(`✅ Mixed-court solution: ${rounds.length} rounds`);
  return rounds;
}

function tryPlayerCentricSolution(totalPlayers, totalPlayerMatches, settings, canFormValidTeams, maxPlayersPerTeam) {
  console.log(`Attempting player-centric solution...`);
  
  const playerMatchesNeeded = new Array(totalPlayers).fill(settings.matchesPerPlayer);
  const rounds = [];
  let roundNumber = 1;
  
  const possibleRounds = [];
  for (let courts = 1; courts <= settings.courtsAvailable; courts++) {
    const maxTeams = courts * 2;
    const minPlayers = maxTeams * settings.minPlayersPerTeam;
    const maxPlayers = maxTeams * maxPlayersPerTeam;
    
    if (totalPlayers >= minPlayers) {
      for (let players = minPlayers; players <= Math.min(maxPlayers, totalPlayers); players++) {
        if (canFormValidTeams(players, maxTeams, settings.minPlayersPerTeam, maxPlayersPerTeam)) {
          possibleRounds.push({
            courts,
            players,
            efficiency: players / courts
          });
        }
      }
    }
  }
  
  possibleRounds.sort((a, b) => b.efficiency - a.efficiency);
  
  console.log(`Generated ${possibleRounds.length} possible round configurations`);
  
  while (playerMatchesNeeded.some(matches => matches > 0) && rounds.length < 20) {
    const totalRemainingMatches = playerMatchesNeeded.reduce((sum, matches) => sum + matches, 0);
    
    if (totalRemainingMatches === 0) break;
    
    let bestRound = null;
    let bestScore = 0;
    
    for (const config of possibleRounds) {
      if (config.players > totalRemainingMatches) continue;
      
      const score = Math.min(config.players, totalRemainingMatches) + (config.efficiency * 0.1);
      
      if (score > bestScore) {
        bestScore = score;
        bestRound = {
          roundNumber,
          playersPlaying: config.players,
          playersBye: totalPlayers - config.players,
          courtsUsed: config.courts
        };
      }
    }
    
    if (!bestRound) {
      console.log(`Cannot create round for remaining ${totalRemainingMatches} matches`);
      return null;
    }
    
    rounds.push(bestRound);
    
    const playersToDecrement = bestRound.playersPlaying;
    const playersWithNeed = playerMatchesNeeded
      .map((need, index) => ({ index, need }))
      .filter(p => p.need > 0)
      .sort((a, b) => b.need - a.need)
      .slice(0, playersToDecrement);
    
    playersWithNeed.forEach(player => {
      playerMatchesNeeded[player.index]--;
    });
    
    roundNumber++;
    
    const remaining = playerMatchesNeeded.reduce((sum, matches) => sum + matches, 0);
    console.log(`Player-centric Round ${bestRound.roundNumber}: ${bestRound.playersPlaying} playing (${bestRound.courtsUsed} courts), ${remaining} matches remaining`);
  }
  
  const finalRemaining = playerMatchesNeeded.reduce((sum, matches) => sum + matches, 0);
  if (finalRemaining > 0) {
    console.log(`Player-centric solution incomplete: ${finalRemaining} matches remaining`);
    return null;
  }
  
  console.log(`✅ Player-centric solution: ${rounds.length} rounds`);
  return rounds;
}

/**
 * Enhanced generateFlexibleByeSchedule with gender-balanced bye selection
 * Replace the existing function in teamGenerator.js with this version
 */

function generateFlexibleByeSchedule(players, flexibleRounds, finalByePlayerName = null, courtsUsed = 3) {
  console.log(`\n=== Robust Match-Guaranteed Bye Schedule (Gender-Balanced) ===`);

  if (players.length === 37 && flexibleRounds.length === 4 &&
      flexibleRounds.every(round => round.playersPlaying === 37)) {

    console.log(`🎯 Special 37-player case: no byes needed (all players play every round)`);

    return flexibleRounds.map((round, index) => {
      console.log(`Round ${index + 1} byes: none (all 37 players play)`);
      return [];
    });
  }

  const totalPlayers = players.length;
  const totalRounds = flexibleRounds.length;

  // Find the requested player for final bye if specified
  let finalByePlayer = null;
  if (finalByePlayerName) {
    finalByePlayer = players.find(p => p.name === finalByePlayerName);
    if (finalByePlayer) {
      console.log(`\n🎯 Final round bye requested for: ${finalByePlayerName}`);
    } else {
      console.log(`\n⚠️ Player "${finalByePlayerName}" not found in player list. Ignoring final bye request.`);
    }
  }
  
  const totalPlayerMatches = flexibleRounds.reduce((sum, round) => sum + round.playersPlaying, 0);
  const matchesPerPlayer = totalPlayerMatches / totalPlayers;
  
  console.log(`Total rounds: ${totalRounds}`);
  console.log(`Total player-matches: ${totalPlayerMatches}`);
  console.log(`Required matches per player: ${matchesPerPlayer}`);
  
  if (matchesPerPlayer !== Math.floor(matchesPerPlayer)) {
    throw new Error(`Invalid tournament structure: matches per player must be whole number, got ${matchesPerPlayer}`);
  }
  
  // Calculate overall gender distribution
  const totalMales = players.filter(p => p.gender === 'male').length;
  const totalFemales = players.filter(p => p.gender === 'female').length;
  const overallMalePercent = totalMales / totalPlayers;
  
  console.log(`\n=== Player Pool Gender Distribution ===`);
  console.log(`Males: ${totalMales} (${(overallMalePercent * 100).toFixed(1)}%)`);
  console.log(`Females: ${totalFemales} (${((1 - overallMalePercent) * 100).toFixed(1)}%)`);
  
  const playerRoundAssignments = {};
  players.forEach(player => {
    playerRoundAssignments[player.id] = {
      player: player,
      roundsPlaying: [],
      roundsOnBye: [],
      matchesAssigned: 0
    };
  });
  
  const femaleSetterByeCounts = {};
  const totalFemaleSetters = players.filter(p => p.gender === 'female' && p.is_setter).length;
  const femaleSetters = players.filter(p => p.gender === 'female' && p.is_setter);
  
  const totalFemaleSetterMatches = totalFemaleSetters * matchesPerPlayer;
  const totalFemaleSetterByes = totalFemaleSetters * totalRounds - totalFemaleSetterMatches;
  
  const minByesPerRound = Math.floor(totalFemaleSetterByes / totalRounds);
  const extraRoundsNeeded = totalFemaleSetterByes % totalRounds;
  
  console.log(`\n=== Female Setter Distribution Planning ===`);
  console.log(`Total female setters: ${totalFemaleSetters}`);
  console.log(`Total female setter matches needed: ${totalFemaleSetterMatches}`);
  console.log(`Total female setter byes needed: ${totalFemaleSetterByes}`);
  console.log(`Distribution strategy: ${totalRounds - extraRoundsNeeded} rounds with ${minByesPerRound}, ${extraRoundsNeeded} rounds with ${minByesPerRound + 1}`);
  
  players.forEach(player => {
    if (player.gender === 'female' && player.is_setter) {
      femaleSetterByeCounts[player.id] = 0;
    }
  });
  
  // Track bye composition for analysis
  const byeCompositionLog = [];
  
  for (let roundIndex = 0; roundIndex < totalRounds; roundIndex++) {
    const round = flexibleRounds[roundIndex];
    const playersNeeded = round.playersPlaying;
    const byesNeeded = totalPlayers - playersNeeded;
    const isFinalRound = (roundIndex === totalRounds - 1);

    console.log(`\n--- Assigning Round ${roundIndex + 1}: ${playersNeeded} players needed, ${byesNeeded} on bye ---`);

    // CRITICAL: Estimate team count for this round to ensure proper setter distribution
    // Courts are passed via courtsUsed parameter (default 3)
    const estimatedTeamsThisRound = courtsUsed * 2;

    console.log(`  Estimated teams this round: ${estimatedTeamsThisRound} (${courtsUsed} courts)`);

    // Check if we should force a specific player to bye in the final round
    let forcedByePlayer = null;
    if (isFinalRound && finalByePlayer && byesNeeded > 0) {
      const assignment = playerRoundAssignments[finalByePlayer.id];
      const matchesNeeded = matchesPerPlayer - assignment.matchesAssigned;
      const roundsAfterThis = totalRounds - roundIndex - 1; // Rounds remaining AFTER this one

      // Manual override: Force the bye as requested by user
      forcedByePlayer = finalByePlayer;

      if (matchesNeeded > roundsAfterThis) {
        console.log(`\n  🎯 Forcing ${finalByePlayer.name} to bye in final round`);
        console.log(`  ⚠️  WARNING: ${finalByePlayer.name} still needs ${matchesNeeded} match(es) but only ${roundsAfterThis} round(s) remain after this`);
        console.log(`  ⚠️  This player will not meet their match requirement (manual override)`);
      } else {
        console.log(`\n  🎯 Forcing ${finalByePlayer.name} to bye in final round (player has met match requirements)`);
      }
    }

    const shouldUseExtra = roundIndex >= (totalRounds - extraRoundsNeeded);
    const optimalFemaleSetterByes = shouldUseExtra ? (minByesPerRound + 1) : minByesPerRound;

    console.log(`  Optimal female setter byes this round: ${optimalFemaleSetterByes} (${shouldUseExtra ? 'using extra' : 'using minimum'})`);

    // Filter female setters for bye, excluding the forced bye player if they are a female setter
    const femaleSettersCanGoOnByeList = femaleSetters.filter(fs => {
      if (forcedByePlayer && fs.id === forcedByePlayer.id) return false; // Skip if already forced
      const assignment = playerRoundAssignments[fs.id];
      const matchesNeeded = matchesPerPlayer - assignment.matchesAssigned;
      const roundsLeft = totalRounds - roundIndex;

      return matchesNeeded < roundsLeft;
    });

    // ENHANCED: Calculate minimum setter byes needed to fit setters into teams
    // Goal: 1 setter per team (ideal), but if we have more setters than teams, some must get byes
    const settersAvailable = totalFemaleSetters - (forcedByePlayer && forcedByePlayer.gender === 'female' && forcedByePlayer.is_setter ? 1 : 0);
    const minSetterByesForTeamFit = Math.max(0, settersAvailable - estimatedTeamsThisRound);

    if (minSetterByesForTeamFit > 0) {
      console.log(`  ⚠️  ${settersAvailable} setters available but only ${estimatedTeamsThisRound} teams - need at least ${minSetterByesForTeamFit} setter bye(s)`);
    }

    // Adjust female setter bye slots if forced player is a female setter
    // FIXED: Ensure we give enough setter byes to fit remaining setters into teams (1 per team ideal)
    const maxByesAvailableForSetters = byesNeeded - (forcedByePlayer && forcedByePlayer.gender === 'female' && forcedByePlayer.is_setter ? 1 : 0);

    // Calculate desired setter byes: prioritize team fit over optimal distribution
    const desiredSetterByes = Math.max(minSetterByesForTeamFit, optimalFemaleSetterByes);

    // Clamp to constraints: can't exceed available setters or total byes
    let femaleSetterByeSlotsThisRound = Math.min(
      desiredSetterByes,
      femaleSettersCanGoOnByeList.length,
      maxByesAvailableForSetters
    );

    // Warn if we can't achieve ideal 1-setter-per-team distribution
    if (femaleSetterByeSlotsThisRound < minSetterByesForTeamFit) {
      console.log(`  ⚠️  WARNING: Cannot give enough setter byes (need ${minSetterByesForTeamFit}, can only give ${femaleSetterByeSlotsThisRound})`);
      console.log(`  ⚠️  Some teams will have multiple setters or no setters this round`);
    }

    console.log(`  Will put ${femaleSetterByeSlotsThisRound} female setter(s) on bye (${femaleSettersCanGoOnByeList.length} available, ${minSetterByesForTeamFit} required for team fit, ${desiredSetterByes} desired)`);

    const femaleSettersGoingOnBye = femaleSettersCanGoOnByeList
      .sort((a, b) => {
        const aCount = femaleSetterByeCounts[a.id] || 0;
        const bCount = femaleSetterByeCounts[b.id] || 0;
        if (aCount !== bCount) return aCount - bCount;

        const aMatches = playerRoundAssignments[a.id].matchesAssigned;
        const bMatches = playerRoundAssignments[b.id].matchesAssigned;
        if (aMatches !== bMatches) return bMatches - aMatches;

        return Math.random() - 0.5;
      })
      .slice(0, femaleSetterByeSlotsThisRound);

    // Add forced bye player if they are a female setter
    if (forcedByePlayer && forcedByePlayer.gender === 'female' && forcedByePlayer.is_setter) {
      femaleSettersGoingOnBye.push(forcedByePlayer);
    }
    
    const femaleSettersPlaying = femaleSetters.filter(fs => !femaleSettersGoingOnBye.includes(fs));
    
    console.log(`  Female setters playing (${femaleSettersPlaying.length}): ${femaleSettersPlaying.map(p => p.name).join(', ')}`);
    console.log(`  Female setters on bye (${femaleSettersGoingOnBye.length}): ${femaleSettersGoingOnBye.map(p => p.name).join(', ')}`);
    
    // ENHANCED: Gender-balanced bye selection for other players
    // WITH CONSTRAINT: Ensure enough males remain to have 2+ per team
    const otherPlayers = players.filter(p => !(p.gender === 'female' && p.is_setter));
    const otherByesNeeded = byesNeeded - femaleSettersGoingOnBye.length;

    console.log(`  Need ${otherByesNeeded} more bye slots from ${otherPlayers.length} other players`);

    // Calculate target gender distribution for remaining byes
    const otherMales = otherPlayers.filter(p => p.gender === 'male').length;
    const otherFemales = otherPlayers.filter(p => p.gender === 'female').length;
    const otherMalePercent = otherMales / (otherMales + otherFemales);

    // ENHANCED: Calculate max males that can go on bye to ensure 2 males per team
    // Estimate number of teams: playersPlaying / avgTeamSize (assume ~5.5)
    const estimatedTeams = Math.ceil(playersNeeded / 5.5);
    const malesNeededForTeams = estimatedTeams * 2; // Need at least 2 males per team
    const maxMalesOnBye = Math.max(0, totalMales - malesNeededForTeams);

    let targetMalesOnBye = Math.round(otherByesNeeded * otherMalePercent);
    // Cap male byes to ensure enough males remain for team composition
    if (targetMalesOnBye > maxMalesOnBye) {
      console.log(`  ⚠️  Reducing male byes from ${targetMalesOnBye} to ${maxMalesOnBye} to ensure 2 males per team`);
      targetMalesOnBye = maxMalesOnBye;
    }
    const targetFemalesOnBye = otherByesNeeded - targetMalesOnBye;
    
    console.log(`  Target other bye composition: ${targetMalesOnBye}M : ${targetFemalesOnBye}F (maintaining ${(otherMalePercent * 100).toFixed(1)}% male ratio)`);
    
    // Separate other players by gender and sort by priority for BYE selection
    // Priority for byes: players who CAN AFFORD a bye (have played more, need fewer matches)
    const sortByPriority = (a, b) => {
      const aAssignment = playerRoundAssignments[a.id];
      const bAssignment = playerRoundAssignments[b.id];

      const aMatchesNeeded = matchesPerPlayer - aAssignment.matchesAssigned;
      const bMatchesNeeded = matchesPerPlayer - bAssignment.matchesAssigned;
      const roundsRemaining = totalRounds - roundIndex;

      // PRIMARY: Can afford bye check - player MUST be able to skip this round
      // If a player needs X matches and there are Y rounds left, they can afford bye if X < Y
      const aCanAffordBye = aMatchesNeeded < roundsRemaining;
      const bCanAffordBye = bMatchesNeeded < roundsRemaining;

      if (aCanAffordBye !== bCanAffordBye) {
        // Prioritize players who CAN afford bye over those who CANNOT
        return aCanAffordBye ? -1 : 1;
      }

      // Both can afford or both cannot - use secondary criteria
      // Among those who can afford: prefer players with fewer matches needed (have played more)
      if (aMatchesNeeded !== bMatchesNeeded) {
        return aMatchesNeeded - bMatchesNeeded;
      }

      // Avoid consecutive play - prefer giving byes to players who just played
      const aLastRound = aAssignment.roundsPlaying.length > 0 ?
        Math.max(...aAssignment.roundsPlaying) : -2;
      const bLastRound = bAssignment.roundsPlaying.length > 0 ?
        Math.max(...bAssignment.roundsPlaying) : -2;

      const aIsConsecutive = (roundIndex - aLastRound) === 1;
      const bIsConsecutive = (roundIndex - bLastRound) === 1;

      if (aIsConsecutive !== bIsConsecutive) {
        return aIsConsecutive ? -1 : 1;
      }

      // Final tiebreaker: prefer players who have played more total matches
      if (aAssignment.matchesAssigned !== bAssignment.matchesAssigned) {
        return bAssignment.matchesAssigned - aAssignment.matchesAssigned;
      }

      return Math.random() - 0.5;
    };

    // Filter out the forced bye player from selection (if they're not a female setter)
    const isForcedPlayerOther = forcedByePlayer && !(forcedByePlayer.gender === 'female' && forcedByePlayer.is_setter);
    const malesSorted = otherPlayers.filter(p => {
      if (isForcedPlayerOther && p.id === forcedByePlayer.id) return false;
      return p.gender === 'male';
    }).sort(sortByPriority);
    const femalesSorted = otherPlayers.filter(p => {
      if (isForcedPlayerOther && p.id === forcedByePlayer.id) return false;
      return p.gender === 'female';
    }).sort(sortByPriority);

    // Adjust target counts if we have a forced bye player who is not a female setter
    let adjustedTargetMales = targetMalesOnBye;
    let adjustedTargetFemales = targetFemalesOnBye;
    if (isForcedPlayerOther) {
      if (forcedByePlayer.gender === 'male') {
        adjustedTargetMales = Math.max(0, targetMalesOnBye - 1);
      } else {
        adjustedTargetFemales = Math.max(0, targetFemalesOnBye - 1);
      }
    }

    // Select from each gender to maintain ratio
    const selectedMales = malesSorted.slice(0, Math.min(adjustedTargetMales, malesSorted.length));
    const selectedFemales = femalesSorted.slice(0, Math.min(adjustedTargetFemales, femalesSorted.length));

    let otherPlayersOnBye = [...selectedMales, ...selectedFemales];

    // Add the forced bye player if they're not a female setter
    if (isForcedPlayerOther) {
      otherPlayersOnBye.push(forcedByePlayer);
    }
    
    // If we're short, fill from the remaining pool
    if (otherPlayersOnBye.length < otherByesNeeded) {
      const remaining = otherPlayers.filter(p => 
        !otherPlayersOnBye.some(bye => bye.id === p.id)
      );
      remaining.sort(sortByPriority);
      const needed = otherByesNeeded - otherPlayersOnBye.length;
      otherPlayersOnBye.push(...remaining.slice(0, needed));
      console.log(`  Added ${needed} more players from remaining pool to reach ${otherByesNeeded} byes`);
    }
    
    // If we're over, trim (shouldn't happen but safety check)
    if (otherPlayersOnBye.length > otherByesNeeded) {
      console.warn(`  WARNING: Selected ${otherPlayersOnBye.length} but only need ${otherByesNeeded}, trimming excess`);
      otherPlayersOnBye = otherPlayersOnBye.slice(0, otherByesNeeded);
    }
    
    const actualOtherMales = otherPlayersOnBye.filter(p => p.gender === 'male').length;
    const actualOtherFemales = otherPlayersOnBye.filter(p => p.gender === 'female').length;
    
    console.log(`  Actual other bye composition: ${actualOtherMales}M : ${actualOtherFemales}F`);
    
    // Combine female setters and other players for final bye list
    const selectedPlayers = [...femaleSettersPlaying, ...otherPlayers.filter(p => 
      !otherPlayersOnBye.some(bye => bye.id === p.id)
    )];
    const byePlayers = [...femaleSettersGoingOnBye, ...otherPlayersOnBye];
    
    // Calculate total bye composition including female setters
    const totalByeMales = byePlayers.filter(p => p.gender === 'male').length;
    const totalByeFemales = byePlayers.filter(p => p.gender === 'female').length;
    const totalByeMalePercent = byePlayers.length > 0 ? totalByeMales / byePlayers.length : 0;
    const byeGenderDeviation = Math.abs(totalByeMalePercent - overallMalePercent) * 100;
    
    console.log(`  Total bye composition: ${totalByeMales}M : ${totalByeFemales}F (${(totalByeMalePercent * 100).toFixed(1)}% male)`);
    console.log(`  Deviation from overall: ${byeGenderDeviation.toFixed(1)}% ${byeGenderDeviation < 10 ? '✓ Good' : '⚠ Could be better'}`);
    
    // Log for summary
    byeCompositionLog.push({
      round: roundIndex + 1,
      byeMales: totalByeMales,
      byeFemales: totalByeFemales,
      byeMalePercent: totalByeMalePercent,
      deviation: byeGenderDeviation
    });
    
    if (selectedPlayers.length !== playersNeeded) {
      console.error(`ERROR: Selected ${selectedPlayers.length} players but needed ${playersNeeded}`);
    }
    
    if (byePlayers.length !== byesNeeded) {
      console.error(`ERROR: Selected ${byePlayers.length} bye players but needed ${byesNeeded}`);
    }
    
    selectedPlayers.forEach(player => {
      const assignment = playerRoundAssignments[player.id];
      assignment.roundsPlaying.push(roundIndex);
      assignment.matchesAssigned++;
    });
    
    byePlayers.forEach(player => {
      const assignment = playerRoundAssignments[player.id];
      assignment.roundsOnBye.push(roundIndex);
      if (femaleSetterByeCounts.hasOwnProperty(player.id)) {
        femaleSetterByeCounts[player.id]++;
      }
    });
    
    console.log(`  Final: ${selectedPlayers.length} playing, ${byePlayers.length} on bye`);
    
    const matchDistribution = {};
    players.forEach(player => {
      const matches = playerRoundAssignments[player.id].matchesAssigned;
      matchDistribution[matches] = (matchDistribution[matches] || 0) + 1;
    });
    console.log(`  Current match distribution:`, matchDistribution);
  }
  
  console.log(`\n=== Final Assignment Validation ===`);
  
  let validAssignments = 0;
  const errors = [];
  
  players.forEach(player => {
    const assignment = playerRoundAssignments[player.id];
    const actualMatches = assignment.matchesAssigned;
    
    if (actualMatches === matchesPerPlayer) {
      validAssignments++;
    } else {
      errors.push(`${player.name}: ${actualMatches}/${matchesPerPlayer} matches`);
    }
  });
  
  console.log(`Valid assignments: ${validAssignments}/${totalPlayers}`);
  
  if (errors.length > 0) {
    console.error(`Assignment errors:`);
    errors.forEach(error => console.error(`  ${error}`));
    
    if (tryFixAssignments(playerRoundAssignments, flexibleRounds, matchesPerPlayer, players, courtsUsed)) {
      console.log(`✅ Assignment fixed through redistribution`);
    } else {
      throw new Error(`Cannot create valid bye schedule: ${errors.length} players have incorrect match counts`);
    }
  }
  
  const byeSchedule = [];
  for (let roundIndex = 0; roundIndex < totalRounds; roundIndex++) {
    const byePlayers = [];
    
    players.forEach(player => {
      const assignment = playerRoundAssignments[player.id];
      if (assignment.roundsOnBye.includes(roundIndex)) {
        byePlayers.push(player);
      }
    });
    
    byeSchedule.push(byePlayers);
    console.log(`Round ${roundIndex + 1} byes: ${byePlayers.length} players (${byePlayers.map(p => p.name).join(', ')})`);
  }
  
  const finalValidation = validateByeScheduleCorrectness(players, byeSchedule, flexibleRounds, matchesPerPlayer);
  if (!finalValidation.isValid) {
    throw new Error(`Bye schedule validation failed: ${finalValidation.errors.join(', ')}`);
  }
  
  // ENHANCED: Bye Gender Balance Summary
  console.log(`\n=== Bye Gender Balance Summary ===`);
  console.log(`Overall player pool: ${totalMales}M (${(overallMalePercent * 100).toFixed(1)}%) : ${totalFemales}F (${((1 - overallMalePercent) * 100).toFixed(1)}%)`);
  console.log(`\nRound-by-round bye composition:`);
  
  let totalDeviation = 0;
  let maxDeviation = 0;
  let roundsWithGoodBalance = 0;
  
  byeCompositionLog.forEach((log, index) => {
    const status = log.deviation < 10 ? '✓ Good' : log.deviation < 15 ? '○ OK' : '⚠ Poor';
    console.log(`  Round ${log.round}: ${log.byeMales}M : ${log.byeFemales}F (${(log.byeMalePercent * 100).toFixed(1)}% male) - Deviation: ${log.deviation.toFixed(1)}% ${status}`);
    
    totalDeviation += log.deviation;
    maxDeviation = Math.max(maxDeviation, log.deviation);
    if (log.deviation < 10) roundsWithGoodBalance++;
  });
  
  const avgDeviation = totalDeviation / byeCompositionLog.length;
  const balanceQuality = roundsWithGoodBalance / byeCompositionLog.length * 100;
  
  console.log(`\nOverall bye balance quality:`);
  console.log(`  Average deviation: ${avgDeviation.toFixed(1)}%`);
  console.log(`  Max deviation: ${maxDeviation.toFixed(1)}%`);
  console.log(`  Rounds with good balance (<10%): ${roundsWithGoodBalance}/${byeCompositionLog.length} (${balanceQuality.toFixed(0)}%)`);
  
  if (avgDeviation < 8) {
    console.log(`  ✅ Excellent bye gender balance`);
  } else if (avgDeviation < 12) {
    console.log(`  ✅ Good bye gender balance`);
  } else if (avgDeviation < 18) {
    console.log(`  ○ Acceptable bye gender balance`);
  } else {
    console.log(`  ⚠️  Bye gender balance could be improved`);
  }
  
  if (totalFemaleSetters > 0) {
    console.log(`\n=== Female Setter Distribution Summary ===`);
    console.log(`Total female setters: ${totalFemaleSetters}`);
    console.log(`Total byes distributed: ${totalFemaleSetterByes}`);
    console.log(`Target: ${totalRounds - extraRoundsNeeded} rounds with ${minByesPerRound}, ${extraRoundsNeeded} rounds with ${minByesPerRound + 1}`);
    console.log(`Actual distribution across ${totalRounds} rounds:`);
    
    const distribution = [];
    
    byeSchedule.forEach((roundByes, index) => {
      const femaleSettersInBye = roundByes.filter(p => p.gender === 'female' && p.is_setter);
      const count = femaleSettersInBye.length;
      distribution.push(count);
      
      const expected = index >= (totalRounds - extraRoundsNeeded) ? (minByesPerRound + 1) : minByesPerRound;
      const status = count === expected ? '✓ perfect' : count <= (minByesPerRound + 1) ? '✓ acceptable' : '❌ too many';
      
      console.log(`  Round ${index + 1}: ${count} female setter(s) on bye ${status}`);
    });
    
    console.log(`\nDistribution pattern: ${distribution.join(', ')}`);
    
    const mean = distribution.reduce((sum, val) => sum + val, 0) / distribution.length;
    const variance = distribution.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / distribution.length;
    console.log(`Distribution variance: ${variance.toFixed(3)} (lower is more even, 0.16 is optimal for this scenario)`);
    
    const femaleSetterPlayers = players.filter(p => p.gender === 'female' && p.is_setter);
    console.log(`\nIndividual female setter bye counts:`);
    femaleSetterPlayers.forEach(player => {
      const byeCount = femaleSetterByeCounts[player.id];
      const rounds = playerRoundAssignments[player.id].roundsOnBye.map(r => r + 1).join(', ');
      const expected = Math.floor(totalFemaleSetterByes / totalFemaleSetters);
      const extra = totalFemaleSetterByes % totalFemaleSetters;
      const target = expected + (extra > 0 ? 1 : 0);
      console.log(`  ${player.name}: ${byeCount} bye(s) in round(s) ${rounds || 'none'} (target: ${expected}${extra > 0 ? '-' + target : ''})`);
    });
    
    if (variance < 0.25) {
      console.log(`\n✅ Female setter distribution OPTIMAL (variance ${variance.toFixed(3)} < 0.25)`);
    } else {
      console.log(`\n⚠️  Female setter distribution could be better (variance ${variance.toFixed(3)})`);
    }
  }
  
  console.log(`✅ Robust bye schedule created successfully`);
  return byeSchedule;
}

// Helper functions (should already exist in teamGenerator.js)
// Included here for completeness

function tryFixAssignments(playerRoundAssignments, flexibleRounds, matchesPerPlayer, players, courtsUsed = 3) {
  console.log(`\nAttempting to fix assignment imbalances...`);

  const overAssigned = [];
  const underAssigned = [];
  
  players.forEach(player => {
    const assignment = playerRoundAssignments[player.id];
    const actualMatches = assignment.matchesAssigned;
    
    if (actualMatches > matchesPerPlayer) {
      overAssigned.push({ player, excess: actualMatches - matchesPerPlayer, assignment });
    } else if (actualMatches < matchesPerPlayer) {
      underAssigned.push({ player, deficit: matchesPerPlayer - actualMatches, assignment });
    }
  });
  
  console.log(`Over-assigned: ${overAssigned.length}, Under-assigned: ${underAssigned.length}`);
  
  if (overAssigned.length === 0 || underAssigned.length === 0) {
    return false;
  }
  
  let fixAttempts = 0;
  const maxAttempts = 50;
  
  while (overAssigned.length > 0 && underAssigned.length > 0 && fixAttempts < maxAttempts) {
    fixAttempts++;
    
    const overPlayer = overAssigned[0];
    const underPlayer = underAssigned[0];
    
    let swapRound = -1;
    
    for (const roundIndex of overPlayer.assignment.roundsPlaying) {
      if (underPlayer.assignment.roundsOnBye.includes(roundIndex)) {
        swapRound = roundIndex;
        break;
      }
    }

    if (swapRound >= 0) {
      // ENHANCED: Check if swap would violate minimum males per team constraint
      const round = flexibleRounds[swapRound];

      // Build current bye list from player assignments
      const currentByePlayers = players.filter(p =>
        playerRoundAssignments[p.id].roundsOnBye.includes(swapRound)
      );

      // Calculate males playing after this potential swap
      const currentByeMales = currentByePlayers.filter(p => p.gender === 'male').length;
      const totalMales = players.filter(p => p.gender === 'male').length;

      let malesPlayingAfterSwap = totalMales - currentByeMales;

      // Adjust for the gender swap effect
      if (overPlayer.player.gender === 'male' && underPlayer.player.gender !== 'male') {
        malesPlayingAfterSwap--;  // Swapping a male out of playing
      } else if (overPlayer.player.gender !== 'male' && underPlayer.player.gender === 'male') {
        malesPlayingAfterSwap++;  // Swapping a male into playing
      }

      // Calculate teams for this round and check constraint
      // Use actual courts used, not estimation from player count
      const maxTeamsInRound = courtsUsed * 2;
      const estimatedTeams = Math.min(maxTeamsInRound, Math.ceil(round.playersPlaying / 5));
      const minMalesNeeded = estimatedTeams * 2;

      if (malesPlayingAfterSwap < minMalesNeeded) {
        console.log(`  ⚠️  Skipping swap of ${overPlayer.player.name} and ${underPlayer.player.name} in round ${swapRound + 1} - would leave only ${malesPlayingAfterSwap}/${minMalesNeeded} males needed for ${estimatedTeams} teams`);
        // Skip this swap, try next combination
        overAssigned.push(overAssigned.shift());
        if (overAssigned.length === 1) {
          underAssigned.push(underAssigned.shift());
        }
      } else {
        console.log(`  Swapping ${overPlayer.player.name} and ${underPlayer.player.name} in round ${swapRound + 1}`);

        overPlayer.assignment.roundsPlaying = overPlayer.assignment.roundsPlaying.filter(r => r !== swapRound);
        overPlayer.assignment.roundsOnBye.push(swapRound);
        overPlayer.assignment.matchesAssigned--;

        underPlayer.assignment.roundsOnBye = underPlayer.assignment.roundsOnBye.filter(r => r !== swapRound);
        underPlayer.assignment.roundsPlaying.push(swapRound);
        underPlayer.assignment.matchesAssigned++;

        overPlayer.excess--;
        underPlayer.deficit--;

        if (overPlayer.excess === 0) {
          overAssigned.shift();
        }
        if (underPlayer.deficit === 0) {
          underAssigned.shift();
        }
      }
    } else {
      overAssigned.push(overAssigned.shift());
      if (overAssigned.length === 1) {
        underAssigned.push(underAssigned.shift());
      }
    }
  }
  
  const remainingImbalances = overAssigned.length + underAssigned.length;
  console.log(`Fix completed: ${remainingImbalances} remaining imbalances after ${fixAttempts} attempts`);
  
  return remainingImbalances === 0;
}

function validateByeScheduleCorrectness(players, byeSchedule, flexibleRounds, expectedMatchesPerPlayer) {
  const errors = [];
  const playerMatchCounts = {};
  
  players.forEach(player => {
    playerMatchCounts[player.id] = 0;
  });
  
  byeSchedule.forEach((roundByes, roundIndex) => {
    const round = flexibleRounds[roundIndex];
    const byePlayerIds = new Set(roundByes.map(p => p.id));
    
    const playingPlayers = players.filter(player => !byePlayerIds.has(player.id));
    
    if (playingPlayers.length !== round.playersPlaying) {
      errors.push(`Round ${roundIndex + 1}: expected ${round.playersPlaying} players, got ${playingPlayers.length}`);
    }
    
    playingPlayers.forEach(player => {
      playerMatchCounts[player.id]++;
    });
  });
  
  players.forEach(player => {
    const actualMatches = playerMatchCounts[player.id];
    if (actualMatches !== expectedMatchesPerPlayer) {
      errors.push(`${player.name}: ${actualMatches}/${expectedMatchesPerPlayer} matches`);
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors: errors
  };
}

function tryFixAssignments(playerRoundAssignments, flexibleRounds, matchesPerPlayer, players, courtsUsed = 3) {
  console.log(`\nAttempting to fix assignment imbalances...`);

  const overAssigned = [];
  const underAssigned = [];
  
  players.forEach(player => {
    const assignment = playerRoundAssignments[player.id];
    const actualMatches = assignment.matchesAssigned;
    
    if (actualMatches > matchesPerPlayer) {
      overAssigned.push({ player, excess: actualMatches - matchesPerPlayer, assignment });
    } else if (actualMatches < matchesPerPlayer) {
      underAssigned.push({ player, deficit: matchesPerPlayer - actualMatches, assignment });
    }
  });
  
  console.log(`Over-assigned: ${overAssigned.length}, Under-assigned: ${underAssigned.length}`);
  
  if (overAssigned.length === 0 || underAssigned.length === 0) {
    return false;
  }
  
  let fixAttempts = 0;
  const maxAttempts = 50;
  
  while (overAssigned.length > 0 && underAssigned.length > 0 && fixAttempts < maxAttempts) {
    fixAttempts++;
    
    const overPlayer = overAssigned[0];
    const underPlayer = underAssigned[0];
    
    let swapRound = -1;
    
    for (const roundIndex of overPlayer.assignment.roundsPlaying) {
      if (underPlayer.assignment.roundsOnBye.includes(roundIndex)) {
        swapRound = roundIndex;
        break;
      }
    }

    if (swapRound >= 0) {
      // ENHANCED: Check if swap would violate minimum males per team constraint
      const round = flexibleRounds[swapRound];

      // Build current bye list from player assignments
      const currentByePlayers = players.filter(p =>
        playerRoundAssignments[p.id].roundsOnBye.includes(swapRound)
      );

      // Calculate males playing after this potential swap
      const currentByeMales = currentByePlayers.filter(p => p.gender === 'male').length;
      const totalMales = players.filter(p => p.gender === 'male').length;

      let malesPlayingAfterSwap = totalMales - currentByeMales;

      // Adjust for the gender swap effect
      if (overPlayer.player.gender === 'male' && underPlayer.player.gender !== 'male') {
        malesPlayingAfterSwap--;  // Swapping a male out of playing
      } else if (overPlayer.player.gender !== 'male' && underPlayer.player.gender === 'male') {
        malesPlayingAfterSwap++;  // Swapping a male into playing
      }

      // Calculate teams for this round and check constraint
      // Use actual courts used, not estimation from player count
      const maxTeamsInRound = courtsUsed * 2;
      const estimatedTeams = Math.min(maxTeamsInRound, Math.ceil(round.playersPlaying / 5));
      const minMalesNeeded = estimatedTeams * 2;

      if (malesPlayingAfterSwap < minMalesNeeded) {
        console.log(`  ⚠️  Skipping swap of ${overPlayer.player.name} and ${underPlayer.player.name} in round ${swapRound + 1} - would leave only ${malesPlayingAfterSwap}/${minMalesNeeded} males needed for ${estimatedTeams} teams`);
        // Skip this swap, try next combination
        overAssigned.push(overAssigned.shift());
        if (overAssigned.length === 1) {
          underAssigned.push(underAssigned.shift());
        }
      } else {
        console.log(`  Swapping ${overPlayer.player.name} and ${underPlayer.player.name} in round ${swapRound + 1}`);

        overPlayer.assignment.roundsPlaying = overPlayer.assignment.roundsPlaying.filter(r => r !== swapRound);
        overPlayer.assignment.roundsOnBye.push(swapRound);
        overPlayer.assignment.matchesAssigned--;

        underPlayer.assignment.roundsOnBye = underPlayer.assignment.roundsOnBye.filter(r => r !== swapRound);
        underPlayer.assignment.roundsPlaying.push(swapRound);
        underPlayer.assignment.matchesAssigned++;

        overPlayer.excess--;
        underPlayer.deficit--;

        if (overPlayer.excess === 0) {
          overAssigned.shift();
        }
        if (underPlayer.deficit === 0) {
          underAssigned.shift();
        }
      }
    } else {
      overAssigned.push(overAssigned.shift());
      if (overAssigned.length === 1) {
        underAssigned.push(underAssigned.shift());
      }
    }
  }
  
  const remainingImbalances = overAssigned.length + underAssigned.length;
  console.log(`Fix completed: ${remainingImbalances} remaining imbalances after ${fixAttempts} attempts`);
  
  return remainingImbalances === 0;
}

function validateByeScheduleCorrectness(players, byeSchedule, flexibleRounds, expectedMatchesPerPlayer) {
  const errors = [];
  const playerMatchCounts = {};
  
  players.forEach(player => {
    playerMatchCounts[player.id] = 0;
  });
  
  byeSchedule.forEach((roundByes, roundIndex) => {
    const round = flexibleRounds[roundIndex];
    const byePlayerIds = new Set(roundByes.map(p => p.id));
    
    const playingPlayers = players.filter(player => !byePlayerIds.has(player.id));
    
    if (playingPlayers.length !== round.playersPlaying) {
      errors.push(`Round ${roundIndex + 1}: expected ${round.playersPlaying} players, got ${playingPlayers.length}`);
    }
    
    playingPlayers.forEach(player => {
      playerMatchCounts[player.id]++;
    });
  });
  
  players.forEach(player => {
    const actualMatches = playerMatchCounts[player.id];
    if (actualMatches !== expectedMatchesPerPlayer) {
      errors.push(`${player.name}: ${actualMatches}/${expectedMatchesPerPlayer} matches`);
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors: errors
  };
}

function selectFlexibleByeCandidates(players, roundIndex, byesNeeded, playerByeCount, playerTargetByes, playerLastByeRound) {
  let candidates = [...players];
  
  candidates.sort((a, b) => {
    const aByeCount = playerByeCount[a.id];
    const bByeCount = playerByeCount[b.id];
    const aNeedsBye = aByeCount < playerTargetByes[a.id];
    const bNeedsBye = bByeCount < playerTargetByes[b.id];
    
    if (aNeedsBye !== bNeedsBye) {
      return aNeedsBye ? -1 : 1;
    }
    
    const aLastBye = playerLastByeRound[a.id];
    const bLastBye = playerLastByeRound[b.id];
    const aIsConsecutive = (roundIndex - aLastBye) === 1;
    const bIsConsecutive = (roundIndex - bLastBye) === 1;
    
    if (aIsConsecutive !== bIsConsecutive) {
      return aIsConsecutive ? 1 : -1;
    }
    
    const aIsFemaleSet = a.gender === 'female' && a.is_setter;
    const bIsFemaleSet = b.gender === 'female' && b.is_setter;
    
    if (aIsFemaleSet !== bIsFemaleSet) {
      return aIsFemaleSet ? 1 : -1;
    }
    
    if (aByeCount !== bByeCount) {
      return aByeCount - bByeCount;
    }
    
    const aGap = roundIndex - aLastBye;
    const bGap = roundIndex - bLastBye;
    return bGap - aGap;
  });
  
  return candidates.slice(0, byesNeeded);
}

function validateFlexibleByeSchedule(players, schedule, playerTargetByes, flexibleRounds) {
  console.log('\n=== Flexible Bye Schedule Validation ===');
  
  const playerByeCount = {};
  players.forEach(p => playerByeCount[p.id] = 0);
  
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
  for (let teamCount = 2; teamCount <= maxTeams; teamCount += 2) {
    const avgTeamSize = totalPlayers / teamCount;
    
    if (avgTeamSize >= minPerTeam && avgTeamSize <= maxPerTeam) {
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
  
  shuffledPlayers.forEach(player => {
    playerByeCount[player.id] = 0;
    playerLastByeRound[player.id] = -2;
  });
  
  const totalByeSlots = totalRounds * byesPerRound;
  const baseByesPerPlayer = Math.floor(totalByeSlots / players.length);
  const extraByeSlots = totalByeSlots % players.length;
  
  const playerTargetByes = {};
  shuffledPlayers.forEach((player, index) => {
    const minimumByes = 1;
    const calculatedTarget = baseByesPerPlayer + (index < extraByeSlots ? 1 : 0);
    playerTargetByes[player.id] = Math.max(minimumByes, calculatedTarget);
  });
  
  console.log(`Target distribution: ${baseByesPerPlayer} base byes per player, ${extraByeSlots} players get +1 bye`);
  console.log(`Minimum bye requirement: Everyone gets at least 1 bye`);
  
  const playersWithoutByes = new Set(shuffledPlayers.map(p => p.id));
  let currentRound = 0;
  
  console.log('\n--- Phase 1: Ensuring everyone gets at least one bye ---');
  
  while (playersWithoutByes.size > 0 && currentRound < totalRounds - 1) {
    const roundIndex = currentRound;
    console.log(`\n--- Assigning Round ${roundIndex + 1} byes (ensuring minimum) ---`);
    
    const candidates = selectByeCandidatesWithMinimumByeRequirement(
      shuffledPlayers,
      roundIndex,
      byesPerRound,
      playerByeCount,
      playerTargetByes,
      playerLastByeRound,
      playersWithoutByes
    );
    
    candidates.forEach(player => {
      playerByeCount[player.id]++;
      playerLastByeRound[player.id] = roundIndex;
      playersWithoutByes.delete(player.id);
    });
    
    schedule[roundIndex] = candidates;
    console.log(`Round ${roundIndex + 1} byes: ${candidates.map(p => p.name).join(', ')}`);
    console.log(`Players still needing first bye: ${playersWithoutByes.size}`);
    
    currentRound++;
  }
  
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
  
  const finalRoundIndex = totalRounds - 1;
  console.log(`\n--- Assigning Final Round ${totalRounds} byes (largest bye round) ---`);
  
  const playersNeedingFinalByes = shuffledPlayers.filter(player => 
    playerByeCount[player.id] < playerTargetByes[player.id]
  );
  
  const playersStillWithoutByes = shuffledPlayers.filter(player => 
    playerByeCount[player.id] === 0
  );
  
  let finalRoundCandidates = [...playersStillWithoutByes, ...playersNeedingFinalByes.filter(
    p => !playersStillWithoutByes.some(without => without.id === p.id)
  )];
  
  const maxPreviousRoundByes = Math.max(...schedule.slice(0, -1).map(round => round.length));
  const minFinalRoundByes = Math.max(byesPerRound, maxPreviousRoundByes + 1, finalRoundCandidates.length);
  
  if (finalRoundCandidates.length < minFinalRoundByes) {
    const additionalPlayers = shuffledPlayers
      .filter(p => !finalRoundCandidates.some(candidate => candidate.id === p.id))
      .sort((a, b) => {
        const aIsConsecutive = (finalRoundIndex - playerLastByeRound[a.id]) === 1;
        const bIsConsecutive = (finalRoundIndex - playerLastByeRound[b.id]) === 1;
        
        if (aIsConsecutive !== bIsConsecutive) {
          return aIsConsecutive ? 1 : -1;
        }
        
        return playerByeCount[a.id] - playerByeCount[b.id];
      })
      .slice(0, minFinalRoundByes - finalRoundCandidates.length);
    
    finalRoundCandidates.push(...additionalPlayers);
  }
  
  finalRoundCandidates.forEach(player => {
    playerByeCount[player.id]++;
    playerLastByeRound[player.id] = finalRoundIndex;
  });
  
  schedule[finalRoundIndex] = finalRoundCandidates;
  
  console.log(`Final round ${totalRounds} byes: ${finalRoundCandidates.map(p => p.name).join(', ')}`);
  console.log(`Final round bye count: ${finalRoundCandidates.length} (largest: ${finalRoundCandidates.length >= maxPreviousRoundByes ? 'YES' : 'NO'})`);
  
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
  let candidates = [...players];
  
  candidates.sort((a, b) => {
    const aHasNoByes = playersWithoutByes.has(a.id);
    const bHasNoByes = playersWithoutByes.has(b.id);
    
    if (aHasNoByes !== bHasNoByes) {
      return aHasNoByes ? -1 : 1;
    }
    
    const aLastBye = playerLastByeRound[a.id];
    const bLastBye = playerLastByeRound[b.id];
    const aIsConsecutive = (roundIndex - aLastBye) === 1;
    const bIsConsecutive = (roundIndex - bLastBye) === 1;
    
    if (aIsConsecutive !== bIsConsecutive) {
      return aIsConsecutive ? 1 : -1;
    }
    
    const aIsFemaleSet = a.gender === 'female' && a.is_setter;
    const bIsFemaleSet = b.gender === 'female' && b.is_setter;
    
    if (aIsFemaleSet !== bIsFemaleSet) {
      return aIsFemaleSet ? 1 : -1;
    }
    
    const aNeed = Math.max(0, playerTargetByes[a.id] - playerByeCount[a.id]);
    const bNeed = Math.max(0, playerTargetByes[b.id] - playerByeCount[b.id]);
    if (aNeed !== bNeed) {
      return bNeed - aNeed;
    }
    
    const aGap = roundIndex - aLastBye;
    const bGap = roundIndex - bLastBye;
    return bGap - aGap;
  });
  
  const selectedCandidates = candidates.slice(0, byesNeeded);
  
  const playersGettingFirstBye = selectedCandidates.filter(p => playersWithoutByes.has(p.id)).length;
  
  console.log(`  Players getting their first bye: ${playersGettingFirstBye}/${byesNeeded}`);
  
  return selectedCandidates;
}

function validateMinimumByeRequirement(players, schedule) {
  console.log('\n=== Minimum Bye Requirement Validation ===');
  
  const playerByeCount = {};
  players.forEach(p => playerByeCount[p.id] = 0);
  
  schedule.forEach((roundByes) => {
    roundByes.forEach(player => {
      playerByeCount[player.id]++;
    });
  });
  
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
  let candidates = [...players];
  
  candidates.sort((a, b) => {
    const aLastBye = playerLastByeRound[a.id];
    const bLastBye = playerLastByeRound[b.id];
    const aIsConsecutive = (roundIndex - aLastBye) === 1;
    const bIsConsecutive = (roundIndex - bLastBye) === 1;
    
    if (aIsConsecutive !== bIsConsecutive) {
      return aIsConsecutive ? 1 : -1;
    }
    
    const aIsFemaleSet = a.gender === 'female' && a.is_setter;
    const bIsFemaleSet = b.gender === 'female' && b.is_setter;
    
    if (aIsFemaleSet !== bIsFemaleSet) {
      return aIsFemaleSet ? 1 : -1;
    }
    
    const aNeed = Math.max(0, playerTargetByes[a.id] - playerByeCount[a.id]);
    const bNeed = Math.max(0, playerTargetByes[b.id] - playerByeCount[b.id]);
    if (aNeed !== bNeed) {
      return bNeed - aNeed;
    }
    
    if (playerByeCount[a.id] !== playerByeCount[b.id]) {
      return playerByeCount[a.id] - playerByeCount[b.id];
    }
    
    const aGap = roundIndex - aLastBye;
    const bGap = roundIndex - bLastBye;
    return bGap - aGap;
  });
  
  const selectedCandidates = candidates.slice(0, byesNeeded);
  
  const consecutiveCount = selectedCandidates.filter(player => {
    const lastBye = playerLastByeRound[player.id];
    return (roundIndex - lastBye) === 1;
  }).length;
  
  const femaleSetterCount = selectedCandidates.filter(player => 
    player.gender === 'female' && player.is_setter
  ).length;
  
  const totalFemaleSetters = players.filter(p => p.gender === 'female' && p.is_setter).length;
  
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
  
  schedule.forEach((roundByes) => {
    roundByes.forEach(player => {
      playerByeCount[player.id]++;
    });
  });
  
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

function generateRound(playingPlayers, byePlayers, structure, roundNumber, roundStructure = null) {
  // Check if this is the special 37-player case with 7-player teams
  const is37PlayerSpecialCase = roundStructure?.specialCase === '37player';
  const maxPlayersPerTeam = is37PlayerSpecialCase ? 7 : 6;
  const maxTeams = structure.courtsUsed * 2;

  let teamConfig = null;

  // If this is the 37-player special case, use the predefined configuration
  if (is37PlayerSpecialCase && roundStructure?.teamConfiguration) {
    const config = roundStructure.teamConfiguration;
    const teamSizes = [];

    // Create team sizes: 5 teams of 6 + 1 team of 7
    for (let i = 0; i < config.regularTeams; i++) {
      teamSizes.push(config.regularTeamSize);
    }
    for (let i = 0; i < config.oversizeTeams; i++) {
      teamSizes.push(config.oversizeTeamSize);
    }

    teamConfig = { teamCount: teamSizes.length, teamSizes };
    console.log(`🎯 Using 37-player special config: ${teamSizes.join(', ')} players`);
  } else {
    // Normal team configuration logic
    for (let teamCount = 2; teamCount <= maxTeams; teamCount += 2) {
      const avgTeamSize = playingPlayers.length / teamCount;

      if (avgTeamSize >= 5 && avgTeamSize <= maxPlayersPerTeam) {
        const baseSize = Math.floor(avgTeamSize);
        const remainder = playingPlayers.length % teamCount;

        const teamSizes = [];
        for (let i = 0; i < teamCount; i++) {
          teamSizes.push(baseSize + (i < remainder ? 1 : 0));
        }

        if (teamSizes.every(size => size >= 5 && size <= maxPlayersPerTeam)) {
          teamConfig = { teamCount, teamSizes };
          console.log(`Using ${teamCount} teams: ${teamSizes.join(', ')} players`);
          break;
        }
      }
    }
  }
  
  if (!teamConfig) {
    throw new Error(`Cannot create teams for ${playingPlayers.length} players`);
  }
  
  const teams = createBalancedTeams(playingPlayers, teamConfig, roundNumber);
  
  const matches = createSimpleMatches(teams);
  
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
        maleAA: 0, femaleAA: 0,
        maleA: 0, femaleA: 0,
        maleBB: 0, femaleBB: 0,
        maleB: 0, femaleB: 0,
        skillRating: 0
      }
    });
  }
  
  const teamPairs = [];
  for (let i = 0; i < teamCount; i += 2) {
    teamPairs.push({
      team1: teams[i],
      team2: teams[i + 1],
      court: teams[i].court
    });
  }

  console.log(`\nCreating ${teamPairs.length} balanced match pairs with constraints...`);

  const shuffledPlayers = shuffleArray([...players]);
  const categories = {
    femaleSetters: shuffledPlayers.filter(p => p.gender === 'female' && p.is_setter),
    maleAA: shuffledPlayers.filter(p => p.gender === 'male' && p.skill_level === 'AA'),
    femaleAA: shuffledPlayers.filter(p => p.gender === 'female' && p.skill_level === 'AA' && !p.is_setter),
    maleA: shuffledPlayers.filter(p => p.gender === 'male' && p.skill_level === 'A'),
    femaleA: shuffledPlayers.filter(p => p.gender === 'female' && p.skill_level === 'A' && !p.is_setter),
    maleBB: shuffledPlayers.filter(p => p.gender === 'male' && p.skill_level === 'BB'),
    femaleBB: shuffledPlayers.filter(p => p.gender === 'female' && p.skill_level === 'BB' && !p.is_setter),
    maleB: shuffledPlayers.filter(p => p.gender === 'male' && p.skill_level === 'B'),
    femaleB: shuffledPlayers.filter(p => p.gender === 'female' && p.skill_level === 'B' && !p.is_setter),
    maleOther: shuffledPlayers.filter(p =>
      p.gender === 'male' && !p.is_setter &&
      !['AA', 'A', 'BB', 'B'].includes(p.skill_level)
    )
  };

  // ENHANCED: Distribution order optimized for constraints:
  // 1. Female setters FIRST - most important for even distribution
  // 2. Interleave genders by skill level for balanced team composition early
  // 3. B players LAST - ensures max 1 B player per gender per team after others are placed
  const distributionOrder = [
    'femaleSetters', // FIRST - top priority for even distribution
    'maleAA',        // AA players - alternating gender
    'femaleAA',
    'maleA',         // A players - alternating gender
    'femaleA',
    'maleBB',        // BB players - alternating gender
    'femaleBB',
    'maleOther',     // Any remaining males without standard skill level
    'maleB',         // B players LAST - distributed after others
    'femaleB'
  ];
  
  distributionOrder.forEach(category => {
    const playersInCategory = categories[category];
    
    playersInCategory.forEach(player => {
      // ENHANCED: Use constraint-aware team selection
      const bestTeam = findBestTeamForPlayerWithConstraints(teams, teamPairs, player, category);
      if (bestTeam) {
        bestTeam.players.push(player);
        updateTeamStats(bestTeam.stats, player);
      }
    });
    
    console.log(`Distributed ${playersInCategory.length} ${category} players`);
  });
  
  // Handle any unassigned players
  const assignedPlayerIds = new Set();
  teams.forEach(team => {
    team.players.forEach(player => assignedPlayerIds.add(player.id));
  });

  const unassignedPlayers = shuffledPlayers.filter(p => !assignedPlayerIds.has(p.id));
  if (unassignedPlayers.length > 0) {
    console.log(`\n--- Handling ${unassignedPlayers.length} unassigned player(s) ---`);
  }

  unassignedPlayers.forEach(player => {
    const bestTeam = findBestTeamForPlayerWithConstraints(teams, teamPairs, player, 'remaining');
    if (bestTeam && bestTeam.players.length < bestTeam.targetSize) {
      bestTeam.players.push(player);
      updateTeamStats(bestTeam.stats, player);
      console.log(`  Assigned ${player.name} to Team ${bestTeam.team_number} (via constraints)`);
    } else {
      // FIXED: Smart fallback that still respects constraints where possible
      const teamsWithSpace = teams.filter(t => t.players.length < t.targetSize);

      if (teamsWithSpace.length > 0) {
        // For B players, prefer teams without B players of the same gender
        if (player.skill_level === 'B') {
          const teamsWithoutBOfSameGender = teamsWithSpace.filter(t =>
            t.players.filter(p => p.skill_level === 'B' && p.gender === player.gender).length === 0
          );
          if (teamsWithoutBOfSameGender.length > 0) {
            // Sort by fewest B players of same gender (should all be 0 at this point)
            teamsWithoutBOfSameGender.sort((a, b) => {
              const aCount = a.players.filter(p => p.skill_level === 'B' && p.gender === player.gender).length;
              const bCount = b.players.filter(p => p.skill_level === 'B' && p.gender === player.gender).length;
              return aCount - bCount;
            });
            teamsWithoutBOfSameGender[0].players.push(player);
            updateTeamStats(teamsWithoutBOfSameGender[0].stats, player);
            console.log(`  Assigned ${player.name} (B ${player.gender}) to Team ${teamsWithoutBOfSameGender[0].team_number} (no existing B ${player.gender}s)`);
          } else {
            // All teams already have a B player of this gender - pick the one with fewest overall B players
            teamsWithSpace.sort((a, b) => {
              const aB = a.players.filter(p => p.skill_level === 'B').length;
              const bB = b.players.filter(p => p.skill_level === 'B').length;
              return aB - bB;
            });
            teamsWithSpace[0].players.push(player);
            updateTeamStats(teamsWithSpace[0].stats, player);
            console.warn(`  ⚠️  Assigned ${player.name} (B ${player.gender}) to Team ${teamsWithSpace[0].team_number} - creates multiple B ${player.gender}s (unavoidable)`);
          }
        } else {
          // Non-B player fallback
          teamsWithSpace[0].players.push(player);
          updateTeamStats(teamsWithSpace[0].stats, player);
          console.log(`  Assigned ${player.name} to Team ${teamsWithSpace[0].team_number} (fallback)`);
        }
      }
    }
  });

  // NEW: B player rebalancing pass - fix teams with multiple B players of same gender
  rebalanceBPlayers(teams, teamPairs);

  console.log(`\n=== Final Team Composition ===`);
  teamPairs.forEach(pair => {
    const team1 = pair.team1;
    const team2 = pair.team2;
    
    const t1Gender = `${team1.stats.male}M:${team1.stats.female}F`;
    const t2Gender = `${team2.stats.male}M:${team2.stats.female}F`;
    
    const skillDiff = Math.abs(team1.stats.skillRating - team2.stats.skillRating);
    const avgSkill = (team1.stats.skillRating + team2.stats.skillRating) / 2;
    const balanceQuality = avgSkill > 0 ? (skillDiff / avgSkill * 100).toFixed(1) : 0;
    
    console.log(`\nCourt ${pair.court} Match:`);
    console.log(`  Team ${team1.team_number}: ${team1.players.length} players (${t1Gender}) - Skill: ${team1.stats.skillRating.toFixed(1)}`);
    console.log(`  Team ${team2.team_number}: ${team2.players.length} players (${t2Gender}) - Skill: ${team2.stats.skillRating.toFixed(1)}`);
    console.log(`  Match balance: ${balanceQuality}% difference ${skillDiff < 2 ? '✓ Excellent' : skillDiff < 4 ? '✓ Good' : '⚠ Fair'}`);
  });
  
  // ENHANCED: Run refinement pass to improve match balance through player swaps
  refineTeamBalance(teams, teamPairs);

  validateGenderBalance(teams);
  validateMatchBalance(teamPairs);

  // NEW: Validate team constraints
  const constraintValidation = validateAllTeamsConstraints(teams);

  return teams;
}

// NEW: B player rebalancing pass - ensures even distribution of B players
// This runs after initial distribution to fix any teams with 2+ B players of same gender
function rebalanceBPlayers(teams, teamPairs) {
  console.log('\n=== B Player Rebalancing Pass ===');

  const playingTeams = teams.filter(t => !t.is_bye_team);
  let swapsMade = 0;

  // Check for B male imbalances
  const bMaleSwaps = rebalanceBPlayersByGender(playingTeams, teamPairs, 'male');
  swapsMade += bMaleSwaps;

  // Check for B female imbalances
  const bFemaleSwaps = rebalanceBPlayersByGender(playingTeams, teamPairs, 'female');
  swapsMade += bFemaleSwaps;

  if (swapsMade > 0) {
    console.log(`  ✅ B player rebalancing: ${swapsMade} swap(s) made`);
  } else {
    console.log(`  ✓ No B player rebalancing needed`);
  }
}

function rebalanceBPlayersByGender(teams, _teamPairs, gender) {
  let swapsMade = 0;
  const maxIterations = 10;
  let iteration = 0;

  while (iteration < maxIterations) {
    iteration++;

    // Find teams with 2+ B players of this gender, prioritize smaller teams as sources
    const teamsWithExcessB = teams
      .filter(t => t.players.filter(p => p.skill_level === 'B' && p.gender === gender).length >= 2)
      .sort((a, b) => a.targetSize - b.targetSize); // Smaller teams first (move B players OUT of small teams)

    if (teamsWithExcessB.length === 0) break;

    // Find teams with 0 B players of this gender, prioritize larger teams as targets
    const teamsWithoutB = teams
      .filter(t => t.players.filter(p => p.skill_level === 'B' && p.gender === gender).length === 0)
      .sort((a, b) => b.targetSize - a.targetSize); // Larger teams first (move B players INTO large teams)

    if (teamsWithoutB.length === 0) break;

    let swappedThisIteration = false;

    for (const sourceTeam of teamsWithExcessB) {
      if (swappedThisIteration) break;

      // Get the B players on this team
      const bPlayersOnTeam = sourceTeam.players.filter(p =>
        p.skill_level === 'B' && p.gender === gender
      );

      // Try to swap one B player to a team without B players
      for (const bPlayer of bPlayersOnTeam.slice(1)) { // Keep one, try to move others
        if (swappedThisIteration) break;

        for (const targetTeam of teamsWithoutB) {
          // Skip if target team is smaller than source (prefer moving to larger teams)
          // But allow it if no larger team is available
          const largerTeamAvailable = teamsWithoutB.some(t =>
            t.targetSize > sourceTeam.targetSize &&
            t.players.filter(p => p.skill_level !== 'B' && p.gender === gender).length > 0
          );
          if (largerTeamAvailable && targetTeam.targetSize < sourceTeam.targetSize) {
            continue;
          }
          // Find a non-B player on target team to swap
          const swapCandidates = targetTeam.players.filter(p =>
            p.skill_level !== 'B' && p.gender === gender
          );

          for (const swapCandidate of swapCandidates) {
            // Check if this swap maintains other constraints
            if (canSwapForBRebalance(sourceTeam, targetTeam, bPlayer, swapCandidate, teams)) {
              // Perform the swap
              sourceTeam.players = sourceTeam.players.filter(p => p.id !== bPlayer.id);
              targetTeam.players = targetTeam.players.filter(p => p.id !== swapCandidate.id);
              sourceTeam.players.push(swapCandidate);
              targetTeam.players.push(bPlayer);

              // Recalculate stats
              recalculateTeamStats(sourceTeam);
              recalculateTeamStats(targetTeam);

              console.log(`  Swapped ${bPlayer.name} (B ${gender}) from Team ${sourceTeam.team_number} <-> ${swapCandidate.name} from Team ${targetTeam.team_number}`);

              // Prefer moving B players to larger teams
              if (targetTeam.targetSize > sourceTeam.targetSize) {
                console.log(`    → B player moved to larger team (${targetTeam.targetSize} vs ${sourceTeam.targetSize})`);
              }

              swapsMade++;
              swappedThisIteration = true;
              break;
            }
          }
          if (swappedThisIteration) break; // Exit targetTeam loop after successful swap
        }
      }
    }

    if (!swappedThisIteration) break;
  }

  return swapsMade;
}

// Check if a swap for B player rebalancing is valid
function canSwapForBRebalance(team1, team2, player1, player2, allTeams) {
  // Check male counts after swap
  const team1Males = team1.stats.male - (player1.gender === 'male' ? 1 : 0) + (player2.gender === 'male' ? 1 : 0);
  const team2Males = team2.stats.male - (player2.gender === 'male' ? 1 : 0) + (player1.gender === 'male' ? 1 : 0);

  // Both teams need at least 2 males
  if (team1Males < 2 || team2Males < 2) {
    return false;
  }

  // Don't create female setter imbalance
  const player1IsFemSetter = player1.gender === 'female' && player1.is_setter;
  const player2IsFemSetter = player2.gender === 'female' && player2.is_setter;

  const playingTeams = allTeams.filter(t => !t.is_bye_team);
  const teamCount = playingTeams.length;
  const totalFemaleSetters = playingTeams.reduce((sum, t) =>
    sum + t.players.filter(p => p.gender === 'female' && p.is_setter).length, 0);
  const maxSettersPerTeam = Math.ceil(totalFemaleSetters / teamCount);

  const team1SettersAfter = team1.players.filter(p => p.gender === 'female' && p.is_setter && p.id !== player1.id).length +
                            (player2IsFemSetter ? 1 : 0);
  const team2SettersAfter = team2.players.filter(p => p.gender === 'female' && p.is_setter && p.id !== player2.id).length +
                            (player1IsFemSetter ? 1 : 0);

  if (team1SettersAfter > maxSettersPerTeam || team2SettersAfter > maxSettersPerTeam) {
    return false;
  }

  // Check skill difference doesn't get too bad (within reason for B player rebalancing)
  const player1Skill = getSkillRating(player1);
  const player2Skill = getSkillRating(player2);
  const skillChange = Math.abs(player1Skill - player2Skill);

  // Allow up to 2.0 skill difference for the purpose of B player distribution
  if (skillChange > 2.0) {
    return false;
  }

  return true;
}

// NEW: Refinement pass to improve team balance through player swaps
function refineTeamBalance(teams, teamPairs) {
  console.log('\n=== Running Refinement Pass ===');

  let totalSwaps = 0;
  let iterations = 0;
  const maxIterations = 10; // Prevent infinite loops

  while (iterations < maxIterations) {
    iterations++;
    let swapsThisIteration = 0;

    for (const pair of teamPairs) {
      const team1 = pair.team1;
      const team2 = pair.team2;

      const skillDiff = Math.abs(team1.stats.skillRating - team2.stats.skillRating);
      const genderDiff = Math.abs(team1.stats.male - team2.stats.male);

      // Try to improve if skill difference > 2 OR gender difference >= 1
      const needsSkillBalance = skillDiff > 2;
      const needsGenderBalance = genderDiff >= 1;

      if (!needsSkillBalance && !needsGenderBalance) continue;

      // Try to find a beneficial swap (considers both skill and gender)
      const swap = findBeneficialSwap(team1, team2, skillDiff, genderDiff, teams);

      if (swap) {
        // Perform the swap
        executeSwap(swap.team1, swap.team2, swap.player1, swap.player2);
        swapsThisIteration++;
        totalSwaps++;

        console.log(`  Swap ${totalSwaps}: ${swap.player1.name} (Team ${swap.team1.team_number}) <-> ${swap.player2.name} (Team ${swap.team2.team_number})`);
        if (swap.skillImprovement > 0) {
          console.log(`    Skill diff: ${skillDiff.toFixed(1)} -> ${swap.newSkillDiff.toFixed(1)}`);
        }
        if (swap.genderImprovement > 0) {
          console.log(`    Gender diff: ${genderDiff} -> ${swap.newGenderDiff}`);
        }
      }
    }

    if (swapsThisIteration === 0) {
      break; // No more improvements possible
    }
  }

  if (totalSwaps > 0) {
    console.log(`  ✅ Refinement complete: ${totalSwaps} swap(s) made in ${iterations} iteration(s)`);
  } else {
    console.log(`  ✓ No beneficial swaps found - teams already well balanced`);
  }
}

// Find a swap that would improve skill and/or gender balance while maintaining constraints
function findBeneficialSwap(team1, team2, currentSkillDiff, currentGenderDiff, allTeams) {
  let bestSwap = null;
  let bestScore = 0;

  for (const player1 of team1.players) {
    for (const player2 of team2.players) {
      // Skip if same gender and skill - no point swapping
      if (player1.gender === player2.gender && player1.skill_level === player2.skill_level) {
        continue;
      }

      // Check if swap maintains constraints
      if (!isSwapValid(team1, team2, player1, player2, allTeams)) {
        continue;
      }

      // Calculate new skill difference after swap
      const player1Skill = getSkillRating(player1);
      const player2Skill = getSkillRating(player2);

      const newTeam1Skill = team1.stats.skillRating - player1Skill + player2Skill;
      const newTeam2Skill = team2.stats.skillRating - player2Skill + player1Skill;
      const newSkillDiff = Math.abs(newTeam1Skill - newTeam2Skill);

      // Calculate new gender difference after swap
      const team1MalesAfter = team1.stats.male - (player1.gender === 'male' ? 1 : 0) + (player2.gender === 'male' ? 1 : 0);
      const team2MalesAfter = team2.stats.male - (player2.gender === 'male' ? 1 : 0) + (player1.gender === 'male' ? 1 : 0);
      const newGenderDiff = Math.abs(team1MalesAfter - team2MalesAfter);

      const skillImprovement = currentSkillDiff - newSkillDiff;
      const genderImprovement = currentGenderDiff - newGenderDiff;

      // Calculate B player support impact
      // If teams have B players, swaps that improve their support should be weighted
      let bPlayerSupportBonus = 0;
      const team1BPlayers = team1.players.filter(p => p.skill_level === 'B');
      const team2BPlayers = team2.players.filter(p => p.skill_level === 'B');

      if (team1BPlayers.length > 0 || team2BPlayers.length > 0) {
        // Check if swap improves support for B players
        // Strong player moving to team with B player = bonus
        // B player moving to team with more strong players = bonus
        const player1IsStrong = ['AA', 'A'].includes(player1.skill_level);
        const player2IsStrong = ['AA', 'A'].includes(player2.skill_level);
        const player1IsB = player1.skill_level === 'B';
        const player2IsB = player2.skill_level === 'B';

        // Strong player moving to team with B players
        if (player1IsStrong && team2BPlayers.length > 0) bPlayerSupportBonus += 0.3;
        if (player2IsStrong && team1BPlayers.length > 0) bPlayerSupportBonus += 0.3;

        // B player moving to team with more strong players (not moving, but this is the pattern)
        if (player1IsB) {
          const team2StrongCount = team2.players.filter(p => ['AA', 'A'].includes(p.skill_level) && p.id !== player2.id).length;
          const team1StrongCount = team1.players.filter(p => ['AA', 'A'].includes(p.skill_level) && p.id !== player1.id).length;
          if (team2StrongCount > team1StrongCount) bPlayerSupportBonus += 0.2;
        }
        if (player2IsB) {
          const team1StrongCount = team1.players.filter(p => ['AA', 'A'].includes(p.skill_level) && p.id !== player1.id).length;
          const team2StrongCount = team2.players.filter(p => ['AA', 'A'].includes(p.skill_level) && p.id !== player2.id).length;
          if (team1StrongCount > team2StrongCount) bPlayerSupportBonus += 0.2;
        }
      }

      // Weight skill balance MORE heavily when teams have B players
      // This ensures B player teams aren't disadvantaged
      const hasBPlayers = team1BPlayers.length > 0 || team2BPlayers.length > 0;
      const skillWeight = hasBPlayers ? 1.0 : 0.5; // Double weight when B players present

      // Combined score with B player support consideration
      const combinedScore = skillImprovement * skillWeight + genderImprovement * 1.5 + bPlayerSupportBonus;

      // Only consider swaps that provide meaningful improvement
      const isWorthwhile = (skillImprovement > 0.5 && newSkillDiff <= currentSkillDiff) ||
                           (genderImprovement >= 1 && newGenderDiff < currentGenderDiff) ||
                           (bPlayerSupportBonus > 0.3); // Also worthwhile if significantly helps B players

      if (isWorthwhile && combinedScore > bestScore && newSkillDiff <= currentSkillDiff + 0.5) {
        // Don't allow swaps that make skill significantly worse
        bestScore = combinedScore;
        bestSwap = {
          team1,
          team2,
          player1,
          player2,
          newSkillDiff,
          newGenderDiff,
          skillImprovement,
          genderImprovement,
          bPlayerSupportBonus
        };
      }
    }
  }

  return bestSwap;
}

// Check if a swap would violate any constraints
function isSwapValid(team1, team2, player1, player2, allTeams) {
  // Simulate the swap and check constraints

  // Check male counts after swap
  const team1Males = team1.stats.male - (player1.gender === 'male' ? 1 : 0) + (player2.gender === 'male' ? 1 : 0);
  const team2Males = team2.stats.male - (player2.gender === 'male' ? 1 : 0) + (player1.gender === 'male' ? 1 : 0);

  // Both teams need at least 2 males
  if (team1Males < 2 || team2Males < 2) {
    return false;
  }

  // Check female setter constraint - dynamic max based on even distribution
  const player1IsFemSetter = player1.gender === 'female' && player1.is_setter;
  const player2IsFemSetter = player2.gender === 'female' && player2.is_setter;

  // Calculate total female setters across all teams and the max allowed per team
  const playingTeams = allTeams.filter(t => !t.is_bye_team);
  const teamCount = playingTeams.length;
  const totalFemaleSetters = playingTeams.reduce((sum, t) =>
    sum + t.players.filter(p => p.gender === 'female' && p.is_setter).length, 0);
  const maxSettersPerTeam = Math.ceil(totalFemaleSetters / teamCount);

  // Count female setters on each team after swap (excluding the swapped players, then adding the incoming ones)
  const team1FemSettersAfter = team1.players.filter(p => p.gender === 'female' && p.is_setter && p.id !== player1.id).length +
                               (player2IsFemSetter ? 1 : 0);
  const team2FemSettersAfter = team2.players.filter(p => p.gender === 'female' && p.is_setter && p.id !== player2.id).length +
                               (player1IsFemSetter ? 1 : 0);

  // Reject swap if it would make either team exceed the max allowed
  if (team1FemSettersAfter > maxSettersPerTeam || team2FemSettersAfter > maxSettersPerTeam) {
    return false;
  }

  // Also reject if swap would make distribution less even (one team gains while having more than another)
  const team1FemSettersBefore = team1.players.filter(p => p.gender === 'female' && p.is_setter).length;
  const team2FemSettersBefore = team2.players.filter(p => p.gender === 'female' && p.is_setter).length;

  // If team1 would gain a setter and already has more than team2, reject
  if (team1FemSettersAfter > team1FemSettersBefore && team1FemSettersBefore > team2FemSettersBefore) {
    return false;
  }
  // If team2 would gain a setter and already has more than team1, reject
  if (team2FemSettersAfter > team2FemSettersBefore && team2FemSettersBefore > team1FemSettersBefore) {
    return false;
  }

  // Check B player constraint - dynamic max based on even distribution
  // (reuse playingTeams and teamCount from setter constraint above)

  // Calculate total B males and B females across all teams
  const totalBMales = playingTeams.reduce((sum, t) =>
    sum + t.players.filter(p => p.skill_level === 'B' && p.gender === 'male').length, 0);
  const totalBFemales = playingTeams.reduce((sum, t) =>
    sum + t.players.filter(p => p.skill_level === 'B' && p.gender === 'female').length, 0);

  const maxBMalesPerTeam = Math.ceil(totalBMales / teamCount);
  const maxBFemalesPerTeam = Math.ceil(totalBFemales / teamCount);

  // Count B players on each team after swap
  const team1BMaleCount = team1.players.filter(p => p.skill_level === 'B' && p.gender === 'male' && p.id !== player1.id).length +
                          (player2.skill_level === 'B' && player2.gender === 'male' ? 1 : 0);
  const team1BFemaleCount = team1.players.filter(p => p.skill_level === 'B' && p.gender === 'female' && p.id !== player1.id).length +
                            (player2.skill_level === 'B' && player2.gender === 'female' ? 1 : 0);

  const team2BMaleCount = team2.players.filter(p => p.skill_level === 'B' && p.gender === 'male' && p.id !== player2.id).length +
                          (player1.skill_level === 'B' && player1.gender === 'male' ? 1 : 0);
  const team2BFemaleCount = team2.players.filter(p => p.skill_level === 'B' && p.gender === 'female' && p.id !== player2.id).length +
                            (player1.skill_level === 'B' && player1.gender === 'female' ? 1 : 0);

  // Reject if swap would exceed dynamic max
  if (team1BMaleCount > maxBMalesPerTeam || team2BMaleCount > maxBMalesPerTeam) {
    return false;
  }
  if (team1BFemaleCount > maxBFemalesPerTeam || team2BFemaleCount > maxBFemalesPerTeam) {
    return false;
  }

  // Also reject swaps that would make B distribution less even
  const team1BMaleBefore = team1.players.filter(p => p.skill_level === 'B' && p.gender === 'male').length;
  const team2BMaleBefore = team2.players.filter(p => p.skill_level === 'B' && p.gender === 'male').length;
  const team1BFemaleBefore = team1.players.filter(p => p.skill_level === 'B' && p.gender === 'female').length;
  const team2BFemaleBefore = team2.players.filter(p => p.skill_level === 'B' && p.gender === 'female').length;

  // Reject if team with more B males would gain another
  if (team1BMaleCount > team1BMaleBefore && team1BMaleBefore > team2BMaleBefore) {
    return false;
  }
  if (team2BMaleCount > team2BMaleBefore && team2BMaleBefore > team1BMaleBefore) {
    return false;
  }

  // Reject if team with more B females would gain another
  if (team1BFemaleCount > team1BFemaleBefore && team1BFemaleBefore > team2BFemaleBefore) {
    return false;
  }
  if (team2BFemaleCount > team2BFemaleBefore && team2BFemaleBefore > team1BFemaleBefore) {
    return false;
  }

  return true;
}

// Execute a player swap between two teams
function executeSwap(team1, team2, player1, player2) {
  // Remove players from their current teams
  team1.players = team1.players.filter(p => p.id !== player1.id);
  team2.players = team2.players.filter(p => p.id !== player2.id);

  // Add players to their new teams
  team1.players.push(player2);
  team2.players.push(player1);

  // Update team stats
  recalculateTeamStats(team1);
  recalculateTeamStats(team2);
}

// Recalculate all stats for a team
function recalculateTeamStats(team) {
  team.stats = {
    male: 0,
    female: 0,
    femaleSetters: 0,
    maleAA: 0, femaleAA: 0,
    maleA: 0, femaleA: 0,
    maleBB: 0, femaleBB: 0,
    maleB: 0, femaleB: 0,
    skillRating: 0
  };

  for (const player of team.players) {
    if (player.gender === 'male') team.stats.male++;
    if (player.gender === 'female') team.stats.female++;
    if (player.gender === 'female' && player.is_setter) team.stats.femaleSetters++;
    if (player.gender === 'male' && player.skill_level === 'A') team.stats.maleA++;
    if (player.gender === 'female' && player.skill_level === 'A') team.stats.femaleA++;
    if (player.gender === 'male' && player.skill_level === 'BB') team.stats.maleBB++;
    if (player.gender === 'female' && player.skill_level === 'BB') team.stats.femaleBB++;
    if (player.gender === 'male' && player.skill_level === 'B') team.stats.maleB++;
    if (player.gender === 'female' && player.skill_level === 'B') team.stats.femaleB++;
    team.stats.skillRating += getSkillRating(player);
  }
}

// ENHANCED: Check if team can accept a player given constraints
// Now accepts allTeams to enforce even male distribution across teams
function canTeamAcceptPlayer(team, player, allTeams = null) {
  if (team.players.length >= team.targetSize) {
    return { canAccept: false, reason: 'Team full' };
  }

  const targetSize = team.targetSize;
  if (targetSize >= 5 && targetSize <= 7) {
    const currentMaleCount = team.stats?.male || team.players.filter(p => p.gender === 'male').length;
    const spotsRemaining = targetSize - team.players.length;

    // ENHANCED: Enforce minimum 2 males - check earlier in the process
    // Calculate how many males we need vs how many spots we have
    const malesNeeded = Math.max(0, 2 - currentMaleCount);
    const femalesAllowed = spotsRemaining - malesNeeded;

    // If adding a female would make it impossible to get 2 males
    if (player.gender === 'female' && femalesAllowed <= 0) {
      return { canAccept: false, reason: 'Need male to meet minimum 2 males requirement' };
    }

    // ENHANCED: Prevent adding a 3rd+ male to a team when other teams still need males
    // This ensures males are distributed evenly (2 per team) before any team gets extras
    if (player.gender === 'male' && currentMaleCount >= 2 && allTeams) {
      const teamsNeedingMales = allTeams.filter(t => {
        if (t.is_bye_team) return false;
        const tMaleCount = t.stats?.male || t.players.filter(p => p.gender === 'male').length;
        const tSpotsRemaining = t.targetSize - t.players.length;
        // Team needs males if it has < 2 males and has room for more players
        return tMaleCount < 2 && tSpotsRemaining > 0;
      });

      if (teamsNeedingMales.length > 0) {
        return { canAccept: false, reason: 'Other teams need males first (ensuring 2 per team)' };
      }
    }

    // ENHANCED: Enforce even B-rated player distribution across teams
    // Dynamic constraint: max B players per gender per team = ceil(totalBOfGender / teamCount)
    if (player.skill_level === 'B' && allTeams) {
      const playingTeams = allTeams.filter(t => !t.is_bye_team);
      const teamCount = playingTeams.length;

      // Count total B players of same gender already assigned + this one being placed
      const totalBOfGenderAssigned = playingTeams.reduce((sum, t) =>
        sum + t.players.filter(p => p.skill_level === 'B' && p.gender === player.gender).length, 0);
      const totalBOfGender = totalBOfGenderAssigned + 1; // +1 for player being placed

      // Calculate max allowed per team for even distribution
      const maxBPerTeam = Math.ceil(totalBOfGender / teamCount);

      const currentBOfGender = team.players.filter(p =>
        p.skill_level === 'B' && p.gender === player.gender
      ).length;

      // Only reject if this team already has the max allowed
      if (currentBOfGender >= maxBPerTeam) {
        // Check if other teams have fewer B players of this gender with room available
        const teamsWithFewerB = playingTeams.filter(t => {
          const bCount = t.players.filter(p => p.skill_level === 'B' && p.gender === player.gender).length;
          return bCount < currentBOfGender && t.players.length < t.targetSize;
        });

        if (teamsWithFewerB.length > 0) {
          return { canAccept: false, reason: `Other teams need B ${player.gender}s first (even distribution: max ${maxBPerTeam} per team)` };
        }
      }
    }

    // ENHANCED: Enforce even female setter distribution across teams
    // Dynamic constraint: max setters per team = ceil(totalSetters / teamCount)
    if (player.gender === 'female' && player.is_setter && allTeams) {
      const playingTeams = allTeams.filter(t => !t.is_bye_team);
      const teamCount = playingTeams.length;

      // Count total female setters already assigned + this one being placed
      const totalFemaleSettersAssigned = playingTeams.reduce((sum, t) =>
        sum + t.players.filter(p => p.gender === 'female' && p.is_setter).length, 0);
      const totalFemaleSetters = totalFemaleSettersAssigned + 1; // +1 for player being placed

      // Calculate max allowed per team for even distribution
      const maxSettersPerTeam = Math.ceil(totalFemaleSetters / teamCount);

      const currentFemaleSetters = team.players.filter(p =>
        p.gender === 'female' && p.is_setter
      ).length;

      // Only reject if this team already has the max allowed
      if (currentFemaleSetters >= maxSettersPerTeam) {
        // Check if other teams have room (fewer setters)
        const teamsWithFewerSetters = playingTeams.filter(t => {
          const setterCount = t.players.filter(p => p.gender === 'female' && p.is_setter).length;
          return setterCount < currentFemaleSetters && t.players.length < t.targetSize;
        });

        if (teamsWithFewerSetters.length > 0) {
          return { canAccept: false, reason: `Other teams need female setters first (even distribution: max ${maxSettersPerTeam} per team)` };
        }
      }
    }
  }

  return { canAccept: true };
}

// ENHANCED: Team selection with stronger constraints for male/B distribution
function findBestTeamForPlayerWithConstraints(teams, teamPairs, player, category) {
  const availableTeams = teams.filter(team => {
    // Pass all teams to canTeamAcceptPlayer for cross-team constraint checking
    const check = canTeamAcceptPlayer(team, player, teams);
    return check.canAccept;
  });

  if (availableTeams.length === 0) {
    console.warn(`  WARNING: No available teams for ${player.name} (${player.gender} ${player.skill_level})`);
    return null;
  }

  availableTeams.sort((a, b) => {
    // Priority 1: For ALL males, STRONGLY prefer teams that need males to reach minimum of 2
    // This is the highest priority to ensure every team gets 2 males before any gets 3+
    if (player.gender === 'male') {
      const aMaleCount = a.stats.male || 0;
      const bMaleCount = b.stats.male || 0;

      // Strongly prefer teams with fewer than 2 males
      const aNeeds = aMaleCount < 2;
      const bNeeds = bMaleCount < 2;
      if (aNeeds !== bNeeds) {
        return aNeeds ? -1 : 1; // Team that needs males comes first
      }

      // If both need or both don't need, prefer team with fewer males
      if (aMaleCount !== bMaleCount) {
        return aMaleCount - bMaleCount;
      }
    }

    // Priority 1b: CRITICAL - Female setters must be distributed evenly
    // This is the HIGHEST priority for female setters to ensure max 1 per team
    if (category === 'femaleSetters') {
      const aFemaleSetterCount = a.stats.femaleSetters || 0;
      const bFemaleSetterCount = b.stats.femaleSetters || 0;
      if (aFemaleSetterCount !== bFemaleSetterCount) {
        return aFemaleSetterCount - bFemaleSetterCount; // Strongly prefer team with fewer female setters
      }
    }

    // Priority 2: For maleAA specifically, prefer teams with fewer AA males (even distribution)
    if (category === 'maleAA') {
      const aMaleAA = a.stats.maleAA || 0;
      const bMaleAA = b.stats.maleAA || 0;
      if (aMaleAA !== bMaleAA) {
        return aMaleAA - bMaleAA; // Prefer team with fewer AA males
      }
    }

    // Priority 2a: For femaleAA, prefer teams with fewer AA females (even distribution)
    if (category === 'femaleAA') {
      const aFemaleAA = a.stats.femaleAA || 0;
      const bFemaleAA = b.stats.femaleAA || 0;
      if (aFemaleAA !== bFemaleAA) {
        return aFemaleAA - bFemaleAA; // Prefer team with fewer AA females
      }
    }

    // Priority 2b: For maleA specifically, prefer teams with fewer A males (even distribution)
    if (category === 'maleA') {
      const aMaleA = a.stats.maleA || 0;
      const bMaleA = b.stats.maleA || 0;
      if (aMaleA !== bMaleA) {
        return aMaleA - bMaleA; // Prefer team with fewer A males
      }
    }

    // Priority 2c: For femaleA, prefer teams with fewer A females (even distribution)
    if (category === 'femaleA') {
      const aFemaleA = a.stats.femaleA || 0;
      const bFemaleA = b.stats.femaleA || 0;
      if (aFemaleA !== bFemaleA) {
        return aFemaleA - bFemaleA; // Prefer team with fewer A females
      }
    }

    // Priority 2c: For BB-rated players, distribute evenly by gender
    if (category === 'maleBB') {
      const aMaleBB = a.stats.maleBB || 0;
      const bMaleBB = b.stats.maleBB || 0;
      if (aMaleBB !== bMaleBB) {
        return aMaleBB - bMaleBB; // Prefer team with fewer BB males
      }
    }

    if (category === 'femaleBB') {
      const aFemaleBB = a.stats.femaleBB || 0;
      const bFemaleBB = b.stats.femaleBB || 0;
      if (aFemaleBB !== bFemaleBB) {
        return aFemaleBB - bFemaleBB; // Prefer team with fewer BB females
      }
    }

    // Priority 3: For B-rated players, use comprehensive support scoring
    // B players benefit from: larger teams, stronger teammates, variety of mentors
    if (category === 'maleB') {
      const aBMale = a.stats.maleB || 0;
      const bBMale = b.stats.maleB || 0;

      // First, strongly prefer teams that don't have any B males yet (even distribution)
      if (aBMale !== bBMale) {
        return aBMale - bBMale; // Prefer team with fewer B males
      }

      // Use comprehensive support score for B player placement
      const aSupportScore = calculateBPlayerSupportScore(player, a);
      const bSupportScore = calculateBPlayerSupportScore(player, b);

      if (Math.abs(aSupportScore - bSupportScore) > 0.2) {
        return bSupportScore - aSupportScore; // Higher support score first
      }

      // Fallback: prefer larger teams for more support
      if (a.targetSize !== b.targetSize) {
        return b.targetSize - a.targetSize; // Larger teams first
      }
    }

    if (category === 'femaleB') {
      const aBFemale = a.stats.femaleB || 0;
      const bBFemale = b.stats.femaleB || 0;

      // First, strongly prefer teams that don't have any B females yet (even distribution)
      if (aBFemale !== bBFemale) {
        return aBFemale - bBFemale; // Prefer team with fewer B females
      }

      // Use comprehensive support score for B player placement
      const aSupportScore = calculateBPlayerSupportScore(player, a);
      const bSupportScore = calculateBPlayerSupportScore(player, b);

      if (Math.abs(aSupportScore - bSupportScore) > 0.2) {
        return bSupportScore - aSupportScore; // Higher support score first
      }

      // Fallback: prefer larger teams for more support
      if (a.targetSize !== b.targetSize) {
        return b.targetSize - a.targetSize; // Larger teams first
      }
    }

    // Priority 4: Balance category distribution
    const aCategoryCount = getCategoryCount(a.stats, category);
    const bCategoryCount = getCategoryCount(b.stats, category);
    if (aCategoryCount !== bCategoryCount) {
      return aCategoryCount - bCategoryCount;
    }

    // Priority 5: Match balance
    const aOpponent = getOpponentTeam(teams, teamPairs, a);
    const bOpponent = getOpponentTeam(teams, teamPairs, b);

    if (aOpponent && bOpponent) {
      const aMatchBalance = calculateMatchBalanceScore(a, aOpponent, player);
      const bMatchBalance = calculateMatchBalanceScore(b, bOpponent, player);

      if (Math.abs(aMatchBalance - bMatchBalance) > 0.5) {
        return bMatchBalance - aMatchBalance;
      }
    }

    // Priority 6: Teammate rotation
    const aTeammateCount = getTeammateCount(player.id, a.players);
    const bTeammateCount = getTeammateCount(player.id, b.players);
    if (aTeammateCount !== bTeammateCount) {
      return aTeammateCount - bTeammateCount;
    }

    // Priority 7: Gender balance
    const aGenderImbalance = calculateGenderImbalanceAfterAdding(a, player);
    const bGenderImbalance = calculateGenderImbalanceAfterAdding(b, player);
    if (aGenderImbalance !== bGenderImbalance) {
      return aGenderImbalance - bGenderImbalance;
    }

    return a.players.length - b.players.length;
  });

  return availableTeams[0];
}

// ENHANCED: Validate team constraints including B player distribution
function validateTeamConstraints(team) {
  const constraints = {
    isValid: true,
    violations: []
  };

  const teamSize = team.players.length;

  if (teamSize < 5 || teamSize > 6) {
    return constraints;
  }

  const males = team.players.filter(p => p.gender === 'male');
  const maleCount = males.length;

  // Constraint 1: Minimum 2 males
  if (maleCount < 2) {
    constraints.isValid = false;
    constraints.violations.push({
      type: 'INSUFFICIENT_MALES',
      severity: 'HIGH',
      message: `Team ${team.team_number} has only ${maleCount} male(s) (requires 2+ for teams of ${teamSize})`,
      teamSize,
      maleCount,
      femaleCount: team.players.length - maleCount
    });
  }

  // Constraint 2: No more than one B-rated player per gender
  const bRatedMales = team.players.filter(p => p.skill_level === 'B' && p.gender === 'male');
  if (bRatedMales.length > 1) {
    constraints.isValid = false;
    constraints.violations.push({
      type: 'MULTIPLE_B_RATED_MALES',
      severity: 'MEDIUM',
      message: `Team ${team.team_number} has ${bRatedMales.length} B-rated males (should have max 1)`,
      players: bRatedMales.map(p => p.name)
    });
  }

  const bRatedFemales = team.players.filter(p => p.skill_level === 'B' && p.gender === 'female');
  if (bRatedFemales.length > 1) {
    constraints.isValid = false;
    constraints.violations.push({
      type: 'MULTIPLE_B_RATED_FEMALES',
      severity: 'MEDIUM',
      message: `Team ${team.team_number} has ${bRatedFemales.length} B-rated females (should have max 1)`,
      players: bRatedFemales.map(p => p.name)
    });
  }

  return constraints;
}

// NEW: Validate all teams
function validateAllTeamsConstraints(teams) {
  console.log('\n=== Team Constraint Validation ===');

  const allViolations = [];
  let teamsWithViolations = 0;
  let highSeverityCount = 0;
  let mediumSeverityCount = 0;

  // Track distribution stats
  const maleADistribution = [];
  const femaleADistribution = [];
  const maleBBDistribution = [];
  const femaleBBDistribution = [];
  const femaleSetterDistribution = [];
  const bPlayerDistribution = [];
  const bMaleDistribution = [];
  const bFemaleDistribution = [];
  const maleCountDistribution = [];

  teams.forEach(team => {
    if (team.is_bye_team) return;

    const validation = validateTeamConstraints(team);

    // Track distributions for reporting
    const maleACount = team.players.filter(p => p.gender === 'male' && p.skill_level === 'A').length;
    const femaleACount = team.players.filter(p => p.gender === 'female' && p.skill_level === 'A').length;
    const maleBBCount = team.players.filter(p => p.gender === 'male' && p.skill_level === 'BB').length;
    const femaleBBCount = team.players.filter(p => p.gender === 'female' && p.skill_level === 'BB').length;
    const femaleSetterCount = team.players.filter(p => p.gender === 'female' && p.is_setter).length;
    const bPlayerCount = team.players.filter(p => p.skill_level === 'B').length;
    const bMaleCount = team.players.filter(p => p.gender === 'male' && p.skill_level === 'B').length;
    const bFemaleCount = team.players.filter(p => p.gender === 'female' && p.skill_level === 'B').length;
    const maleCount = team.players.filter(p => p.gender === 'male').length;

    maleADistribution.push(maleACount);
    femaleADistribution.push(femaleACount);
    maleBBDistribution.push(maleBBCount);
    femaleBBDistribution.push(femaleBBCount);
    femaleSetterDistribution.push(femaleSetterCount);
    bPlayerDistribution.push(bPlayerCount);
    bMaleDistribution.push(bMaleCount);
    bFemaleDistribution.push(bFemaleCount);
    maleCountDistribution.push(maleCount);

    if (!validation.isValid) {
      teamsWithViolations++;

      validation.violations.forEach(violation => {
        allViolations.push({
          teamNumber: team.team_number,
          court: team.court,
          ...violation
        });

        if (violation.severity === 'HIGH') highSeverityCount++;
        if (violation.severity === 'MEDIUM') mediumSeverityCount++;

        console.warn(`⚠️  ${violation.message}`);
      });
    }
  });

  // Report distribution stats
  const playingTeams = teams.filter(t => !t.is_bye_team);
  if (playingTeams.length > 0) {
    console.log(`\n--- Distribution Analysis ---`);

    // Male A distribution
    const totalMaleA = maleADistribution.reduce((a, b) => a + b, 0);
    if (totalMaleA > 0) {
      const minMaleA = Math.min(...maleADistribution);
      const maxMaleA = Math.max(...maleADistribution);
      console.log(`  A-rated males: ${totalMaleA} total, min=${minMaleA}, max=${maxMaleA} per team`);
      if (maxMaleA - minMaleA <= 1) {
        console.log(`    ✅ A males evenly distributed`);
      } else {
        console.log(`    ⚠️  A male distribution could be more even`);
      }
    }

    // Female A distribution
    const totalFemaleA = femaleADistribution.reduce((a, b) => a + b, 0);
    if (totalFemaleA > 0) {
      const minFemaleA = Math.min(...femaleADistribution);
      const maxFemaleA = Math.max(...femaleADistribution);
      console.log(`  A-rated females: ${totalFemaleA} total, min=${minFemaleA}, max=${maxFemaleA} per team`);
      if (maxFemaleA - minFemaleA <= 1) {
        console.log(`    ✅ A females evenly distributed`);
      } else {
        console.log(`    ⚠️  A female distribution could be more even`);
      }
    }

    // Male BB distribution
    const totalMaleBB = maleBBDistribution.reduce((a, b) => a + b, 0);
    if (totalMaleBB > 0) {
      const minMaleBB = Math.min(...maleBBDistribution);
      const maxMaleBB = Math.max(...maleBBDistribution);
      console.log(`  BB-rated males: ${totalMaleBB} total, min=${minMaleBB}, max=${maxMaleBB} per team`);
      if (maxMaleBB - minMaleBB <= 1) {
        console.log(`    ✅ BB males evenly distributed`);
      } else {
        console.log(`    ⚠️  BB male distribution could be more even`);
      }
    }

    // Female BB distribution
    const totalFemaleBB = femaleBBDistribution.reduce((a, b) => a + b, 0);
    if (totalFemaleBB > 0) {
      const minFemaleBB = Math.min(...femaleBBDistribution);
      const maxFemaleBB = Math.max(...femaleBBDistribution);
      console.log(`  BB-rated females: ${totalFemaleBB} total, min=${minFemaleBB}, max=${maxFemaleBB} per team`);
      if (maxFemaleBB - minFemaleBB <= 1) {
        console.log(`    ✅ BB females evenly distributed`);
      } else {
        console.log(`    ⚠️  BB female distribution could be more even`);
      }
    }

    // Female setter distribution - CRITICAL constraint with dynamic max
    const totalFemaleSetters = femaleSetterDistribution.reduce((a, b) => a + b, 0);
    if (totalFemaleSetters > 0) {
      const teamCount = femaleSetterDistribution.length;
      const idealMaxPerTeam = Math.ceil(totalFemaleSetters / teamCount);
      const actualMaxPerTeam = Math.max(...femaleSetterDistribution);
      const minPerTeam = Math.min(...femaleSetterDistribution);

      console.log(`  Female setters: ${totalFemaleSetters} total across ${teamCount} teams, distribution: min=${minPerTeam}, max=${actualMaxPerTeam} (ideal max: ${idealMaxPerTeam})`);

      if (actualMaxPerTeam <= idealMaxPerTeam && (actualMaxPerTeam - minPerTeam) <= 1) {
        console.log(`    ✅ Female setters evenly distributed`);
      } else if (actualMaxPerTeam <= idealMaxPerTeam) {
        console.log(`    ✓ Female setters within limits (max ${idealMaxPerTeam} per team)`);
      } else {
        const teamsOverLimit = femaleSetterDistribution.filter(s => s > idealMaxPerTeam).length;
        console.log(`    ❌ VIOLATION: ${teamsOverLimit} team(s) exceed ideal max of ${idealMaxPerTeam} setters!`);
      }
    }

    // B player distribution (overall)
    const maxB = Math.max(...bPlayerDistribution);
    const teamsWithMultipleB = bPlayerDistribution.filter(b => b > 1).length;
    console.log(`  B-rated players per team: max=${maxB}, teams with >1 B player: ${teamsWithMultipleB}`);
    if (teamsWithMultipleB === 0) {
      console.log(`    ✅ B players distributed (max 1 per team)`);
    } else {
      console.log(`    ⚠️  ${teamsWithMultipleB} team(s) have multiple B players`);
    }

    // B male distribution - with dynamic max calculation
    const totalBMales = bMaleDistribution.reduce((a, b) => a + b, 0);
    if (totalBMales > 0) {
      const bMaleTeamCount = bMaleDistribution.length;
      const idealMaxBMales = Math.ceil(totalBMales / bMaleTeamCount);
      const actualMaxBMale = Math.max(...bMaleDistribution);
      const minBMale = Math.min(...bMaleDistribution);

      console.log(`  B-rated males: ${totalBMales} total across ${bMaleTeamCount} teams, distribution: min=${minBMale}, max=${actualMaxBMale} (ideal max: ${idealMaxBMales})`);

      if (actualMaxBMale <= idealMaxBMales && (actualMaxBMale - minBMale) <= 1) {
        console.log(`    ✅ B males evenly distributed`);
      } else if (actualMaxBMale <= idealMaxBMales) {
        console.log(`    ✓ B males within limits (max ${idealMaxBMales} per team)`);
      } else {
        const teamsOverLimit = bMaleDistribution.filter(b => b > idealMaxBMales).length;
        console.log(`    ❌ VIOLATION: ${teamsOverLimit} team(s) exceed ideal max of ${idealMaxBMales} B males!`);
      }
    }

    // B female distribution - with dynamic max calculation
    const totalBFemales = bFemaleDistribution.reduce((a, b) => a + b, 0);
    if (totalBFemales > 0) {
      const bFemaleTeamCount = bFemaleDistribution.length;
      const idealMaxBFemales = Math.ceil(totalBFemales / bFemaleTeamCount);
      const actualMaxBFemale = Math.max(...bFemaleDistribution);
      const minBFemale = Math.min(...bFemaleDistribution);

      console.log(`  B-rated females: ${totalBFemales} total across ${bFemaleTeamCount} teams, distribution: min=${minBFemale}, max=${actualMaxBFemale} (ideal max: ${idealMaxBFemales})`);

      if (actualMaxBFemale <= idealMaxBFemales && (actualMaxBFemale - minBFemale) <= 1) {
        console.log(`    ✅ B females evenly distributed`);
      } else if (actualMaxBFemale <= idealMaxBFemales) {
        console.log(`    ✓ B females within limits (max ${idealMaxBFemales} per team)`);
      } else {
        const teamsOverLimit = bFemaleDistribution.filter(b => b > idealMaxBFemales).length;
        console.log(`    ❌ VIOLATION: ${teamsOverLimit} team(s) exceed ideal max of ${idealMaxBFemales} B females!`);
      }
    }

    // Male count distribution
    const minMales = Math.min(...maleCountDistribution);
    const teamsWithOneMale = maleCountDistribution.filter(m => m < 2).length;
    console.log(`  Males per team: min=${minMales}, teams with <2 males: ${teamsWithOneMale}`);
    if (teamsWithOneMale === 0) {
      console.log(`    ✅ All teams have 2+ males`);
    } else {
      console.log(`    ❌ ${teamsWithOneMale} team(s) have fewer than 2 males`);
    }
  }

  const summary = {
    totalTeams: playingTeams.length,
    teamsWithViolations,
    totalViolations: allViolations.length,
    highSeverityCount,
    mediumSeverityCount,
    violations: allViolations,
    isValid: allViolations.length === 0
  };

  console.log(`\nValidation Summary:`);
  console.log(`  Teams checked: ${summary.totalTeams}`);
  console.log(`  Teams with violations: ${teamsWithViolations}`);
  console.log(`  High severity: ${highSeverityCount}`);
  console.log(`  Medium severity: ${mediumSeverityCount}`);

  if (summary.isValid) {
    console.log('✅ All teams meet constraints');
  } else {
    console.log(`❌ ${summary.totalViolations} constraint violation(s) detected`);
  }

  return summary;
}

function findBestTeamForPlayerMatchAware(teams, teamPairs, player, category) {
  const availableTeams = teams.filter(team => team.players.length < team.targetSize);
  
  if (availableTeams.length === 0) return null;
  
  availableTeams.sort((a, b) => {
    const aCategoryCount = getCategoryCount(a.stats, category);
    const bCategoryCount = getCategoryCount(b.stats, category);
    if (aCategoryCount !== bCategoryCount) {
      return aCategoryCount - bCategoryCount;
    }
    
    const aOpponent = getOpponentTeam(teams, teamPairs, a);
    const bOpponent = getOpponentTeam(teams, teamPairs, b);
    
    if (aOpponent && bOpponent) {
      const aMatchBalance = calculateMatchBalanceScore(a, aOpponent, player);
      const bMatchBalance = calculateMatchBalanceScore(b, bOpponent, player);
      
      if (Math.abs(aMatchBalance - bMatchBalance) > 0.5) {
        return bMatchBalance - aMatchBalance;
      }
    }
    
    const aTeammateCount = getTeammateCount(player.id, a.players);
    const bTeammateCount = getTeammateCount(player.id, b.players);
    if (aTeammateCount !== bTeammateCount) {
      return aTeammateCount - bTeammateCount;
    }
    
    const aGenderImbalance = calculateGenderImbalanceAfterAdding(a, player);
    const bGenderImbalance = calculateGenderImbalanceAfterAdding(b, player);
    if (aGenderImbalance !== bGenderImbalance) {
      return aGenderImbalance - bGenderImbalance;
    }
    
    return a.players.length - b.players.length;
  });
  
  return availableTeams[0];
}


function getCategoryCount(stats, category) {
  switch (category) {
    case 'femaleSetters': return stats.femaleSetters;
    case 'maleAA': return stats.maleAA;
    case 'femaleAA': return stats.femaleAA;
    case 'maleA': return stats.maleA;
    case 'femaleA': return stats.femaleA;
    case 'maleBB': return stats.maleBB;
    case 'femaleBB': return stats.femaleBB;
    case 'maleB': return stats.maleB;
    case 'femaleB': return stats.femaleB;
    case 'maleOther': return stats.male - stats.maleAA - stats.maleA - stats.maleBB - stats.maleB;
    default: return 0;
  }
}

function calculateGenderImbalanceAfterAdding(team, player) {
  const currentMale = team.stats.male;
  const currentFemale = team.stats.female;
  
  const newMale = currentMale + (player.gender === 'male' ? 1 : 0);
  const newFemale = currentFemale + (player.gender === 'female' ? 1 : 0);
  
  return Math.abs(newMale - newFemale);
}

function updateTeamStats(stats, player) {
  if (player.gender === 'male') stats.male++;
  if (player.gender === 'female') stats.female++;

  if (player.gender === 'female' && player.is_setter) stats.femaleSetters++;
  if (player.gender === 'male' && player.skill_level === 'AA') stats.maleAA++;
  if (player.gender === 'female' && player.skill_level === 'AA') stats.femaleAA++;
  if (player.gender === 'male' && player.skill_level === 'A') stats.maleA++;
  if (player.gender === 'female' && player.skill_level === 'A') stats.femaleA++;
  if (player.gender === 'male' && player.skill_level === 'BB') stats.maleBB++;
  if (player.gender === 'female' && player.skill_level === 'BB') stats.femaleBB++;
  if (player.gender === 'male' && player.skill_level === 'B') stats.maleB++;
  if (player.gender === 'female' && player.skill_level === 'B') stats.femaleB++;

  stats.skillRating += getSkillRating(player);
}

function validateGenderBalance(teams) {
  console.log('\n--- Gender Balance Validation ---');
  
  let severeImbalances = 0;
  const imbalanceThreshold = 2;
  
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

function validateMatchBalance(teamPairs) {
  console.log('\n--- Match Balance Validation ---');
  
  let excellentMatches = 0;
  let goodMatches = 0;
  let fairMatches = 0;
  let poorMatches = 0;
  
  let totalSkillDiff = 0;
  let maxSkillDiff = 0;
  
  teamPairs.forEach(pair => {
    const team1Skill = pair.team1.stats.skillRating;
    const team2Skill = pair.team2.stats.skillRating;
    const skillDiff = Math.abs(team1Skill - team2Skill);
    
    totalSkillDiff += skillDiff;
    maxSkillDiff = Math.max(maxSkillDiff, skillDiff);
    
    if (skillDiff < 2) {
      excellentMatches++;
    } else if (skillDiff < 4) {
      goodMatches++;
    } else if (skillDiff < 6) {
      fairMatches++;
    } else {
      poorMatches++;
      console.warn(`  Court ${pair.court}: Large skill gap (${skillDiff.toFixed(1)} points)`);
    }
  });
  
  const avgSkillDiff = teamPairs.length > 0 ? (totalSkillDiff / teamPairs.length).toFixed(2) : 0;
  
  console.log(`Match quality distribution:`);
  console.log(`  Excellent (<2 skill diff): ${excellentMatches}`);
  console.log(`  Good (2-4 skill diff): ${goodMatches}`);
  console.log(`  Fair (4-6 skill diff): ${fairMatches}`);
  console.log(`  Poor (>6 skill diff): ${poorMatches}`);
  console.log(`Average skill difference: ${avgSkillDiff}`);
  console.log(`Max skill difference: ${maxSkillDiff.toFixed(2)}`);
  
  const qualityScore = ((excellentMatches * 3 + goodMatches * 2 + fairMatches * 1) / (teamPairs.length * 3) * 100).toFixed(1);
  console.log(`Overall match quality score: ${qualityScore}%`);
  
  if (qualityScore >= 80) {
    console.log('✅ Excellent match balance across the round');
  } else if (qualityScore >= 60) {
    console.log('✅ Good match balance across the round');
  } else {
    console.log('⚠️  Match balance could be improved');
  }
}

function createSimpleMatches(teams) {
  const matches = [];

  // FIXED: Sort teams by team_number to ensure consistent pairing
  // Teams 1&2 → Court 1, Teams 3&4 → Court 2, Teams 5&6 → Court 3, etc.
  const sortedTeams = [...teams].sort((a, b) => a.team_number - b.team_number);

  console.log('\n--- Team Size Distribution ---');
  const sizeCount = {};
  sortedTeams.forEach(team => {
    const size = team.players.length;
    sizeCount[size] = (sizeCount[size] || 0) + 1;
  });
  Object.keys(sizeCount).forEach(size => {
    console.log(`${size} players: ${sizeCount[size]} teams`);
  });

  console.log('\n--- Creating Matches (Teams paired by number) ---');

  // Pair teams sequentially by team_number
  for (let i = 0; i < sortedTeams.length - 1; i += 2) {
    const team1 = sortedTeams[i];
    const team2 = sortedTeams[i + 1];

    // Court number is based on the pair index (1-indexed)
    const courtNumber = Math.floor(i / 2) + 1;

    // Update team court assignments
    team1.court = courtNumber;
    team2.court = courtNumber;

    const sizeDiff = Math.abs(team1.players.length - team2.players.length);
    const matchType = sizeDiff === 0 ? 'equal_size' : 'mixed_size';

    matches.push({
      id: `match_${courtNumber}`,
      court: courtNumber,
      team1_id: team1.id,
      team2_id: team2.id,
      team1,
      team2,
      is_completed: false,
      matchType
    });

    const sizeLabel = sizeDiff === 0 ? 'EQUAL SIZE' : `MIXED SIZE +${sizeDiff}`;
    console.log(`Court ${courtNumber}: Team ${team1.team_number} (${team1.players.length}) vs Team ${team2.team_number} (${team2.players.length}) [${sizeLabel}]`);
  }

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

function createSpecial37PlayerTeams(players, roundNumber) {
  console.log(`\n=== Creating Special 37-Player Teams (Round ${roundNumber}) ===`);

  if (!special37PlayerHistory.initialized) {
    initializeSpecial37PlayerTracking(players);
  }

  const playerCounts = special37PlayerHistory.playersOn7Teams;

  console.log(`Current 7-player team assignments:`);
  const sortedCounts = Object.entries(playerCounts)
    .map(([id, count]) => ({
      player: players.find(p => p.id === parseInt(id)),
      count
    }))
    .sort((a, b) => {
      // Primary: Sort by count (lowest first for fair rotation)
      if (a.count !== b.count) {
        return a.count - b.count;
      }
      // Secondary: Randomize when counts are equal (prevents same players every time)
      return Math.random() - 0.5;
    });

  sortedCounts.forEach(({ player, count }) => {
    if (count > 0) {
      console.log(`  ${player.name}: ${count} time${count === 1 ? '' : 's'} on 7-player team`);
    }
  });

  // ENHANCED: Select 7 players from a larger candidate pool to ensure team balance
  // Take top ~40% with lowest rotation counts (ensures rotation fairness)
  const poolSize = Math.min(16, Math.ceil(players.length * 0.45));
  const candidatePool = sortedCounts.slice(0, poolSize);

  console.log(`\nSelecting balanced 7-player team from pool of ${poolSize} candidates with lowest rotation counts...`);

  // Calculate target gender distribution based on tournament composition
  const totalMales = players.filter(p => p.gender === 'male').length;
  const totalFemales = players.filter(p => p.gender === 'female').length;
  const maleRatio = totalMales / players.length;
  const targetMalesIn7Team = Math.round(7 * maleRatio);
  const targetFemalesIn7Team = 7 - targetMalesIn7Team;

  console.log(`Tournament composition: ${totalMales}M:${totalFemales}F (${(maleRatio * 100).toFixed(0)}% male)`);
  console.log(`Target for 7-player team: ${targetMalesIn7Team}M:${targetFemalesIn7Team}F`);

  // Categorize candidate pool by skill level and gender
  const poolByCategory = {
    maleAA: candidatePool.filter(c => c.player.gender === 'male' && c.player.skill_level === 'AA'),
    femaleAA: candidatePool.filter(c => c.player.gender === 'female' && c.player.skill_level === 'AA'),
    maleA: candidatePool.filter(c => c.player.gender === 'male' && c.player.skill_level === 'A'),
    femaleA: candidatePool.filter(c => c.player.gender === 'female' && c.player.skill_level === 'A'),
    maleBB: candidatePool.filter(c => c.player.gender === 'male' && c.player.skill_level === 'BB'),
    femaleBB: candidatePool.filter(c => c.player.gender === 'female' && c.player.skill_level === 'BB'),
    maleB: candidatePool.filter(c => c.player.gender === 'male' && c.player.skill_level === 'B'),
    femaleB: candidatePool.filter(c => c.player.gender === 'female' && c.player.skill_level === 'B')
  };

  // Use balanced draft-style selection
  const playersFor7Team = [];
  const pickFromCategory = (category, reason = '') => {
    if (poolByCategory[category] && poolByCategory[category].length > 0) {
      const pick = poolByCategory[category].shift();
      playersFor7Team.push(pick.player);
      console.log(`  Picked: ${pick.player.name} (${category}${reason})`);
      return true;
    }
    return false;
  };

  // Strategy: Balanced skill distribution, avoid clustering
  // Round 1: Try to get mix of skill levels for each gender
  console.log(`\nBalanced selection (targeting ${targetMalesIn7Team}M:${targetFemalesIn7Team}F):`);

  let malesSelected = 0;
  let femalesSelected = 0;

  // Alternate between skill levels to prevent clustering
  const maleCategories = ['maleAA', 'maleA', 'maleBB', 'maleB'];
  const femaleCategories = ['femaleAA', 'femaleA', 'femaleBB', 'femaleB'];

  // Select males (spread across skill levels)
  for (let i = 0; i < targetMalesIn7Team && malesSelected < targetMalesIn7Team; i++) {
    let picked = false;
    // Try each skill level
    for (const category of maleCategories) {
      if (playersFor7Team.length >= 7) break;
      if (pickFromCategory(category)) {
        malesSelected++;
        picked = true;
        break;
      }
    }
    if (!picked) break; // No more males available in pool
  }

  // Select females (spread across skill levels)
  for (let i = 0; i < targetFemalesIn7Team && femalesSelected < targetFemalesIn7Team; i++) {
    let picked = false;
    // Try each skill level
    for (const category of femaleCategories) {
      if (playersFor7Team.length >= 7) break;
      if (pickFromCategory(category)) {
        femalesSelected++;
        picked = true;
        break;
      }
    }
    if (!picked) break; // No more females available in pool
  }

  // Fill remaining slots if we didn't hit 7 (fallback to any available from pool)
  while (playersFor7Team.length < 7) {
    const remaining = candidatePool.filter(c => !playersFor7Team.some(s => s.id === c.player.id));
    if (remaining.length > 0) {
      const pick = remaining[0];
      playersFor7Team.push(pick.player);
      console.log(`  Picked (fallback): ${pick.player.name} (${pick.player.gender}/${pick.player.skill_level})`);
    } else {
      console.error(`❌ Could not select 7 players from candidate pool`);
      break;
    }
  }

  const remainingPlayers = players.filter(p => !playersFor7Team.some(selected => selected.id === p.id));

  // Log final composition
  const finalMales = playersFor7Team.filter(p => p.gender === 'male').length;
  const finalFemales = playersFor7Team.length - finalMales;
  const skillBreakdown = {
    AA: playersFor7Team.filter(p => p.skill_level === 'AA').length,
    A: playersFor7Team.filter(p => p.skill_level === 'A').length,
    BB: playersFor7Team.filter(p => p.skill_level === 'BB').length,
    B: playersFor7Team.filter(p => p.skill_level === 'B').length
  };
  console.log(`\n7-player team composition: ${finalMales}M:${finalFemales}F, Skills: ${skillBreakdown.AA} AA, ${skillBreakdown.A} A, ${skillBreakdown.BB} BB, ${skillBreakdown.B} B`);

  console.log(`Selected for 7-player team (balanced from low-rotation candidates):`);
  playersFor7Team.forEach(player => {
    const count = playerCounts[player.id];
    console.log(`  ${player.name} (${player.gender}/${player.skill_level}, previously on 7-team ${count} time${count === 1 ? '' : 's'})`);
  });

  playersFor7Team.forEach(player => {
    playerCounts[player.id]++;
  });

  // ENHANCED: For 37-player special case, create exactly 5 teams of 6 without dummy players
  // Create 6 balanced teams directly (30 players = 5×6, but we need even number for pairing)
  // We'll create them in 3 pairs for the 3 courts
  const teams = [];
  for (let i = 0; i < 6; i++) {
    teams.push({
      id: `round_${roundNumber}_team_${i + 1}`,
      team_number: i + 1,
      court: Math.floor(i / 2) + 1,
      is_bye_team: false,
      players: [],
      targetSize: 6,
      specialTeamSize: 6,
      stats: {
        male: 0,
        female: 0,
        femaleSetters: 0,
        maleAA: 0, femaleAA: 0,
        maleA: 0, femaleA: 0,
        maleBB: 0, femaleBB: 0,
        maleB: 0, femaleB: 0,
        skillRating: 0
      }
    });
  }

  // Distribute players using the standard categorization and distribution logic
  const shuffledPlayers = shuffleArray([...remainingPlayers]);
  const categories = {
    femaleSetters: shuffledPlayers.filter(p => p.gender === 'female' && p.is_setter),
    maleAA: shuffledPlayers.filter(p => p.gender === 'male' && p.skill_level === 'AA'),
    femaleAA: shuffledPlayers.filter(p => p.gender === 'female' && p.skill_level === 'AA' && !p.is_setter),
    maleA: shuffledPlayers.filter(p => p.gender === 'male' && p.skill_level === 'A'),
    femaleA: shuffledPlayers.filter(p => p.gender === 'female' && p.skill_level === 'A' && !p.is_setter),
    maleBB: shuffledPlayers.filter(p => p.gender === 'male' && p.skill_level === 'BB'),
    femaleBB: shuffledPlayers.filter(p => p.gender === 'female' && p.skill_level === 'BB' && !p.is_setter),
    maleB: shuffledPlayers.filter(p => p.gender === 'male' && p.skill_level === 'B'),
    femaleB: shuffledPlayers.filter(p => p.gender === 'female' && p.skill_level === 'B' && !p.is_setter),
    maleOther: shuffledPlayers.filter(p =>
      p.gender === 'male' && !p.is_setter &&
      !['AA', 'A', 'BB', 'B'].includes(p.skill_level)
    )
  };

  // Create team pairs for balanced matching
  const teamPairs = [
    { team1: teams[0], team2: teams[1], court: 1 },
    { team1: teams[2], team2: teams[3], court: 2 },
    { team1: teams[4], team2: teams[5], court: 3 }
  ];

  // Distribute players in priority order
  const distributionOrder = [
    'femaleSetters', 'maleAA', 'femaleAA', 'maleA', 'femaleA',
    'maleBB', 'femaleBB', 'maleOther', 'maleB', 'femaleB'
  ];

  distributionOrder.forEach(category => {
    const playersInCategory = categories[category];
    playersInCategory.forEach(player => {
      // Use constraint-aware team selection for only the first 5 teams
      const teamsFor37 = teams.slice(0, 5);
      const pairsFor37 = teamPairs.slice(0, 2); // Only first 2 pairs (courts 1 & 2)
      const bestTeam = findBestTeamForPlayerWithConstraints(teamsFor37, pairsFor37, player, category);

      if (bestTeam && bestTeam.players.length < 6) {
        bestTeam.players.push(player);
        updateTeamStats(bestTeam.stats, player);
      } else {
        // Fallback: add to first available team
        const availableTeams = teamsFor37.filter(t => t.players.length < 6);
        if (availableTeams.length > 0) {
          availableTeams[0].players.push(player);
          updateTeamStats(availableTeams[0].stats, player);
        }
      }
    });
  });

  // Keep only the first 5 teams (discard the empty 6th team)
  const teamsToKeep = teams.slice(0, 5);

  // Validate we have exactly 30 players
  const totalPlayersInBalancedTeams = teamsToKeep.reduce((sum, team) => sum + team.players.length, 0);
  if (totalPlayersInBalancedTeams !== 30) {
    console.error(`❌ Expected 30 players in balanced teams, got ${totalPlayersInBalancedTeams}`);
    console.error(`Team sizes: ${teamsToKeep.map(t => t.players.length).join(', ')}`);
  }

  // Create the 7-player team with stats initialized
  const oversizeTeam = {
    id: `round_${roundNumber}_team_6`,
    team_number: 6,
    court: 3,
    is_bye_team: false,
    players: playersFor7Team,
    specialTeamSize: 7,
    isOversizeTeam: true,
    stats: {
      male: 0,
      female: 0,
      femaleSetters: 0,
      maleAA: 0, femaleAA: 0,
      maleA: 0, femaleA: 0,
      maleBB: 0, femaleBB: 0,
      maleB: 0, femaleB: 0,
      skillRating: 0
    }
  };

  // Calculate stats for the 7-player team
  playersFor7Team.forEach(player => {
    updateTeamStats(oversizeTeam.stats, player);
  });

  // Check and log constraints for 7-player team
  const malesIn7Team = playersFor7Team.filter(p => p.gender === 'male').length;
  const bPlayersIn7Team = playersFor7Team.filter(p => p.skill_level === 'B').length;
  console.log(`  7-player team: ${malesIn7Team} males, ${bPlayersIn7Team} B-rated players`);
  if (malesIn7Team < 2) {
    console.warn(`  ⚠️  7-player team has only ${malesIn7Team} male(s)`);
  }
  if (bPlayersIn7Team > 1) {
    console.warn(`  ⚠️  7-player team has ${bPlayersIn7Team} B-rated players`);
  }

  const allTeams = [...teamsToKeep, oversizeTeam];

  console.log(`\nTeam compositions:`);
  allTeams.forEach(team => {
    const marker = team.isOversizeTeam ? ' (7-PLAYER TEAM)' : '';
    const males = team.players.filter(p => p.gender === 'male').length;
    const females = team.players.length - males;
    console.log(`  Team ${team.team_number}${marker}: ${team.players.length} players (${males}M:${females}F) - Court ${team.court}`);
  });

  console.log(`\nRotation summary after Round ${roundNumber}:`);
  const maxCount = Math.max(...Object.values(playerCounts));
  const minCount = Math.min(...Object.values(playerCounts));

  console.log(`  Most 7-team assignments: ${maxCount}, Least: ${minCount}`);
  if (maxCount - minCount <= 1) {
    console.log(`  ✅ Rotation is well balanced (max difference: ${maxCount - minCount})`);
  } else {
    console.log(`  ⚠️  Rotation imbalance detected (difference: ${maxCount - minCount})`);
  }

  // Validate all teams including the 7-player team
  validateAllTeamsConstraints(allTeams);

  return allTeams;
}

function createSpecial37PlayerMatches(teams) {
  console.log(`\n=== Creating Special 37-Player Matches ===`);
  
  const matches = [];
  
  matches.push({
    id: `match_court_1`,
    court: 1,
    team1_id: teams[0].id,
    team2_id: teams[1].id,
    team1: teams[0],
    team2: teams[1],
    is_completed: false,
    matchType: 'regular_6v6'
  });
  
  matches.push({
    id: `match_court_2`,
    court: 2,
    team1_id: teams[2].id,
    team2_id: teams[3].id,
    team1: teams[2],
    team2: teams[3],
    is_completed: false,
    matchType: 'regular_6v6'
  });
  
  matches.push({
    id: `match_court_3`,
    court: 3,
    team1_id: teams[4].id,
    team2_id: teams[5].id,
    team1: teams[4],
    team2: teams[5],
    is_completed: false,
    matchType: 'special_6v7',
    isOversizeMatch: true
  });
  
  console.log(`Matches created:`);
  console.log(`  Court 1: Team 1 (6) vs Team 2 (6)`);
  console.log(`  Court 2: Team 3 (6) vs Team 4 (6)`);
  console.log(`  Court 3: Team 5 (6) vs Team 6 (7) [OVERSIZE MATCH]`);
  
  return matches;
}

module.exports = { 
  generateAllRounds, 
  generateTeams, 
  generateTeamsForRound, 
  balancePlayerMatches,
  resetSpecial37PlayerTracking,
  initializeSpecial37PlayerTracking,
  resetTeammateTracking,
  initializeTeammateTracking
};