// One player's day, derived from the rounds/matches the tournament page already
// holds. Shared by the printable sheet and the per-player popup so the paper
// and the phone can never disagree about where someone is supposed to be.

// Byes are stored as a team flagged is_bye_team. Fall back to "whoever is not
// on a playing team" for rounds generated before bye teams were persisted.
export function byePlayersOf(round, allPlayers = []) {
  const teams = round.teams || [];
  const byeTeam = teams.find(t => t.is_bye_team);
  if (byeTeam?.players?.length) return byeTeam.players;

  const playing = new Set(
    teams.filter(t => !t.is_bye_team).flatMap(t => (t.players || []).map(p => p.id))
  );
  return allPlayers.filter(p => !playing.has(p.id));
}

// Total points decide a match, matching how standings are scored
const totalFor = (match, side) =>
  (match[`${side}_game1_score`] || 0) + (match[`${side}_game2_score`] || 0);

// Returns one entry per round, in round order. Status is 'playing', 'bye', or
// 'absent' — absent meaning the player is not in that round at all, which
// happens when someone is added to the roster after the draw.
export function buildPlayerSchedule(playerId, rounds, matches, allPlayers = []) {
  return [...rounds]
    .sort((a, b) => a.round_number - b.round_number)
    .map(round => {
      const teams = round.teams || [];
      const team = teams.find(
        t => !t.is_bye_team && (t.players || []).some(p => p.id === playerId)
      );

      if (!team) {
        const onBye = byePlayersOf(round, allPlayers).some(p => p.id === playerId);
        return { roundNumber: round.round_number, status: onBye ? 'bye' : 'absent' };
      }

      const match = matches.find(
        m =>
          m.round_number === round.round_number &&
          (m.team1_id === team.id || m.team2_id === team.id)
      );

      const isTeam1 = match ? match.team1_id === team.id : false;
      const opponent = match
        ? teams.find(t => t.id === (isTeam1 ? match.team2_id : match.team1_id))
        : null;

      const entry = {
        roundNumber: round.round_number,
        status: 'playing',
        court: team.court,
        teamNumber: team.team_number,
        teammates: (team.players || []).filter(p => p.id !== playerId),
        opponentTeamNumber: opponent?.team_number ?? null,
        completed: !!match?.is_completed
      };

      if (match?.is_completed) {
        entry.points = totalFor(match, isTeam1 ? 'team1' : 'team2');
        entry.opponentPoints = totalFor(match, isTeam1 ? 'team2' : 'team1');
        entry.outcome =
          entry.points > entry.opponentPoints
            ? 'win'
            : entry.points < entry.opponentPoints
            ? 'loss'
            : 'tie';
      }

      return entry;
    });
}
