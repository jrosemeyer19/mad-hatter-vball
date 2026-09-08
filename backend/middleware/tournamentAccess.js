const pool = require('../database/db');

/*
 * Who is allowed to manage a tournament.
 *
 * Creating a tournament makes you its director, and by default nobody else
 * signed in can change or delete it. Checking "allow other users to manage" on
 * the tournament opens it up to every signed-in user, for events run by more
 * than one person. Super admins are always allowed, so an account going away
 * can never leave a tournament stranded.
 */
const canManageTournament = (tournament, user) => {
  if (!user || !tournament) return false;
  if (user.is_super_admin) return true;
  if (tournament.created_by === user.id) return true;
  return tournament.allow_shared_management === true;
};

/*
 * The sharing flag itself is owner-only, even on a tournament that is currently
 * shared. Otherwise a co-manager could lock the director out of their own
 * event, or re-open one the director had deliberately closed.
 */
const canToggleSharing = (tournament, user) => {
  if (!user || !tournament) return false;
  return user.is_super_admin === true || tournament.created_by === user.id;
};

/*
 * Route guard for the management endpoints. Runs after authenticateToken and
 * leaves the tournament on req.tournament, so a handler that needs the row
 * anyway does not have to fetch it twice.
 */
const requireTournamentManager = async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM tournaments WHERE id = $1', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Tournament not found' });
    }

    const tournament = result.rows[0];

    if (!canManageTournament(tournament, req.user)) {
      return res.status(403).json({
        message: 'Only the director who created this tournament can manage it'
      });
    }

    req.tournament = tournament;
    next();
  } catch (error) {
    console.error('Error checking tournament access:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { canManageTournament, canToggleSharing, requireTournamentManager };
