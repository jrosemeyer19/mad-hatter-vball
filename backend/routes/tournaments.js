const express = require('express');
const pool = require('../database/db');
const { authenticateToken } = require('../middleware/auth');
const { generateTeams, balancePlayerMatches } = require('../utils/teamGenerator');

const router = express.Router();

// Get all tournaments (public - shows active tournaments)
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, date, location, status 
      FROM tournaments 
      WHERE status IN ('in_progress', 'setup')
      ORDER BY date DESC, created_at DESC
    `);
    res.json(result.rows);
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

// Create new tournament (authenticated users only)
router.post('/', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const {
      name, date, location, courtsAvailable = 3, minPlayersPerTeam = 5,
      matchesPerPlayer = 4, entryFee = 0, directorCost = 0, hasPowerMatch = false
    } = req.body;
    
    if (!name || !date || !location) {
      return res.status(400).json({ message: 'Name, date, and location are required' });
    }
    
    const result = await client.query(`
      INSERT INTO tournaments (
        name, date, location, courts_available, min_players_per_team,
        matches_per_player, entry_fee, director_cost, has_power_match, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [name, date, location, courtsAvailable, minPlayersPerTeam, matchesPerPlayer, 
        entryFee, directorCost, hasPowerMatch, req.user.id]);
    
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

// Get tournament details
router.get('/:id', async (req, res) => {
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
    
    // Get rounds with teams and matches
    const roundsResult = await pool.query(`
      SELECT r.*, 
        json_agg(
          json_build_object(
            'id', t.id,
            'team_number', t.team_number,
            'court', t.court,
            'players', (
              SELECT json_agg(
                json_build_object(
                  'id', p.id,
                  'name', p.name,
                  'gender', p.gender,
                  'skill_level', p.skill_level,
                  'is_setter', p.is_setter
                )
              )
              FROM team_players tp
              JOIN players p ON tp.player_id = p.id
              WHERE tp.team_id = t.id
            )
          )
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
    
    res.json({
      tournament,
      players: playersResult.rows,
      rounds: roundsResult.rows,
      matches: matchesResult.rows
    });
  } catch (error) {
    console.error('Error fetching tournament details:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add player to tournament
router.post('/:id/players', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, gender, skillLevel, isSetter = false } = req.body;
    
    if (!name || !gender || !skillLevel) {
      return res.status(400).json({ message: 'Name, gender, and skill level are required' });
    }
    
    if (!['male', 'female'].includes(gender)) {
      return res.status(400).json({ message: 'Gender must be male or female' });
    }
    
    if (!['A', 'BB', 'B'].includes(skillLevel)) {
      return res.status(400).json({ message: 'Skill level must be A, BB, or B' });
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

// Remove player from tournament
router.delete('/:id/players/:playerId', authenticateToken, async (req, res) => {
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

// Start tournament (generate teams)
router.post('/:id/start', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    
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
    
    // Generate first round
    const settings = {
      courtsAvailable: tournament.courts_available,
      minPlayersPerTeam: tournament.min_players_per_team,
      hasPowerMatch: tournament.has_power_match
    };
    
    const { teams, matches } = generateTeams(players, settings, 1);
    
    // Create round
    const roundResult = await client.query(`
      INSERT INTO rounds (tournament_id, round_number) 
      VALUES ($1, 1) RETURNING id
    `, [id]);
    const roundId = roundResult.rows[0].id;
    
    // Create teams and assign players
    for (let i = 0; i < teams.length; i++) {
      const teamResult = await client.query(`
        INSERT INTO teams (round_id, team_number, court) 
        VALUES ($1, $2, $3) RETURNING id
      `, [roundId, i + 1, Math.floor(i / 2) + 1]);
      
      const teamId = teamResult.rows[0].id;
      
      // Assign players to team
      for (const player of teams[i].players) {
        await client.query(`
          INSERT INTO team_players (team_id, player_id) VALUES ($1, $2)
        `, [teamId, player.id]);
      }
    }
    
    // Create matches
    for (const match of matches) {
      const team1Index = teams.indexOf(match.team1);
      const team2Index = teams.indexOf(match.team2);
      
      await client.query(`
        INSERT INTO matches (round_id, team1_id, team2_id, court) 
        SELECT $1, t1.id, t2.id, $4
        FROM teams t1, teams t2 
        WHERE t1.round_id = $1 AND t1.team_number = $2
        AND t2.round_id = $1 AND t2.team_number = $3
      `, [roundId, team1Index + 1, team2Index + 1, match.court]);
    }
    
    // Update tournament status
    await client.query('UPDATE tournaments SET status = $1 WHERE id = $2', ['in_progress', id]);
    
    await client.query('COMMIT');
    res.json({ message: 'Tournament started successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error starting tournament:', error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
});

// Submit match scores (no authentication required)
router.put('/:id/matches/:matchId/scores', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { matchId } = req.params;
    const { team1Game1, team1Game2, team2Game1, team2Game2 } = req.body;
    
    // Validate scores
    if ([team1Game1, team1Game2, team2Game1, team2Game2].some(score => 
      score === null || score === undefined || score < 0 || score > 50)) {
      return res.status(400).json({ message: 'Invalid scores' });
    }
    
    // Update match scores
    await client.query(`
      UPDATE matches 
      SET team1_game1_score = $1, team1_game2_score = $2, 
          team2_game1_score = $3, team2_game2_score = $4, is_completed = true
      WHERE id = $5
    `, [team1Game1, team1Game2, team2Game1, team2Game2, matchId]);
    
    // Get team players to update their points
    const teamPlayersResult = await client.query(`
      SELECT tp.player_id, 
        CASE WHEN tp.team_id = m.team1_id THEN $1 + $2 
             ELSE $3 + $4 END as points_earned
      FROM team_players tp
      JOIN matches m ON (tp.team_id = m.team1_id OR tp.team_id = m.team2_id)
      WHERE m.id = $5
    `, [team1Game1, team1Game2, team2Game1, team2Game2, matchId]);
    
    // Update player points and match count
    for (const player of teamPlayersResult.rows) {
      await client.query(`
        UPDATE players 
        SET total_points = total_points + $1, matches_played = matches_played + 1
        WHERE id = $2
      `, [player.points_earned, player.player_id]);
    }
    
    await client.query('COMMIT');
    res.json({ message: 'Scores updated successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating scores:', error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
});

// Generate next round
router.post('/:id/rounds/next', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    
    // Get tournament details
    const tournamentResult = await client.query('SELECT * FROM tournaments WHERE id = $1', [id]);
    const tournament = tournamentResult.rows[0];
    
    // Get current round number
    const roundResult = await client.query(`
      SELECT MAX(round_number) as current_round FROM rounds WHERE tournament_id = $1
    `, [id]);
    const nextRoundNumber = (roundResult.rows[0].current_round || 0) + 1;
    
    // Get all players
    const playersResult = await client.query('SELECT * FROM players WHERE tournament_id = $1', [id]);
    const allPlayers = playersResult.rows;
    
    // Get existing rounds data for balance checking
    const existingRoundsResult = await client.query(`
      SELECT r.round_number, 
        json_agg(
          json_build_object(
            'team1', (SELECT json_agg(tp1.player_id) FROM team_players tp1 WHERE tp1.team_id = m.team1_id),
            'team2', (SELECT json_agg(tp2.player_id) FROM team_players tp2 WHERE tp2.team_id = m.team2_id)
          )
        ) as matches
      FROM rounds r
      JOIN matches m ON r.id = m.round_id
      WHERE r.tournament_id = $1
      GROUP BY r.round_number
    `, [id]);
    
    // Filter players who still need matches
    const playersNeedingMatches = balancePlayerMatches(
      allPlayers, 
      existingRoundsResult.rows, 
      tournament.matches_per_player
    );
    
    if (playersNeedingMatches.length < tournament.min_players_per_team * 2) {
      return res.status(400).json({ message: 'Not enough players need additional matches' });
    }
    
    // Generate teams for next round
    const settings = {
      courtsAvailable: tournament.courts_available,
      minPlayersPerTeam: tournament.min_players_per_team,
      hasPowerMatch: tournament.has_power_match
    };
    
    const { teams, matches } = generateTeams(playersNeedingMatches, settings, nextRoundNumber);
    
    // Create new round
    const newRoundResult = await client.query(`
      INSERT INTO rounds (tournament_id, round_number) 
      VALUES ($1, $2) RETURNING id
    `, [id, nextRoundNumber]);
    const roundId = newRoundResult.rows[0].id;
    
    // Create teams and matches (similar to start tournament logic)
    for (let i = 0; i < teams.length; i++) {
      const teamResult = await client.query(`
        INSERT INTO teams (round_id, team_number, court) 
        VALUES ($1, $2, $3) RETURNING id
      `, [roundId, i + 1, Math.floor(i / 2) + 1]);
      
      const teamId = teamResult.rows[0].id;
      
      for (const player of teams[i].players) {
        await client.query(`
          INSERT INTO team_players (team_id, player_id) VALUES ($1, $2)
        `, [teamId, player.id]);
      }
    }
    
    // Create matches
    for (const match of matches) {
      const team1Index = teams.indexOf(match.team1);
      const team2Index = teams.indexOf(match.team2);
      
      await client.query(`
        INSERT INTO matches (round_id, team1_id, team2_id, court) 
        SELECT $1, t1.id, t2.id, $4
        FROM teams t1, teams t2 
        WHERE t1.round_id = $1 AND t1.team_number = $2
        AND t2.round_id = $1 AND t2.team_number = $3
      `, [roundId, team1Index + 1, team2Index + 1, match.court]);
    }
    
    await client.query('COMMIT');
    res.json({ message: `Round ${nextRoundNumber} generated successfully` });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error generating next round:', error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
});

// Complete tournament
router.post('/:id/complete', authenticateToken, async (req, res) => {
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
    
    // Get final standings
    const standingsResult = await client.query(`
      SELECT name, gender, total_points, matches_played,
        RANK() OVER (PARTITION BY gender ORDER BY total_points DESC) as rank
      FROM players 
      WHERE tournament_id = $1
      ORDER BY gender, total_points DESC
    `, [id]);
    
    // Calculate payouts
    const totalPool = (standingsResult.rows.length * tournament.entry_fee) - tournament.director_cost;
    const payouts = {
      first: Math.floor((totalPool * 0.30) / 5) * 5, // Round down to nearest $5
      second: Math.floor((totalPool * 0.15) / 5) * 5,
      third: Math.floor((totalPool * 0.05) / 5) * 5
    };
    
    // Update tournament status
    await client.query('UPDATE tournaments SET status = $1 WHERE id = $2', ['completed', id]);
    
    await client.query('COMMIT');
    
    res.json({
      message: 'Tournament completed successfully',
      standings: standingsResult.rows,
      payouts,
      totalPool
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
router.delete('/:id', authenticateToken, async (req, res) => {
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

module.exports = router;
