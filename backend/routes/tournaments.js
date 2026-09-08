const express = require('express');
const pool = require('../database/db');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const {
  canManageTournament,
  canToggleSharing,
  requireTournamentManager
} = require('../middleware/tournamentAccess');
const { generateTeams, generateAllRounds, balancePlayerMatches, calculateMatchBalance } = require('../utils/teamGenerator');

const router = express.Router();

// Entry fee and director cost are the director's business, not the players'.
// Stripped from every anonymous response so the numbers are absent from the
// payload itself, not merely hidden by the UI.
function withoutFinancials(tournament) {
  const { entry_fee, director_cost, ...rest } = tournament;
  return rest;
}

// Get all tournaments (public - shows active tournaments)
router.get('/', optionalAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, date, location, status, created_by, allow_shared_management
      FROM tournaments 
      WHERE status IN ('in_progress', 'setup')
      ORDER BY date DESC, created_at DESC
    `);

    // created_by and the sharing flag are only fetched to work out can_manage;
    // this listing is public, so they are dropped rather than handed to every
    // player who opens the tournament list.
    res.json(result.rows.map(({ created_by, allow_shared_management, ...tournament }) => ({
      ...tournament,
      can_manage: canManageTournament({ created_by, allow_shared_management }, req.user)
    })));
  } catch (error) {
    console.error('Error fetching tournaments:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get historical tournaments (authenticated users only)
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.*, u.username as created_by_username
      FROM tournaments t
      LEFT JOIN users u ON t.created_by = u.id
      ORDER BY t.date DESC, t.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching tournament history:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update tournament (authenticated users only)
router.put('/:id', authenticateToken, requireTournamentManager, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name, date, location, courtsAvailable = 3, minPlayersPerTeam = 5,
      matchesPerPlayer = 4, entryFee = 0, directorCost = 0,
      allowSevenPlayerTeams = false, allowSharedManagement
    } = req.body;

    if (!name || !date || !location) {
      return res.status(400).json({ message: 'Name, date, and location are required' });
    }

    // requireTournamentManager already loaded the row and confirmed access
    if (req.tournament.status !== 'setup') {
      return res.status(400).json({ message: 'Can only edit tournaments in setup phase' });
    }

    // A co-manager can edit everything about a shared tournament except who is
    // allowed to manage it, so their submitted value is ignored in favour of
    // what the owner set. The form disables the checkbox for them too; this is
    // the half that a hand-made request cannot get around.
    const sharedManagement = canToggleSharing(req.tournament, req.user)
      ? allowSharedManagement === true
      : req.tournament.allow_shared_management;

    const result = await pool.query(`
      UPDATE tournaments
      SET name = $1, date = $2, location = $3, courts_available = $4,
          min_players_per_team = $5, matches_per_player = $6, entry_fee = $7,
          director_cost = $8, allow_seven_player_teams = $9,
          allow_shared_management = $10
      WHERE id = $11
      RETURNING *
    `, [name, date, location, courtsAvailable, minPlayersPerTeam, matchesPerPlayer,
        entryFee, directorCost, allowSevenPlayerTeams, sharedManagement, id]);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating tournament:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new tournament (authenticated users only)
router.post('/', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const {
      name, date, location, courtsAvailable = 3, minPlayersPerTeam = 5,
      matchesPerPlayer = 4, entryFee = 0, directorCost = 0,
      allowSevenPlayerTeams = false, allowSharedManagement = false
    } = req.body;

    if (!name || !date || !location) {
      return res.status(400).json({ message: 'Name, date, and location are required' });
    }

    const result = await client.query(`
      INSERT INTO tournaments (
        name, date, location, courts_available, min_players_per_team,
        matches_per_player, entry_fee, director_cost, allow_seven_player_teams,
        allow_shared_management, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [name, date, location, courtsAvailable, minPlayersPerTeam, matchesPerPlayer,
        entryFee, directorCost, allowSevenPlayerTeams,
        allowSharedManagement === true, req.user.id]);
    
    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating tournament:', error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
});

// Get tournament results with payouts (for completed tournaments) - FIXED VERSION
router.get('/:id/results', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Getting results for tournament ID:', id);
    
    // Get tournament details
    const tournamentResult = await pool.query('SELECT * FROM tournaments WHERE id = $1', [id]);
    if (tournamentResult.rows.length === 0) {
      console.log('Tournament not found:', id);
      return res.status(404).json({ message: 'Tournament not found' });
    }
    
    const tournament = tournamentResult.rows[0];
    console.log('Tournament status:', tournament.status);
    
    if (tournament.status !== 'completed') {
      console.log('Tournament not completed, status:', tournament.status);
      return res.status(400).json({ message: 'Tournament is not completed yet' });
    }
    
    // Get final standings with point differential
    const standingsResult = await pool.query(`
      SELECT name, gender, total_points, point_differential, matches_played,
        RANK() OVER (PARTITION BY gender ORDER BY total_points DESC, point_differential DESC) as rank
      FROM players 
      WHERE tournament_id = $1
      ORDER BY gender, total_points DESC, point_differential DESC
    `, [id]);
    
    console.log('Standings found:', standingsResult.rows.length, 'players');
    
    // Calculate payouts - FIXED CALCULATION
    const totalEntryFees = standingsResult.rows.length * parseFloat(tournament.entry_fee || 0);
    const directorCost = parseFloat(tournament.director_cost || 0);
    const totalPool = Math.max(0, totalEntryFees - directorCost);
    
    console.log('Payout calculation:');
    console.log('- Players:', standingsResult.rows.length);
    console.log('- Entry fee per player:', tournament.entry_fee);
    console.log('- Total entry fees:', totalEntryFees);
    console.log('- Director cost:', directorCost);
    console.log('- Total pool:', totalPool);
    
    let payouts;
    
    if (totalPool <= 0) {
      // No money to distribute
      payouts = {
        first: 0,
        second: 0,
        third: 0
      };
      console.log('No prize pool - entry fee is $0 or too low');
    } else {
      // Calculate percentage-based payouts, rounded down to nearest $5
      const firstPlace = totalPool * 0.30;
      const secondPlace = totalPool * 0.15;
      const thirdPlace = totalPool * 0.05;
      
      payouts = {
        first: Math.floor(firstPlace / 5) * 5, // Round down to nearest $5
        second: Math.floor(secondPlace / 5) * 5,
        third: Math.floor(thirdPlace / 5) * 5
      };
      
      console.log('Calculated payouts:');
      console.log('- 1st place (30%):', payouts.first);
      console.log('- 2nd place (15%):', payouts.second);
      console.log('- 3rd place (5%):', payouts.third);
      
      // Calculate remaining money
      const distributedMoney = (payouts.first + payouts.second + payouts.third) * 2; // Both male and female divisions
      const remainingMoney = totalPool - distributedMoney;
      console.log('- Money distributed:', distributedMoney);
      console.log('- Remaining for director:', remainingMoney);
    }
    
    // Standings are public; the money is not
    const results = {
      tournament: req.user ? tournament : withoutFinancials(tournament),
      standings: standingsResult.rows
    };

    if (req.user) {
      results.payouts = payouts;
      results.totalPool = totalPool;
      results.hasPayouts = totalPool > 0;
    }

    res.json(results);
  } catch (error) {
    console.error('Error fetching tournament results:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
});

// Get tournament details (updated to include bye teams)
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get tournament info
    const tournamentResult = await pool.query('SELECT * FROM tournaments WHERE id = $1', [id]);
    if (tournamentResult.rows.length === 0) {
      return res.status(404).json({ message: 'Tournament not found' });
    }
    
    const tournament = tournamentResult.rows[0];
    
    // Get players
    const playersResult = await pool.query(`
      SELECT * FROM players WHERE tournament_id = $1 ORDER BY name
    `, [id]);
    
    // Get rounds with teams (including bye teams) and matches
    const roundsResult = await pool.query(`
      SELECT r.*, 
        json_agg(
          json_build_object(
            'id', t.id,
            'team_number', t.team_number,
            'court', t.court,
            'is_bye_team', t.is_bye_team,
            'players', (
              SELECT json_agg(
                json_build_object(
                  'id', p.id,
                  'name', p.name,
                  'gender', p.gender,
                  'skill_level', p.skill_level,
                  'is_setter', p.is_setter
                )
                ORDER BY tp.id
              )
              FROM team_players tp
              JOIN players p ON tp.player_id = p.id
              WHERE tp.team_id = t.id
            )
          )
          ORDER BY 
            CASE WHEN t.is_bye_team THEN 1 ELSE 0 END,
            t.team_number
        ) as teams
      FROM rounds r
      LEFT JOIN teams t ON r.id = t.round_id
      WHERE r.tournament_id = $1
      GROUP BY r.id
      ORDER BY r.round_number
    `, [id]);
    
    // Get matches
    const matchesResult = await pool.query(`
      SELECT m.*, r.round_number
      FROM matches m
      JOIN rounds r ON m.round_id = r.id
      WHERE r.tournament_id = $1
      ORDER BY r.round_number, m.court
    `, [id]);
    
    // Attach per-match balance metrics. These are derived from the stored
    // rosters using the same rating functions the generator optimizes with,
    // so what the UI shows always matches what the algorithm was aiming for.
    const playersByTeamId = new Map();
    roundsResult.rows.forEach(round => {
      (round.teams || []).forEach(team => {
        if (team && team.id) playersByTeamId.set(team.id, team.players || []);
      });
    });

    const matches = matchesResult.rows.map(match => {
      const team1Players = playersByTeamId.get(match.team1_id);
      const team2Players = playersByTeamId.get(match.team2_id);

      if (!team1Players?.length || !team2Players?.length) return match;

      return { ...match, balance: calculateMatchBalance(team1Players, team2Players) };
    });

    res.json({
      tournament: {
        ...(req.user ? tournament : withoutFinancials(tournament)),
        // Lets the UI show management controls only to someone who can
        // actually use them, instead of offering buttons that 403.
        can_manage: canManageTournament(tournament, req.user),
        can_toggle_sharing: canToggleSharing(tournament, req.user)
      },
      players: playersResult.rows,
      rounds: roundsResult.rows,
      matches
    });
  } catch (error) {
    console.error('Error fetching tournament details:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Tournaments whose roster can be copied into this one.
//
// Players belong to a single tournament, so without this every event starts by
// re-entering the same forty-odd people. Only tournaments the user could manage
// themselves are offered: skill ratings are director-only, and this would
// otherwise be a way to lift another director's ratings out of their event.
router.get('/:id/roster-sources', authenticateToken, requireTournamentManager, async (req, res) => {
  try {
    // The join means only tournaments that actually have a roster come back.
    // Every selected column is listed in GROUP BY rather than leaning on
    // Postgres resolving them from the grouped primary key, which keeps the
    // statement portable and its intent obvious.
    const result = await pool.query(`
      SELECT t.id, t.name, t.date, t.status, t.created_at,
             t.created_by, t.allow_shared_management,
             COUNT(p.id)::int AS player_count
      FROM tournaments t
      JOIN players p ON p.tournament_id = t.id
      WHERE t.id <> $1
      GROUP BY t.id, t.name, t.date, t.status, t.created_at,
               t.created_by, t.allow_shared_management
      ORDER BY t.date DESC, t.created_at DESC
    `, [req.params.id]);

    res.json(
      result.rows
        .filter(row => canManageTournament(row, req.user))
        .map(({ created_by, allow_shared_management, ...tournament }) => tournament)
    );
  } catch (error) {
    console.error('Error fetching roster sources:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Copy a roster from another tournament into this one
router.post('/:id/players/copy', authenticateToken, requireTournamentManager, async (req, res) => {
  try {
    const { id } = req.params;
    const { sourceTournamentId } = req.body;

    if (!sourceTournamentId) {
      return res.status(400).json({ message: 'Source tournament is required' });
    }

    if (Number(sourceTournamentId) === Number(id)) {
      return res.status(400).json({ message: 'Cannot copy a roster onto itself' });
    }

    if (req.tournament.status !== 'setup') {
      return res.status(400).json({ message: 'Cannot add players to started tournament' });
    }

    const sourceResult = await pool.query(
      'SELECT * FROM tournaments WHERE id = $1', [sourceTournamentId]
    );

    if (sourceResult.rows.length === 0) {
      return res.status(404).json({ message: 'Source tournament not found' });
    }

    if (!canManageTournament(sourceResult.rows[0], req.user)) {
      return res.status(403).json({
        message: 'You can only copy a roster from a tournament you manage'
      });
    }

    // Copied in one statement so a 40-player roster is one round trip rather
    // than 40. Only the roster fields come across — points, matches played and
    // point differential keep their column defaults, since this is a different
    // event.
    //
    // DISTINCT ON collapses names duplicated within the source, keeping the
    // earliest row. The anti-join then drops anyone already on this
    // tournament's list, compared case-insensitively, so running this twice or
    // after adding a few people by hand adds each person exactly once and
    // leaves the existing spelling alone.
    const inserted = await pool.query(`
      INSERT INTO players (tournament_id, name, gender, skill_level, is_setter)
      SELECT $1::int, source.name, source.gender, source.skill_level, source.is_setter
      FROM (
        SELECT DISTINCT ON (LOWER(name)) name, gender, skill_level, is_setter
        FROM players
        WHERE tournament_id = $2::int
        ORDER BY LOWER(name), id
      ) source
      LEFT JOIN players existing
        ON existing.tournament_id = $1::int
       AND LOWER(existing.name) = LOWER(source.name)
      WHERE existing.id IS NULL
      RETURNING *
    `, [id, sourceTournamentId]);

    const availableResult = await pool.query(
      'SELECT COUNT(DISTINCT LOWER(name))::int AS total FROM players WHERE tournament_id = $1::int',
      [sourceTournamentId]
    );

    res.status(201).json({
      added: inserted.rows.length,
      skipped: availableResult.rows[0].total - inserted.rows.length,
      sourceName: sourceResult.rows[0].name,
      players: inserted.rows
    });
  } catch (error) {
    console.error('Error copying roster:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add player to tournament
router.post('/:id/players', authenticateToken, requireTournamentManager, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, gender, skillLevel, isSetter = false } = req.body;
    
    if (!name || !gender || !skillLevel) {
      return res.status(400).json({ message: 'Name, gender, and skill level are required' });
    }
    
    if (!['male', 'female'].includes(gender)) {
      return res.status(400).json({ message: 'Gender must be male or female' });
    }
    
    if (!['AA', 'A', 'BB', 'B'].includes(skillLevel)) {
      return res.status(400).json({ message: 'Skill level must be AA, A, BB, or B' });
    }
    
    // Check tournament exists and is in setup
    const tournamentCheck = await pool.query(
      'SELECT status FROM tournaments WHERE id = $1', [id]
    );
    
    if (tournamentCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Tournament not found' });
    }
    
    if (tournamentCheck.rows[0].status !== 'setup') {
      return res.status(400).json({ message: 'Cannot add players to started tournament' });
    }
    
    const result = await pool.query(`
      INSERT INTO players (tournament_id, name, gender, skill_level, is_setter)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [id, name, gender, skillLevel, isSetter]);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding player:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update player in tournament
router.put('/:id/players/:playerId', authenticateToken, requireTournamentManager, async (req, res) => {
  try {
    const { id, playerId } = req.params;
    const { name, gender, skillLevel, isSetter = false } = req.body;

    if (!name || !gender || !skillLevel) {
      return res.status(400).json({ message: 'Name, gender, and skill level are required' });
    }

    if (!['male', 'female'].includes(gender)) {
      return res.status(400).json({ message: 'Gender must be male or female' });
    }

    if (!['AA', 'A', 'BB', 'B'].includes(skillLevel)) {
      return res.status(400).json({ message: 'Skill level must be AA, A, BB, or B' });
    }

    // Check tournament exists and is in setup
    const tournamentCheck = await pool.query(
      'SELECT status FROM tournaments WHERE id = $1', [id]
    );

    if (tournamentCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Tournament not found' });
    }

    if (tournamentCheck.rows[0].status !== 'setup') {
      return res.status(400).json({ message: 'Cannot edit players in started tournament' });
    }

    // Update the player
    const result = await pool.query(`
      UPDATE players
      SET name = $1, gender = $2, skill_level = $3, is_setter = $4
      WHERE id = $5 AND tournament_id = $6
      RETURNING *
    `, [name, gender, skillLevel, isSetter, playerId, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Player not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating player:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Remove player from tournament
router.delete('/:id/players/:playerId', authenticateToken, requireTournamentManager, async (req, res) => {
  try {
    const { id, playerId } = req.params;
    
    // Check tournament is in setup
    const tournamentCheck = await pool.query(
      'SELECT status FROM tournaments WHERE id = $1', [id]
    );
    
    if (tournamentCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Tournament not found' });
    }
    
    if (tournamentCheck.rows[0].status !== 'setup') {
      return res.status(400).json({ message: 'Cannot remove players from started tournament' });
    }
    
    const result = await pool.query(
      'DELETE FROM players WHERE id = $1 AND tournament_id = $2 RETURNING name',
      [playerId, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Player not found' });
    }
    
    res.json({ message: `Player ${result.rows[0].name} removed` });
  } catch (error) {
    console.error('Error removing player:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Start tournament (generate all teams and rounds at once) - FIXED TO NOT PRE-COUNT MATCHES
// FIXED VERSION of the Start Tournament Route
// Replace the existing router.post('/:id/start', ...) route with this updated version

router.post('/:id/start', authenticateToken, requireTournamentManager, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const { finalByePlayerName } = req.body;

    // Get tournament and validate
    const tournamentResult = await client.query('SELECT * FROM tournaments WHERE id = $1', [id]);
    if (tournamentResult.rows.length === 0) {
      return res.status(404).json({ message: 'Tournament not found' });
    }

    const tournament = tournamentResult.rows[0];
    if (tournament.status !== 'setup') {
      return res.status(400).json({ message: 'Tournament already started' });
    }

    // Get players
    const playersResult = await client.query('SELECT * FROM players WHERE tournament_id = $1', [id]);
    const players = playersResult.rows;

    if (players.length < tournament.min_players_per_team * 2) {
      return res.status(400).json({ message: 'Not enough players to start tournament' });
    }

    // Generate all rounds at once
    const settings = {
      courtsAvailable: tournament.courts_available,
      minPlayersPerTeam: tournament.min_players_per_team,
      matchesPerPlayer: tournament.matches_per_player,
      allowSevenPlayerTeams: tournament.allow_seven_player_teams === true,
      finalByePlayerName: finalByePlayerName || null
    };
    
    console.log(`\n=== Starting Tournament Generation ===`);
    console.log(`Players: ${players.length}, Courts: ${settings.courtsAvailable}, Min per team: ${settings.minPlayersPerTeam}, Matches per player: ${settings.matchesPerPlayer}`);
    
    // FIXED: Handle the new return format from generateAllRounds
    const generationResult = generateAllRounds(players, settings);
    const allRounds = generationResult.rounds || generationResult; // Support both formats
    
    console.log(`\n=== Database Insertion ===`);
    console.log(`Generated ${allRounds.length} rounds for tournament ${id}`);
    
    // Create all rounds, teams, and matches in the database
    for (let roundIndex = 0; roundIndex < allRounds.length; roundIndex++) {
      const roundData = allRounds[roundIndex];
      console.log(`\nCreating Round ${roundData.roundNumber}: ${roundData.teams.length} teams, ${roundData.matches.length} matches`);
      
      // Create round
      const roundResult = await client.query(`
        INSERT INTO rounds (tournament_id, round_number) 
        VALUES ($1, $2) RETURNING id
      `, [id, roundData.roundNumber]);
      const roundId = roundResult.rows[0].id;
      
      // Create playing teams and assign players
      const teamIdMap = {}; // Track team IDs for match creation
      let playingTeamCount = 0;

      for (let i = 0; i < roundData.teams.length; i++) {
        const team = roundData.teams[i];
        
        if (team.is_bye_team) {
          // Handle bye team separately
          console.log(`  Bye team: ${team.players.length} players`);
          const byeTeamResult = await client.query(`
            INSERT INTO teams (round_id, team_number, court, is_bye_team) 
            VALUES ($1, $2, NULL, true) RETURNING id
          `, [roundId, i + 1]);
          
          const byeTeamId = byeTeamResult.rows[0].id;
          
          // Assign bye players to bye team
          for (const player of team.players) {
            await client.query(`
              INSERT INTO team_players (team_id, player_id) VALUES ($1, $2)
            `, [byeTeamId, player.id]);
          }
        } else {
          // Handle playing team
          playingTeamCount++;
          // Use the court assignment from the team generator instead of recalculating
          // The team.court value is set by assignCourtsAcrossRounds to match the match court
          const court = team.court;
          
          const teamResult = await client.query(`
            INSERT INTO teams (round_id, team_number, court, is_bye_team) 
            VALUES ($1, $2, $3, false) RETURNING id
          `, [roundId, i + 1, court]);
          
          const teamId = teamResult.rows[0].id;
          teamIdMap[i] = teamId;
          
          console.log(`  Team ${i + 1}: ${team.players.length} players on Court ${court}`);
          
          // Assign players to team
          for (const player of team.players) {
            await client.query(`
              INSERT INTO team_players (team_id, player_id) VALUES ($1, $2)
            `, [teamId, player.id]);
          }
        }
      }
      
      // Create "On Bye" team if there are bye players
      if (roundData.byePlayers && roundData.byePlayers.length > 0) {
        console.log(`  Bye team: ${roundData.byePlayers.length} players`);
        const byeTeamResult = await client.query(`
          INSERT INTO teams (round_id, team_number, court, is_bye_team) 
          VALUES ($1, $2, NULL, true) RETURNING id
        `, [roundId, roundData.teams.length + 1]);
        
        const byeTeamId = byeTeamResult.rows[0].id;
        
        // Assign bye players to bye team
        for (const player of roundData.byePlayers) {
          await client.query(`
            INSERT INTO team_players (team_id, player_id) VALUES ($1, $2)
          `, [byeTeamId, player.id]);
        }
      } else {
        console.log(`  No bye players for round ${roundData.roundNumber}`);
      }
      
      // Create matches - but DON'T count them as played yet
      for (let matchIndex = 0; matchIndex < roundData.matches.length; matchIndex++) {
        const match = roundData.matches[matchIndex];
        const team1Index = roundData.teams.indexOf(match.team1);
        const team2Index = roundData.teams.indexOf(match.team2);
        
        console.log(`    Match ${matchIndex + 1}: Team ${team1Index + 1} vs Team ${team2Index + 1} on Court ${match.court}`);
        
        // Insert match
        await client.query(`
          INSERT INTO matches (round_id, team1_id, team2_id, court) 
          VALUES ($1, $2, $3, $4)
        `, [roundId, teamIdMap[team1Index], teamIdMap[team2Index], match.court]);
      }
    }
    
    // CRITICAL FIX: DO NOT update player match counts here
    // Let them start at 0 and increment only when matches are actually completed
    console.log(`\n=== Tournament Started ===`);
    console.log(`All players start with 0 matches played. Counts will increment as matches are completed.`);
    
    // Update tournament status
    await client.query('UPDATE tournaments SET status = $1 WHERE id = $2', ['in_progress', id]);
    
    await client.query('COMMIT');
    res.json({ 
      message: 'Tournament started successfully',
      roundsGenerated: allRounds.length,
      totalByePlayers: allRounds.reduce((sum, round) => sum + (round.totalByePlayers || 0), 0)
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error starting tournament:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  } finally {
    client.release();
  }
});

// Submit match scores (no authentication required) - UPDATED WITH POINT DIFFERENTIAL AND PARTIAL SUBMISSION
router.put('/:id/matches/:matchId/scores', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { matchId } = req.params;
    const { team1Game1, team1Game2, team2Game1, team2Game2 } = req.body;
    
    // Validate Game 1 scores are present and valid (required)
    const game1Scores = [team1Game1, team2Game1];
    if (game1Scores.some(score => score === null || score === undefined || isNaN(Number(score)) || Number(score) < 0 || Number(score) > 50)) {
      return res.status(400).json({ message: 'Game 1 scores are required and must be numbers between 0 and 50' });
    }
    
    // Validate Game 2 scores if provided (optional)
    const game2Scores = [team1Game2, team2Game2];
    const hasGame2Scores = game2Scores.every(score => score !== null && score !== undefined && score !== '');
    
    if (hasGame2Scores) {
      // If Game 2 scores are provided, validate them
      if (game2Scores.some(score => isNaN(Number(score)) || Number(score) < 0 || Number(score) > 50)) {
        return res.status(400).json({ message: 'Game 2 scores must be numbers between 0 and 50' });
      }
    }
    
    // Convert to integers, using null for missing Game 2 scores to preserve them in the database
    const t1g1 = parseInt(team1Game1, 10);
    const t1g2 = hasGame2Scores ? parseInt(team1Game2, 10) : null;
    const t2g1 = parseInt(team2Game1, 10);
    const t2g2 = hasGame2Scores ? parseInt(team2Game2, 10) : null;
    
    // Check if match already has scores (for editing or adding Game 2)
    const existingMatchResult = await client.query(`
      SELECT team1_game1_score, team1_game2_score, team2_game1_score, team2_game2_score, is_completed
      FROM matches WHERE id = $1::integer
    `, [parseInt(matchId, 10)]);
    
    const existingMatch = existingMatchResult.rows[0];
    // If match has any existing scores, we need to subtract them before adding new scores
    const hasExistingScores = existingMatch && (
      existingMatch.team1_game1_score !== null || 
      existingMatch.team1_game2_score !== null ||
      existingMatch.team2_game1_score !== null ||
      existingMatch.team2_game2_score !== null
    );
    
    // If updating existing scores, subtract old scores and differentials from player totals first
    if (hasExistingScores) {
      const oldT1Total = (existingMatch.team1_game1_score || 0) + (existingMatch.team1_game2_score || 0);
      const oldT2Total = (existingMatch.team2_game1_score || 0) + (existingMatch.team2_game2_score || 0);
      const oldT1Differential = oldT1Total - oldT2Total;
      const oldT2Differential = oldT2Total - oldT1Total;
      
      // Get team players and subtract old scores and differentials
      const teamPlayersResult = await client.query(`
        SELECT tp.player_id, 
          CASE WHEN tp.team_id = m.team1_id 
               THEN $1::integer
               ELSE $2::integer 
          END as old_points_to_subtract,
          CASE WHEN tp.team_id = m.team1_id 
               THEN $3::integer
               ELSE $4::integer 
          END as old_differential_to_subtract
        FROM team_players tp
        JOIN matches m ON (tp.team_id = m.team1_id OR tp.team_id = m.team2_id)
        WHERE m.id = $5::integer
      `, [oldT1Total, oldT2Total, oldT1Differential, oldT2Differential, parseInt(matchId, 10)]);
      
      // Subtract old points, differential, and decrement match count
      for (const player of teamPlayersResult.rows) {
        await client.query(`
          UPDATE players 
          SET total_points = total_points - $1::integer,
              point_differential = point_differential - $2::integer,
              matches_played = matches_played - 1
          WHERE id = $3::integer
        `, [
          parseInt(player.old_points_to_subtract, 10), 
          parseInt(player.old_differential_to_subtract, 10),
          parseInt(player.player_id, 10)
        ]);
      }
    }
    
    // Update match scores with explicit integer casting
    // Only mark as completed if both games have scores
    const isCompleted = hasGame2Scores;
    
    await client.query(`
      UPDATE matches 
      SET team1_game1_score = $1::integer, team1_game2_score = $2, 
          team2_game1_score = $3::integer, team2_game2_score = $4, 
          is_completed = $5
      WHERE id = $6::integer
    `, [t1g1, t1g2, t2g1, t2g2, isCompleted, parseInt(matchId, 10)]);
    
    // Calculate new totals and differentials (using 0 for missing Game 2 scores in calculations)
    const newT1Total = t1g1 + (t1g2 || 0);
    const newT2Total = t2g1 + (t2g2 || 0);
    const newT1Differential = newT1Total - newT2Total; // Team 1's perspective
    const newT2Differential = newT2Total - newT1Total; // Team 2's perspective
    
    // Get team players to add new points, differential, and increment match count
    const teamPlayersResult = await client.query(`
      SELECT tp.player_id, 
        CASE WHEN tp.team_id = m.team1_id 
             THEN ($1::integer + COALESCE($2, 0))
             ELSE ($3::integer + COALESCE($4, 0)) 
        END as points_earned,
        CASE WHEN tp.team_id = m.team1_id 
             THEN $5::integer
             ELSE $6::integer 
        END as differential_earned
      FROM team_players tp
      JOIN matches m ON (tp.team_id = m.team1_id OR tp.team_id = m.team2_id)
      WHERE m.id = $7::integer
    `, [t1g1, t1g2, t2g1, t2g2, newT1Differential, newT2Differential, parseInt(matchId, 10)]);
    
    // Add new points, differential, and increment match count
    for (const player of teamPlayersResult.rows) {
      await client.query(`
        UPDATE players 
        SET total_points = total_points + $1::integer, 
            point_differential = point_differential + $2::integer,
            matches_played = matches_played + 1
        WHERE id = $3::integer
      `, [
        parseInt(player.points_earned, 10), 
        parseInt(player.differential_earned, 10),
        parseInt(player.player_id, 10)
      ]);
    }
    
    await client.query('COMMIT');
    res.json({ message: 'Scores updated successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating scores:', error);
    res.status(500).json({ message: 'Server error updating scores' });
  } finally {
    client.release();
  }
});

// Complete tournament - ALSO FIXED
router.post('/:id/complete', authenticateToken, requireTournamentManager, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    
    // Get tournament details
    const tournamentResult = await client.query('SELECT * FROM tournaments WHERE id = $1', [id]);
    if (tournamentResult.rows.length === 0) {
      return res.status(404).json({ message: 'Tournament not found' });
    }
    
    const tournament = tournamentResult.rows[0];
    
    // Get final standings with point differential
    const standingsResult = await client.query(`
      SELECT name, gender, total_points, point_differential, matches_played,
        RANK() OVER (PARTITION BY gender ORDER BY total_points DESC, point_differential DESC) as rank
      FROM players 
      WHERE tournament_id = $1
      ORDER BY gender, total_points DESC, point_differential DESC
    `, [id]);
    
    // Calculate payouts using the same fixed logic
    const totalEntryFees = standingsResult.rows.length * parseFloat(tournament.entry_fee || 0);
    const directorCost = parseFloat(tournament.director_cost || 0);
    const totalPool = Math.max(0, totalEntryFees - directorCost);
    
    let payouts;
    
    if (totalPool <= 0) {
      payouts = {
        first: 0,
        second: 0,
        third: 0
      };
    } else {
      const firstPlace = totalPool * 0.30;
      const secondPlace = totalPool * 0.15;
      const thirdPlace = totalPool * 0.05;
      
      payouts = {
        first: Math.floor(firstPlace / 5) * 5,
        second: Math.floor(secondPlace / 5) * 5,
        third: Math.floor(thirdPlace / 5) * 5
      };
    }
    
    // Update tournament status
    await client.query('UPDATE tournaments SET status = $1 WHERE id = $2', ['completed', id]);
    
    await client.query('COMMIT');
    
    res.json({
      message: 'Tournament completed successfully',
      standings: standingsResult.rows,
      payouts,
      totalPool,
      hasPayouts: totalPool > 0
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error completing tournament:', error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
});

// Delete tournament (authenticated users only)
router.delete('/:id', authenticateToken, requireTournamentManager, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    
    // Check if tournament exists and get its status
    const tournamentResult = await client.query('SELECT * FROM tournaments WHERE id = $1', [id]);
    if (tournamentResult.rows.length === 0) {
      return res.status(404).json({ message: 'Tournament not found' });
    }
    
    const tournament = tournamentResult.rows[0];
    
    // Only allow deletion if tournament is not completed
    if (tournament.status === 'completed') {
      return res.status(400).json({ message: 'Cannot delete completed tournaments' });
    }
    
    // Delete tournament (cascade will handle related records)
    await client.query('DELETE FROM tournaments WHERE id = $1', [id]);
    
    await client.query('COMMIT');
    res.json({ message: 'Tournament deleted successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting tournament:', error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
});

// Re-generate teams (authenticated users only) - NEW ROUTE
// FIXED VERSION of the Regenerate Teams Route
// Replace the existing router.post('/:id/regenerate', ...) route with this updated version

router.post('/:id/regenerate', authenticateToken, requireTournamentManager, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const { finalByePlayerName } = req.body;

    // Get tournament and validate
    const tournamentResult = await client.query('SELECT * FROM tournaments WHERE id = $1', [id]);
    if (tournamentResult.rows.length === 0) {
      return res.status(404).json({ message: 'Tournament not found' });
    }

    const tournament = tournamentResult.rows[0];
    if (tournament.status === 'completed') {
      return res.status(400).json({ message: 'Cannot regenerate completed tournaments' });
    }

    if (tournament.status === 'setup') {
      return res.status(400).json({ message: 'Tournament has not been started yet' });
    }

    console.log(`\n=== Regenerating Tournament ${id} ===`);

    // Step 1: Delete all existing rounds, teams, and matches (but keep players and their original data)
    await client.query('DELETE FROM matches WHERE round_id IN (SELECT id FROM rounds WHERE tournament_id = $1)', [id]);
    await client.query('DELETE FROM team_players WHERE team_id IN (SELECT id FROM teams WHERE round_id IN (SELECT id FROM rounds WHERE tournament_id = $1))', [id]);
    await client.query('DELETE FROM teams WHERE round_id IN (SELECT id FROM rounds WHERE tournament_id = $1)', [id]);
    await client.query('DELETE FROM rounds WHERE tournament_id = $1', [id]);

    // Step 2: Reset all player match counts, points, and point differentials to zero
    await client.query('UPDATE players SET matches_played = 0, total_points = 0, point_differential = 0 WHERE tournament_id = $1', [id]);

    console.log('Cleared existing tournament structure and reset player stats');

    // Step 3: Get players for regeneration
    const playersResult = await client.query('SELECT * FROM players WHERE tournament_id = $1', [id]);
    const players = playersResult.rows;

    if (players.length < tournament.min_players_per_team * 2) {
      return res.status(400).json({ message: 'Not enough players to regenerate tournament' });
    }

    // Step 4: Generate new tournament structure
    const settings = {
      courtsAvailable: tournament.courts_available,
      minPlayersPerTeam: tournament.min_players_per_team,
      matchesPerPlayer: tournament.matches_per_player,
      allowSevenPlayerTeams: tournament.allow_seven_player_teams === true,
      finalByePlayerName: finalByePlayerName || null
    };
    
    console.log(`Regenerating with ${players.length} players`);
    
    // FIXED: Handle the new return format from generateAllRounds
    const generationResult = generateAllRounds(players, settings);
    const allRounds = generationResult.rounds || generationResult; // Support both formats
    
    console.log(`Generated ${allRounds.length} new rounds`);
    
    // Step 5: Create new rounds, teams, and matches in database
    for (let roundIndex = 0; roundIndex < allRounds.length; roundIndex++) {
      const roundData = allRounds[roundIndex];
      
      // Create round
      const roundResult = await client.query(`
        INSERT INTO rounds (tournament_id, round_number) 
        VALUES ($1, $2) RETURNING id
      `, [id, roundData.roundNumber]);
      const roundId = roundResult.rows[0].id;
      
      // Create teams (playing and bye teams)
      const teamIdMap = {};
      let playingTeamCount = 0;
      let byeTeamCreated = false;
      
      for (let i = 0; i < roundData.teams.length; i++) {
        const team = roundData.teams[i];
        
        if (team.is_bye_team) {
          // Handle bye team separately
          console.log(`  Bye team: ${team.players.length} players`);
          const byeTeamResult = await client.query(`
            INSERT INTO teams (round_id, team_number, court, is_bye_team) 
            VALUES ($1, $2, NULL, true) RETURNING id
          `, [roundId, i + 1]);
          
          const byeTeamId = byeTeamResult.rows[0].id;
          byeTeamCreated = true;
          
          // Assign bye players to bye team
          for (const player of team.players) {
            await client.query(`
              INSERT INTO team_players (team_id, player_id) VALUES ($1, $2)
            `, [byeTeamId, player.id]);
          }
        } else {
          // Handle playing team
          playingTeamCount++;
          // Use the court assignment from the team generator instead of recalculating
          // The team.court value is set by assignCourtsAcrossRounds to match the match court
          const court = team.court;
          
          const teamResult = await client.query(`
            INSERT INTO teams (round_id, team_number, court, is_bye_team) 
            VALUES ($1, $2, $3, false) RETURNING id
          `, [roundId, i + 1, court]);
          
          const teamId = teamResult.rows[0].id;
          teamIdMap[i] = teamId;
          
          console.log(`  Team ${i + 1}: ${team.players.length} players on Court ${court}`);
          
          // Assign players to team
          for (const player of team.players) {
            await client.query(`
              INSERT INTO team_players (team_id, player_id) VALUES ($1, $2)
            `, [teamId, player.id]);
          }
        }
      }
      
      // Create bye team if needed (only if not already created above)
      if (!byeTeamCreated && roundData.byePlayers && roundData.byePlayers.length > 0) {
        console.log(`  Creating additional bye team: ${roundData.byePlayers.length} players`);
        const byeTeamResult = await client.query(`
          INSERT INTO teams (round_id, team_number, court, is_bye_team) 
          VALUES ($1, $2, NULL, true) RETURNING id
        `, [roundId, roundData.teams.length + 1]);
        
        const byeTeamId = byeTeamResult.rows[0].id;
        
        for (const player of roundData.byePlayers) {
          await client.query(`
            INSERT INTO team_players (team_id, player_id) VALUES ($1, $2)
          `, [byeTeamId, player.id]);
        }
      }
      
      // Create matches
      for (let matchIndex = 0; matchIndex < roundData.matches.length; matchIndex++) {
        const match = roundData.matches[matchIndex];
        const team1Index = roundData.teams.indexOf(match.team1);
        const team2Index = roundData.teams.indexOf(match.team2);
        
        await client.query(`
          INSERT INTO matches (round_id, team1_id, team2_id, court) 
          VALUES ($1, $2, $3, $4)
        `, [roundId, teamIdMap[team1Index], teamIdMap[team2Index], match.court]);
      }
    }
    
    await client.query('COMMIT');
    console.log('Tournament regeneration completed successfully');
    
    res.json({ 
      message: 'Tournament teams regenerated successfully',
      roundsGenerated: allRounds.length
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error regenerating tournament:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  } finally {
    client.release();
  }
});

module.exports = router;