import React from 'react';
import PlayerChip from './PlayerChip';
import MatchCard from './MatchCard';

function RoundView({
  round,
  roundMatches,
  allPlayers,
  showDetails,
  user,
  editingMatch,
  scoreInputs,
  onScoreChange,
  onSubmit,
  onStartEdit,
  onCancelEdit
}) {
  const teams = round.teams || [];
  const playingTeams = teams.filter(t => !t.is_bye_team);
  const byeTeam = teams.find(t => t.is_bye_team);

  // Prefer the explicit bye team; fall back to whoever is missing from the
  // playing teams, which covers rounds generated before bye teams were stored.
  let byePlayers = byeTeam?.players || [];
  if (byePlayers.length === 0) {
    const playing = new Set(playingTeams.flatMap(t => (t.players || []).map(p => p.id)));
    byePlayers = allPlayers.filter(p => !playing.has(p.id));
  }

  const teamById = id => teams.find(t => t.id === id);
  const playersOf = id => teamById(id)?.players || [];
  const completed = roundMatches.filter(m => m.is_completed).length;

  return (
    <div className="stack">
      <div className="stat-grid">
        <div className="stat">
          <div className="stat-label">Matches</div>
          <div className="stat-value">{completed}/{roundMatches.length}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Teams</div>
          <div className="stat-value">{playingTeams.length}</div>
        </div>
        <div className="stat">
          <div className="stat-label">On bye</div>
          <div className="stat-value">{byePlayers.length}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Playing</div>
          <div className="stat-value">{playingTeams.reduce((n, t) => n + (t.players?.length || 0), 0)}</div>
        </div>
      </div>

      {roundMatches.length > 0 && (
        <div>
          <h3 className="mb-1">Matches</h3>
          {[...roundMatches]
            .sort((a, b) => a.court - b.court)
            .map(match => (
              <MatchCard
                key={match.id}
                match={match}
                team1={teamById(match.team1_id)}
                team2={teamById(match.team2_id)}
                team1Players={playersOf(match.team1_id)}
                team2Players={playersOf(match.team2_id)}
                showDetails={showDetails}
                user={user}
                isEditing={editingMatch === match.id}
                scores={scoreInputs[match.id] || {}}
                onScoreChange={onScoreChange}
                onSubmit={onSubmit}
                onStartEdit={onStartEdit}
                onCancelEdit={onCancelEdit}
              />
            ))}
        </div>
      )}

      {byePlayers.length > 0 && (
        <div>
          <h3 className="mb-1">Sitting out this round</h3>
          <div className="team-card is-bye">
            <div className="team-header">
              <span>On bye</span>
              <span className="team-meta">{byePlayers.length} players</span>
            </div>
            <ul className="player-list">
              {byePlayers.map(p => (
                <li key={p.id}><PlayerChip player={p} detailed={showDetails} /></li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {showDetails && playingTeams.length > 0 && (
        <div>
          <h3 className="mb-1">Rosters</h3>
          <div className="teams-grid">
            {[...playingTeams]
              .sort((a, b) => a.team_number - b.team_number)
              .map(team => (
                <div key={team.id} className="team-card">
                  <div className="team-header">
                    <span>Team {team.team_number}</span>
                    <span className="team-meta">Court {team.court}</span>
                  </div>
                  <ul className="player-list">
                    {(team.players || []).map(p => (
                      <li key={p.id}><PlayerChip player={p} detailed /></li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default RoundView;
