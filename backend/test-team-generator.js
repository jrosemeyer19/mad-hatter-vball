#!/usr/bin/env node
/**
 * Team Generator Testing Script
 *
 * Tests the tournament team generation algorithm with various player counts,
 * gender ratios, and tournament settings to ensure robustness.
 *
 * Usage:
 *   node test-team-generator.js
 *
 * Or with custom parameters:
 *   node test-team-generator.js --players 25 --min-gender 5 --courts 3 --matches 4 --min-team-size 5
 */

const {
  generateAllRounds,
  resetSpecial37PlayerTracking,
  resetTeammateTracking,
  initializeTeammateTracking
} = require('./utils/teamGenerator');

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    totalPlayers: 25,
    minGenderCount: 5,
    courtsAvailable: 3,
    matchesPerPlayer: 4,
    minPlayersPerTeam: 5,
    verbose: false,
    onlyFailing: false
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--players':
        config.totalPlayers = parseInt(args[++i]);
        break;
      case '--min-gender':
        config.minGenderCount = parseInt(args[++i]);
        break;
      case '--courts':
        config.courtsAvailable = parseInt(args[++i]);
        break;
      case '--matches':
        config.matchesPerPlayer = parseInt(args[++i]);
        break;
      case '--min-team-size':
        config.minPlayersPerTeam = parseInt(args[++i]);
        break;
      case '--verbose':
      case '-v':
        config.verbose = true;
        break;
      case '--only-failing':
        config.onlyFailing = true;
        break;
      case '--help':
      case '-h':
        console.log(`
Team Generator Testing Script

Usage: node test-team-generator.js [options]

Options:
  --players <n>        Total number of players (default: 25)
  --min-gender <n>     Minimum count for either gender (default: 5)
  --courts <n>         Number of courts available (default: 3)
  --matches <n>        Matches per player (default: 4)
  --min-team-size <n>  Minimum players per team (default: 5)
  --verbose, -v        Show detailed output for each test
  --only-failing       Only show tests that fail
  --help, -h           Show this help message

Examples:
  # Test 30 players with min 6 of either gender, 4 courts
  node test-team-generator.js --players 30 --min-gender 6 --courts 4

  # Test with verbose output
  node test-team-generator.js --players 25 --verbose

  # Only show failures
  node test-team-generator.js --players 37 --only-failing
        `);
        process.exit(0);
    }
  }

  return config;
}

// Generate mock players with specified gender distribution
function generatePlayers(totalPlayers, maleCount) {
  const players = [];
  const femaleCount = totalPlayers - maleCount;

  // Skill level distribution (approximate realistic tournament)
  const skillLevels = ['A', 'BB', 'B'];
  const skillDistribution = [0.25, 0.45, 0.30]; // 25% A, 45% BB, 30% B

  let playerId = 1;

  // Generate male players
  for (let i = 0; i < maleCount; i++) {
    const rand = Math.random();
    let skillLevel;
    if (rand < skillDistribution[0]) {
      skillLevel = 'A';
    } else if (rand < skillDistribution[0] + skillDistribution[1]) {
      skillLevel = 'BB';
    } else {
      skillLevel = 'B';
    }

    players.push({
      id: playerId++,
      name: `Male${i + 1}`,
      gender: 'male',
      skill_level: skillLevel,
      is_setter: Math.random() < 0.15 // ~15% are setters
    });
  }

  // Generate female players
  for (let i = 0; i < femaleCount; i++) {
    const rand = Math.random();
    let skillLevel;
    if (rand < skillDistribution[0]) {
      skillLevel = 'A';
    } else if (rand < skillDistribution[0] + skillDistribution[1]) {
      skillLevel = 'BB';
    } else {
      skillLevel = 'B';
    }

    players.push({
      id: playerId++,
      name: `Female${i + 1}`,
      gender: 'female',
      skill_level: skillLevel,
      is_setter: Math.random() < 0.15 // ~15% are setters
    });
  }

  return players;
}

// Validate generated tournament
function validateTournament(players, result, settings) {
  const errors = [];
  const warnings = [];

  if (!result || !result.rounds) {
    errors.push('Generation failed - no rounds generated');
    return { errors, warnings, valid: false };
  }

  const { rounds, validation } = result;

  // Check each player played correct number of matches
  const playerMatchCount = {};
  players.forEach(p => playerMatchCount[p.id] = 0);

  rounds.forEach((round, roundIdx) => {
    round.matches.forEach(match => {
      match.team1.players.forEach(player => playerMatchCount[player.id]++);
      match.team2.players.forEach(player => playerMatchCount[player.id]++);
    });
  });

  players.forEach(player => {
    const actual = playerMatchCount[player.id];
    if (actual !== settings.matchesPerPlayer) {
      errors.push(`${player.name} played ${actual}/${settings.matchesPerPlayer} matches`);
    }
  });

  // Check team sizes
  rounds.forEach((round, roundIdx) => {
    round.teams.forEach((team, teamIdx) => {
      if (!team.is_bye_team) {
        if (team.players.length < settings.minPlayersPerTeam) {
          errors.push(`Round ${roundIdx + 1}, Team ${teamIdx + 1}: Only ${team.players.length} players (min: ${settings.minPlayersPerTeam})`);
        }
        if (team.players.length > 7) {
          errors.push(`Round ${roundIdx + 1}, Team ${teamIdx + 1}: ${team.players.length} players (max: 7)`);
        }
      }
    });
  });

  // Report validation results from generator
  if (validation && validation.violations && validation.violations.length > 0) {
    validation.violations.forEach(v => {
      if (v.severity === 'error') {
        errors.push(`Constraint violation: ${v.message}`);
      } else {
        warnings.push(`Constraint warning: ${v.message}`);
      }
    });
  }

  return {
    errors,
    warnings,
    valid: errors.length === 0,
    totalRounds: rounds.length
  };
}

// Suppress console.log during generation (unless verbose mode)
function suppressConsoleLogs() {
  const originalLog = console.log;
  const originalError = console.error;
  const logs = [];

  console.log = (...args) => {
    logs.push({ type: 'log', args });
  };

  console.error = (...args) => {
    logs.push({ type: 'error', args });
  };

  return {
    restore: () => {
      console.log = originalLog;
      console.error = originalError;
    },
    logs
  };
}

// Run a single test configuration
function runTest(totalPlayers, maleCount, settings, verbose = false) {
  const femaleCount = totalPlayers - maleCount;
  const players = generatePlayers(totalPlayers, maleCount);

  // Reset global tracking state
  resetSpecial37PlayerTracking();
  resetTeammateTracking();

  const testSettings = {
    courtsAvailable: settings.courtsAvailable,
    minPlayersPerTeam: settings.minPlayersPerTeam,
    matchesPerPlayer: settings.matchesPerPlayer
  };

  let result;
  let error = null;
  let generationTime;
  let consoleSuppressor;

  try {
    if (!verbose) {
      consoleSuppressor = suppressConsoleLogs();
    }

    const startTime = Date.now();
    result = generateAllRounds(players, testSettings);
    generationTime = Date.now() - startTime;

    if (!verbose && consoleSuppressor) {
      consoleSuppressor.restore();
    }
  } catch (err) {
    if (!verbose && consoleSuppressor) {
      consoleSuppressor.restore();
    }
    error = err;
    generationTime = 0;
  }

  const validation = error
    ? { valid: false, errors: [error.message], warnings: [], totalRounds: 0 }
    : validateTournament(players, result, testSettings);

  return {
    maleCount,
    femaleCount,
    totalPlayers,
    success: !error && validation.valid,
    error: error ? error.message : null,
    validation,
    generationTime,
    consoleLogs: consoleSuppressor ? consoleSuppressor.logs : null
  };
}

// Run comprehensive test suite
function runTestSuite(config) {
  const { totalPlayers, minGenderCount, courtsAvailable, matchesPerPlayer, minPlayersPerTeam, verbose, onlyFailing } = config;

  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║        Team Generator Comprehensive Testing Suite             ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  console.log('Test Configuration:');
  console.log(`  Total Players:       ${totalPlayers}`);
  console.log(`  Min Gender Count:    ${minGenderCount}`);
  console.log(`  Courts Available:    ${courtsAvailable}`);
  console.log(`  Matches Per Player:  ${matchesPerPlayer}`);
  console.log(`  Min Team Size:       ${minPlayersPerTeam}`);
  console.log('');

  const maxGenderCount = totalPlayers - minGenderCount;
  const testCount = maxGenderCount - minGenderCount + 1;

  console.log(`Testing ${testCount} gender ratio combinations (${minGenderCount}M-${maxGenderCount}F to ${maxGenderCount}M-${minGenderCount}F)\n`);

  const results = [];
  const settings = { courtsAvailable, matchesPerPlayer, minPlayersPerTeam };

  // Progress bar
  const progressBarWidth = 50;
  let testsCompleted = 0;

  for (let maleCount = minGenderCount; maleCount <= maxGenderCount; maleCount++) {
    const result = runTest(totalPlayers, maleCount, settings, verbose);
    results.push(result);

    testsCompleted++;

    // Update progress bar (unless verbose)
    if (!verbose) {
      const progress = testsCompleted / testCount;
      const filled = Math.floor(progress * progressBarWidth);
      const bar = '█'.repeat(filled) + '░'.repeat(progressBarWidth - filled);
      process.stdout.write(`\r[${bar}] ${testsCompleted}/${testCount} tests`);
    }
  }

  if (!verbose) {
    console.log('\n'); // New line after progress bar
  }

  // Print results
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                        TEST RESULTS                            ');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const successCount = results.filter(r => r.success).length;
  const failureCount = results.length - successCount;

  results.forEach(result => {
    const { maleCount, femaleCount, success, error, validation, generationTime } = result;
    const status = success ? '✅ PASS' : '❌ FAIL';
    const ratio = `${maleCount}M / ${femaleCount}F`;

    // Skip successful tests if only showing failures
    if (onlyFailing && success) {
      return;
    }

    console.log(`${status} | ${ratio.padEnd(12)} | ${generationTime}ms`);

    if (!success) {
      if (error) {
        console.log(`       Error: ${error}`);
      }
      if (validation.errors.length > 0) {
        validation.errors.forEach(err => {
          console.log(`       • ${err}`);
        });
      }
    }

    if (validation.warnings.length > 0 && !onlyFailing) {
      validation.warnings.forEach(warn => {
        console.log(`       ⚠ ${warn}`);
      });
    }

    if (verbose && result.consoleLogs) {
      console.log('\n       --- Generator Output ---');
      result.consoleLogs.forEach(log => {
        console.log(`       ${log.type}:`, ...log.args);
      });
      console.log('       --- End Output ---\n');
    }
  });

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('                          SUMMARY                               ');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log(`Total Tests:     ${results.length}`);
  console.log(`Passed:          ${successCount} (${((successCount / results.length) * 100).toFixed(1)}%)`);
  console.log(`Failed:          ${failureCount} (${((failureCount / results.length) * 100).toFixed(1)}%)`);

  if (successCount > 0) {
    const avgTime = results.filter(r => r.success).reduce((sum, r) => sum + r.generationTime, 0) / successCount;
    console.log(`Avg Gen Time:    ${avgTime.toFixed(0)}ms (successful tests only)`);
  }

  console.log('');

  if (failureCount === 0) {
    console.log('🎉 All tests passed! The team generator handles all gender ratios successfully.\n');
  } else {
    console.log('⚠️  Some tests failed. Review the failed configurations above.\n');
    console.log('Consider running with --verbose flag on failing configurations for detailed output.\n');
  }

  // Return summary for programmatic use
  return {
    totalTests: results.length,
    passed: successCount,
    failed: failureCount,
    results
  };
}

// Additional function: Test multiple configurations
function runMultipleConfigurations() {
  console.log('Running multiple configuration tests...\n');

  const configurations = [
    { totalPlayers: 25, minGenderCount: 5, courts: 3, matches: 4, minTeam: 5 },
    { totalPlayers: 30, minGenderCount: 6, courts: 3, matches: 4, minTeam: 5 },
    { totalPlayers: 37, minGenderCount: 7, courts: 3, matches: 4, minTeam: 5 },
    { totalPlayers: 40, minGenderCount: 8, courts: 4, matches: 4, minTeam: 5 },
  ];

  const allResults = [];

  configurations.forEach((cfg, idx) => {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`Configuration ${idx + 1}/${configurations.length}`);
    console.log(`${'='.repeat(70)}\n`);

    const result = runTestSuite({
      totalPlayers: cfg.totalPlayers,
      minGenderCount: cfg.minGenderCount,
      courtsAvailable: cfg.courts,
      matchesPerPlayer: cfg.matches,
      minPlayersPerTeam: cfg.minTeam,
      verbose: false,
      onlyFailing: true
    });

    allResults.push({ config: cfg, result });
  });

  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║                  MULTI-CONFIGURATION SUMMARY                   ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  allResults.forEach(({ config, result }, idx) => {
    const status = result.failed === 0 ? '✅' : '❌';
    console.log(`${status} Config ${idx + 1}: ${config.totalPlayers} players, ${config.courts} courts - ${result.passed}/${result.totalTests} passed`);
  });

  console.log('');
}

// Main execution
if (require.main === module) {
  const config = parseArgs();

  // Check if user wants to run multiple configurations
  if (process.argv.includes('--multi')) {
    runMultipleConfigurations();
  } else {
    runTestSuite(config);
  }
}

module.exports = {
  generatePlayers,
  runTest,
  runTestSuite
};
