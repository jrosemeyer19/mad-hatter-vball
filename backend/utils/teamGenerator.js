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
  console.log(`Teammate rotation tracking reset`);
}

function getSkillRating(player) {
  const skillValues = {
    'male': {
      'A': 3.0,
      'BB': 2.0,
      'B': 1.0
    },
    'female': {
      'A': 2.5,
      'BB': 1.5,
      'B': 0.5
    }
  };
  
  const gender = player.gender.toLowerCase();
  const baseSkill = skillValues[gender]?.[player.skill_level] || 1.5;
  
  const setterBonus = player.is_setter ? 0.3 : 0;
  
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
  
  initializeTeammateTracking(players);
  
  validateInputs(players, settings);
  
  const structure = calculateOptimalStructure(players.length, settings);
  
  const byeSchedule = generateFlexibleByeSchedule(players, structure.flexibleRounds);
  
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
    
    const round = generateFlexibleRound(playingPlayers, byePlayers, structure.courtsUsed, settings.minPlayersPerTeam, roundNum);
    allRounds.push(round);
    
    round.teams.forEach(team => {
      if (!team.is_bye_team) {
        recordTeammates(team);
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
  
  console.log('\n=== Flexible Tournament Generation Complete ===');
  return allRounds;
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

function generateFlexibleRound(playingPlayers, byePlayers, courtsUsed, minPlayersPerTeam, roundNumber) {
  const maxPlayersPerTeam = 6;
  const maxTeams = courtsUsed * 2;
  
  console.log(`\n=== Creating Flexible Round ${roundNumber} ===`);
  console.log(`Playing players: ${playingPlayers.length}, Courts available: ${courtsUsed}`);

  if (playingPlayers.length === 37 && courtsUsed === 3) {
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

function calculateOptimalStructure(totalPlayers, settings) {
  console.log(`\n--- Match-Balanced Structure Calculation ---`);
  console.log(`Total players: ${totalPlayers}`);
  console.log(`Available courts: ${settings.courtsAvailable}`);
  console.log(`Matches per player: ${settings.matchesPerPlayer}`);
  console.log(`Min per team: ${settings.minPlayersPerTeam}`);

  if (totalPlayers === 37 && 
      settings.courtsAvailable === 3 && 
      settings.matchesPerPlayer === 4 && 
      settings.minPlayersPerTeam === 5) {
    
    console.log(`\n🎯 SPECIAL CASE: 37-player tournament with 7-player team override`);
    console.log(`Using constraint override: one team of 7 players per round`);
    
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
  
  const maxPlayersPerTeam = 6;
  
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

  for (const constraintSet of constraintOptions) {
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
          
          rounds.push({
            roundNumber: i + 1,
            playersPlaying: playersThisRound,
            playersBye: totalPlayers - playersThisRound
          });
          
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
          
          return {
            courtsUsed: courtsToUse,
            flexibleRounds: rounds,
            constraintOverrides: {
              minTeamSizeUsed: constraintSet.minTeamSize,
              courtsReduced: usedCourtReduction,
              teamSizeRelaxed: usedConstraintOverride
            }
          };
        } else {
          console.log(`        ${numRounds} rounds doesn't work`);
        }
      }
    }
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

function generateFlexibleByeSchedule(players, flexibleRounds) {
  console.log(`\n=== Robust Match-Guaranteed Bye Schedule ===`);

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
  
  const totalPlayerMatches = flexibleRounds.reduce((sum, round) => sum + round.playersPlaying, 0);
  const matchesPerPlayer = totalPlayerMatches / totalPlayers;
  
  console.log(`Total rounds: ${totalRounds}`);
  console.log(`Total player-matches: ${totalPlayerMatches}`);
  console.log(`Required matches per player: ${matchesPerPlayer}`);
  
  if (matchesPerPlayer !== Math.floor(matchesPerPlayer)) {
    throw new Error(`Invalid tournament structure: matches per player must be whole number, got ${matchesPerPlayer}`);
  }
  
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
  
  for (let roundIndex = 0; roundIndex < totalRounds; roundIndex++) {
    const round = flexibleRounds[roundIndex];
    const playersNeeded = round.playersPlaying;
    const byesNeeded = totalPlayers - playersNeeded;
    
    console.log(`\n--- Assigning Round ${roundIndex + 1}: ${playersNeeded} players needed, ${byesNeeded} on bye ---`);
    
    const shouldUseExtra = roundIndex >= (totalRounds - extraRoundsNeeded);
    const optimalFemaleSetterByes = shouldUseExtra ? (minByesPerRound + 1) : minByesPerRound;
    
    console.log(`  Optimal female setter byes this round: ${optimalFemaleSetterByes} (${shouldUseExtra ? 'using extra' : 'using minimum'})`);
    
    const femaleSettersCanGoOnByeList = femaleSetters.filter(fs => {
      const assignment = playerRoundAssignments[fs.id];
      const matchesNeeded = matchesPerPlayer - assignment.matchesAssigned;
      const roundsLeft = totalRounds - roundIndex;
      
      return matchesNeeded < roundsLeft;
    });
    
    const femaleSetterByeSlotsThisRound = Math.min(
      optimalFemaleSetterByes,
      femaleSettersCanGoOnByeList.length,
      byesNeeded
    );
    
    console.log(`  Will put ${femaleSetterByeSlotsThisRound} female setter(s) on bye (${femaleSettersCanGoOnByeList.length} available)`);
    
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
    
    const femaleSettersPlaying = femaleSetters.filter(fs => !femaleSettersGoingOnBye.includes(fs));
    
    console.log(`  Female setters playing (${femaleSettersPlaying.length}): ${femaleSettersPlaying.map(p => p.name).join(', ')}`);
    console.log(`  Female setters on bye (${femaleSettersGoingOnBye.length}): ${femaleSettersGoingOnBye.map(p => p.name).join(', ')}`);
    
    const otherPlayers = players.filter(p => !(p.gender === 'female' && p.is_setter));
    
    const otherPlayersSorted = otherPlayers.sort((a, b) => {
      const aAssignment = playerRoundAssignments[a.id];
      const bAssignment = playerRoundAssignments[b.id];
      
      const aMatchesNeeded = matchesPerPlayer - aAssignment.matchesAssigned;
      const bMatchesNeeded = matchesPerPlayer - bAssignment.matchesAssigned;
      
      if (aMatchesNeeded !== bMatchesNeeded) {
        return bMatchesNeeded - aMatchesNeeded;
      }
      
      const aLastRound = aAssignment.roundsPlaying.length > 0 ? 
        Math.max(...aAssignment.roundsPlaying) : -2;
      const bLastRound = bAssignment.roundsPlaying.length > 0 ? 
        Math.max(...bAssignment.roundsPlaying) : -2;
      
      const aIsConsecutive = (roundIndex - aLastRound) === 1;
      const bIsConsecutive = (roundIndex - bLastRound) === 1;
      
      if (aIsConsecutive !== bIsConsecutive) {
        return aIsConsecutive ? 1 : -1;
      }
      
      if (aAssignment.matchesAssigned !== bAssignment.matchesAssigned) {
        return aAssignment.matchesAssigned - bAssignment.matchesAssigned;
      }
      
      return Math.random() - 0.5;
    });
    
    const otherPlayersNeeded = playersNeeded - femaleSettersPlaying.length;
    const otherPlayersPlaying = otherPlayersSorted.slice(0, otherPlayersNeeded);
    const otherPlayersOnBye = otherPlayersSorted.slice(otherPlayersNeeded);
    
    const selectedPlayers = [...femaleSettersPlaying, ...otherPlayersPlaying];
    const byePlayers = [...femaleSettersGoingOnBye, ...otherPlayersOnBye];
    
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
    
    if (tryFixAssignments(playerRoundAssignments, flexibleRounds, matchesPerPlayer, players)) {
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

function tryFixAssignments(playerRoundAssignments, flexibleRounds, matchesPerPlayer, players) {
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

function generateRound(playingPlayers, byePlayers, structure, roundNumber) {
  const maxPlayersPerTeam = 6;
  const maxTeams = structure.courtsUsed * 2;
  
  let teamConfig = null;
  
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

  console.log(`\nCreating ${teamPairs.length} balanced match pairs with teammate rotation...`);

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
  
  const distributionOrder = [
    'femaleSetters',
    'maleA',
    'femaleA',
    'maleBB',
    'femaleBB',
    'maleB',
    'femaleB',
    'maleOther'
  ];
  
  distributionOrder.forEach(category => {
    const playersInCategory = categories[category];
    
    playersInCategory.forEach(player => {
      const bestTeam = findBestTeamForPlayerMatchAware(teams, teamPairs, player, category);
      if (bestTeam) {
        bestTeam.players.push(player);
        updateTeamStats(bestTeam.stats, player);
      }
    });
    
    console.log(`Distributed ${playersInCategory.length} ${category} players`);
  });
  
  const assignedPlayerIds = new Set();
  teams.forEach(team => {
    team.players.forEach(player => assignedPlayerIds.add(player.id));
  });
  
  const unassignedPlayers = shuffledPlayers.filter(p => !assignedPlayerIds.has(p.id));
  unassignedPlayers.forEach(player => {
    const availableTeams = teams.filter(team => team.players.length < team.targetSize);
    if (availableTeams.length > 0) {
      const bestTeam = findBestTeamForPlayerMatchAware(teams, teamPairs, player, 'remaining');
      if (bestTeam && bestTeam.players.length < bestTeam.targetSize) {
        bestTeam.players.push(player);
        updateTeamStats(bestTeam.stats, player);
      } else {
        const fallbackTeam = availableTeams[0];
        fallbackTeam.players.push(player);
        updateTeamStats(fallbackTeam.stats, player);
      }
    }
  });
  
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
  
  validateGenderBalance(teams);
  
  validateMatchBalance(teamPairs);
  
  return teams;
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
  
  return Math.abs(newMale - newFemale);
}

function updateTeamStats(stats, player) {
  if (player.gender === 'male') stats.male++;
  if (player.gender === 'female') stats.female++;
  
  if (player.gender === 'female' && player.is_setter) stats.femaleSetters++;
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
  
  Object.keys(teamsBySize).forEach(size => {
    const teamsOfThisSize = teamsBySize[size].filter(team => !usedTeams.has(team.id));
    
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
        matchType: 'equal_size'
      });
      
      usedTeams.add(team1.id);
      usedTeams.add(team2.id);
      
      console.log(`Court ${courtNumber}: Team ${team1.team_number} (${team1.players.length}) vs Team ${team2.team_number} (${team2.players.length}) [EQUAL SIZE]`);
      courtNumber++;
    }
  });
  
  const remainingTeams = teams.filter(team => !usedTeams.has(team.id));
  
  if (remainingTeams.length >= 2) {
    console.log('\n--- Mixed Size Matches ---');
    
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
        matchType: 'mixed_size'
      });
      
      const sizeDiff = Math.abs(team1.players.length - team2.players.length);
      console.log(`Court ${courtNumber}: Team ${team1.team_number} (${team1.players.length}) vs Team ${team2.team_number} (${team2.players.length}) [MIXED SIZE +${sizeDiff}]`);
      courtNumber++;
    }
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
    .sort((a, b) => a.count - b.count);
  
  sortedCounts.forEach(({ player, count }) => {
    if (count > 0) {
      console.log(`  ${player.name}: ${count} time${count === 1 ? '' : 's'} on 7-player team`);
    }
  });
  
  const candidatesFor7Team = sortedCounts.slice(0, 7);
  const playersFor7Team = candidatesFor7Team.map(c => c.player);
  const remainingPlayers = players.filter(p => !playersFor7Team.some(selected => selected.id === p.id));
  
  console.log(`Selected for 7-player team (lowest previous assignments):`);
  playersFor7Team.forEach(player => {
    const count = playerCounts[player.id];
    console.log(`  ${player.name} (previously on 7-team ${count} time${count === 1 ? '' : 's'})`);
  });
  
  playersFor7Team.forEach(player => {
    playerCounts[player.id]++;
  });
  
  const teams = [];
  
  const shuffledRemaining = shuffleArray([...remainingPlayers]);
  
  for (let i = 0; i < 5; i++) {
    const teamPlayers = shuffledRemaining.splice(0, 6);
    
    teams.push({
      id: `round_${roundNumber}_team_${i + 1}`,
      team_number: i + 1,
      court: Math.floor(i / 2) + 1,
      is_bye_team: false,
      players: teamPlayers,
      specialTeamSize: 6
    });
  }
  
  teams.push({
    id: `round_${roundNumber}_team_6`,
    team_number: 6,
    court: 3,
    is_bye_team: false,
    players: playersFor7Team,
    specialTeamSize: 7,
    isOversizeTeam: true
  });
  
  console.log(`\nTeam compositions:`);
  teams.forEach(team => {
    const marker = team.isOversizeTeam ? ' (7-PLAYER TEAM)' : '';
    console.log(`  Team ${team.team_number}${marker}: ${team.players.length} players - Court ${team.court}`);
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
  
  return teams;
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