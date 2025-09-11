function generateAllRounds(players, settings) {
  const { courtsAvailable, minPlayersPerTeam, matchesPerPlayer, hasPowerMatch } = settings;
  const maxPlayersPerTeam = 6;
  
  const allRounds = [];
  const playerMatchCounts = {};
  const playerOpponents = {};
  const playerByeCount = {};
  
  // Initialize tracking
  players.forEach(p => {
    playerMatchCounts[p.id] = 0;
    playerOpponents[p.id] = new Set();
    playerByeCount[p.id] = 0;
  });
  
  let roundNumber = 1;
  const maxRounds = Math.ceil(matchesPerPlayer * 2); // Safety limit
  
  // Generate rounds until all players have played their required matches
  while (roundNumber <= maxRounds) {
    // Find players who still need matches
    const playersNeedingMatches = players.filter(player => 
      playerMatchCounts[player.id] < matchesPerPlayer
    );
    
    if (playersNeedingMatches.length === 0) {
      console.log('All players have completed their required matches');
      break;
    }
    
    if (playersNeedingMatches.length < minPlayersPerTeam * 2) {
      console.log(`Only ${playersNeedingMatches.length} players need matches, cannot form minimum teams`);
      break;
    }
    
    // Calculate maximum players that can play this round
    const maxPossibleTeams = Math.min(
      courtsAvailable * 2, 
      Math.floor(playersNeedingMatches.length / minPlayersPerTeam)
    );
    
    // Ensure even number of teams
    const actualTeams = maxPossibleTeams % 2 === 0 ? maxPossibleTeams : maxPossibleTeams - 1;
    
    if (actualTeams < 2) {
      console.log(`Cannot form even number of teams with ${playersNeedingMatches.length} players`);
      break;
    }
    
    // Calculate how many players will actually play
    const maxPlayersThisRound = actualTeams * maxPlayersPerTeam;
    const optimalPlayersThisRound = actualTeams * minPlayersPerTeam;
    
    // Select players for this round - prioritize those with fewer matches and byes
    const selectedPlayers = selectPlayersForRound(
      playersNeedingMatches,
      Math.min(maxPlayersThisRound, playersNeedingMatches.length),
      actualTeams,
      minPlayersPerTeam,
      maxPlayersPerTeam,
      playerMatchCounts,
      playerByeCount,
      matchesPerPlayer
    );
    
    if (selectedPlayers.length < minPlayersPerTeam * 2) {
      console.log(`Not enough selected players: ${selectedPlayers.length}`);
      break;
    }
    
    // Generate teams and matches for this round
    const roundData = generateTeamsForRound(
      selectedPlayers,
      actualTeams,
      settings,
      roundNumber
    );
    
    // Validate that we have matches - every team should have an opponent
    if (roundData.matches.length !== actualTeams / 2) {
      console.error(`Round ${roundNumber}: Expected ${actualTeams / 2} matches, got ${roundData.matches.length}`);
      break;
    }
    
    // Update match counts ONLY for players who actually play matches
    roundData.teams.forEach(team => {
      const teamHasMatch = roundData.matches.some(match => 
        match.team1 === team || match.team2 === team
      );
      
      if (teamHasMatch) {
        team.players.forEach(player => {
          playerMatchCounts[player.id]++;
          
          // Track opponents
          team.players.forEach(teammate => {
            if (teammate.id !== player.id) {
              playerOpponents[player.id].add(teammate.id);
            }
          });
        });
      }
    });
    
    // Calculate bye players
    const playingPlayerIds = new Set(selectedPlayers.map(p => p.id));
    const byePlayers = playersNeedingMatches.filter(p => !playingPlayerIds.has(p.id));
    
    // Update bye counts
    byePlayers.forEach(player => {
      playerByeCount[player.id]++;
    });
    
    // Add bye information to round data
    roundData.byePlayers = byePlayers;
    roundData.totalByePlayers = byePlayers.length;
    
    allRounds.push(roundData);
    
    console.log(`Round ${roundNumber}: ${selectedPlayers.length} playing (${roundData.teams.length} teams, ${roundData.matches.length} matches), ${byePlayers.length} bye`);
    
    roundNumber++;
  }
  
  // Final validation and logging
  console.log('\n=== Tournament Generation Summary ===');
  players.forEach(player => {
    const matches = playerMatchCounts[player.id];
    const byes = playerByeCount[player.id];
    if (matches !== matchesPerPlayer) {
      console.warn(`${player.name}: ${matches} matches (expected ${matchesPerPlayer}), ${byes} byes`);
    }
  });
  
  return allRounds;
}

function selectPlayersForRound(playersNeedingMatches, maxPlayers, targetTeams, minPerTeam, maxPerTeam, matchCounts, byeCounts, maxMatches) {
  // Calculate optimal number of players for the target number of teams
  const optimalPlayers = targetTeams * minPerTeam;
  const maxPossiblePlayers = targetTeams * maxPerTeam;
  
  // Don't exceed what we can actually use
  const targetPlayers = Math.min(maxPlayers, Math.min(maxPossiblePlayers, playersNeedingMatches.length));
  
  // Ensure we can form complete teams
  const actualPlayers = Math.min(targetPlayers, Math.floor(targetPlayers / minPerTeam) * minPerTeam);
  
  // Sort players by priority
  const prioritizedPlayers = [...playersNeedingMatches].sort((a, b) => {
    const aMatches = matchCounts[a.id];
    const bMatches = matchCounts[b.id];
    const aByes = byeCounts[a.id];
    const bByes = byeCounts[b.id];
    
    // Priority 1: Players with fewer matches
    if (aMatches !== bMatches) {
      return aMatches - bMatches;
    }
    
    // Priority 2: Players with more byes (they should get priority to play)
    if (aByes !== bByes) {
      return bByes - aByes;
    }
    
    // Priority 3: Random for variety
    return Math.random() - 0.5;
  });
  
  return prioritizedPlayers.slice(0, actualPlayers);
}

function generateTeamsForRound(players, targetTeams, settings, roundNumber) {
  const { hasPowerMatch } = settings;
  
  if (targetTeams % 2 !== 0) {
    throw new Error(`Cannot create odd number of teams: ${targetTeams}`);
  }
  
  if (players.length < targetTeams * 2) {
    throw new Error(`Not enough players (${players.length}) for ${targetTeams} teams`);
  }
  
  // Calculate players per team
  const basePlayersPerTeam = Math.floor(players.length / targetTeams);
  const extraPlayers = players.length % targetTeams;
  
  // Separate and shuffle players by category
  const femaleSetters = shuffleArray([...players.filter(p => p.gender === 'female' && p.is_setter)]);
  const maleSetters = shuffleArray([...players.filter(p => p.gender === 'male' && p.is_setter)]);
  const femaleNonSetters = shuffleArray([...players.filter(p => p.gender === 'female' && !p.is_setter)]);
  const maleNonSetters = shuffleArray([...players.filter(p => p.gender === 'male' && !p.is_setter)]);
  
  // Create teams
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
  
  // Distribute players evenly across teams
  distributePlayersEvenly(teams, femaleSetters, 'female', true);
  distributePlayersEvenly(teams, maleSetters, 'male', true);
  distributePlayersEvenly(teams, femaleNonSetters, 'female', false);
  distributePlayersEvenly(teams, maleNonSetters, 'male', false);
  
  // Validate all teams have players
  const validTeams = teams.filter(team => team.players.length > 0);
  if (validTeams.length !== targetTeams) {
    console.warn(`Expected ${targetTeams} teams, got ${validTeams.length} valid teams`);
  }
  
  // Create matches by pairing teams
  const matches = createMatches(validTeams, roundNumber, hasPowerMatch);
  
  return {
    roundNumber,
    teams: validTeams,
    matches,
    totalPlayingPlayers: players.length,
    byePlayers: [], // Will be set by calling function
    totalByePlayers: 0
  };
}

function distributePlayersEvenly(teams, players, gender, isSetter) {
  for (let i = 0; i < players.length; i++) {
    // Find the team with the most space and best balance
    const availableTeams = teams.filter(team => team.players.length < team.targetSize);
    
    if (availableTeams.length === 0) {
      console.warn('No available teams for player distribution');
      break;
    }
    
    // Sort by availability and balance
    availableTeams.sort((a, b) => {
      const aSpace = a.targetSize - a.players.length;
      const bSpace = b.targetSize - b.players.length;
      
      // Priority 1: Most space available
      if (aSpace !== bSpace) {
        return bSpace - aSpace;
      }
      
      // Priority 2: Better gender balance
      const aGenderCount = gender === 'male' ? a.maleCount : a.femaleCount;
      const bGenderCount = gender === 'male' ? b.maleCount : b.femaleCount;
      
      if (aGenderCount !== bGenderCount) {
        return aGenderCount - bGenderCount;
      }
      
      // Priority 3: Setter balance
      if (isSetter && a.setterCount !== b.setterCount) {
        return a.setterCount - b.setterCount;
      }
      
      return 0;
    });
    
    const selectedTeam = availableTeams[0];
    selectedTeam.players.push(players[i]);
    
    if (gender === 'male') {
      selectedTeam.maleCount++;
    } else {
      selectedTeam.femaleCount++;
    }
    
    if (isSetter) {
      selectedTeam.setterCount++;
    }
  }
}

function createMatches(teams, roundNumber, hasPowerMatch) {
  if (teams.length % 2 !== 0) {
    console.error(`Cannot create matches with odd number of teams: ${teams.length}`);
    return [];
  }
  
  const matches = [];
  const shuffledTeams = shuffleArray([...teams]);
  
  // Create matches by pairing adjacent teams
  for (let i = 0; i < shuffledTeams.length; i += 2) {
    if (i + 1 < shuffledTeams.length) {
      const court = Math.floor(i / 2) + 1;
      let isPowerMatch = false;
      
      // Check for power match
      if (hasPowerMatch && roundNumber >= 3 && court === 1 && !matches.some(m => m.isPowerMatch)) {
        isPowerMatch = shouldBePowerMatch(shuffledTeams[i], shuffledTeams[i + 1]);
      }
      
      matches.push({
        team1: shuffledTeams[i],
        team2: shuffledTeams[i + 1],
        court: court,
        isPowerMatch
      });
    }
  }
  
  return matches;
}

function shouldBePowerMatch(team1, team2) {
  const getTeamStrength = (team) => {
    if (!team.players || team.players.length === 0) return 0;
    
    return team.players.reduce((sum, player) => {
      const skillPoints = { 'A': 3, 'BB': 2, 'B': 1 };
      return sum + (skillPoints[player.skill_level] || 1);
    }, 0) / team.players.length;
  };
  
  const team1Strength = getTeamStrength(team1);
  const team2Strength = getTeamStrength(team2);
  
  return team1Strength >= 2.0 && team2Strength >= 2.0;
}

function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Legacy function for backward compatibility
function generateTeams(players, settings, roundNumber) {
  return generateTeamsForRound(players, 2, settings, roundNumber);
}

function balancePlayerMatches(allPlayers, tournamentRounds, matchesPerPlayer) {
  const playerMatchCounts = {};
  allPlayers.forEach(p => playerMatchCounts[p.id] = p.matches_played || 0);
  
  return allPlayers.filter(player => 
    playerMatchCounts[player.id] < matchesPerPlayer
  );
}

module.exports = { generateTeams, generateAllRounds, generateTeamsForRound, balancePlayerMatches };
