import React, { useEffect } from 'react';

// "Where am I next?" — the question a player standing on the sideline actually
// has. Uses the shared modal styles, which are a bottom sheet on phones.

const OUTCOME_LABEL = { win: 'W', loss: 'L', tie: 'T' };

function ScheduleRow({ entry }) {
  if (entry.status !== 'playing') {
    return (
      <div className="player-day-row is-off">
        <div className="player-day-round">R{entry.roundNumber}</div>
        <div className="player-day-body">
          <div className="player-day-where">
            {entry.status === 'bye' ? 'Sitting out this round' : 'Not in this round'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="player-day-row">
      <div className="player-day-round">R{entry.roundNumber}</div>
      <div className="player-day-body">
        <div className="player-day-where">
          <span>
            <strong>Court {entry.court}</strong> · Team {entry.teamNumber}
            {entry.opponentTeamNumber !== null && (
              <span className="text-muted"> vs Team {entry.opponentTeamNumber}</span>
            )}
          </span>
          {entry.completed && (
            <span className={`player-day-result ${entry.outcome}`}>
              {entry.points}–{entry.opponentPoints} {OUTCOME_LABEL[entry.outcome]}
            </span>
          )}
        </div>
        {entry.teammates.length > 0 && (
          <div className="player-day-with">
            with {entry.teammates.map(p => p.name).join(', ')}
          </div>
        )}
      </div>
    </div>
  );
}

function PlayerScheduleModal({ player, schedule, user, onClose }) {
  // Escape closes, the same way tapping the backdrop does
  useEffect(() => {
    const onKeyDown = e => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const playing = schedule.filter(e => e.status === 'playing');
  const upNext = playing.find(e => !e.completed);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Schedule for ${player.name}`}
      >
        <div className="flex-between">
          <div>
            <h2 style={{ margin: 0 }}>{player.name}</h2>
            {/* Skill level and setter status are the director's business, not
                something a player should read off someone else's card */}
            {user && (
              <p className="text-muted text-sm" style={{ margin: 0 }}>
                {player.gender?.toLowerCase() === 'female' ? 'Female' : 'Male'} ·{' '}
                {player.skill_level}
                {player.is_setter ? ' · setter' : ''}
              </p>
            )}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="stat-grid mt-1">
          <div className="stat">
            <div className="stat-label">Points</div>
            <div className="stat-value">{player.total_points ?? 0}</div>
          </div>
          <div className="stat">
            <div className="stat-label">+/–</div>
            <div className="stat-value">
              {(player.point_differential ?? 0) > 0 ? '+' : ''}
              {player.point_differential ?? 0}
            </div>
          </div>
          <div className="stat">
            <div className="stat-label">Played</div>
            <div className="stat-value">{player.matches_played ?? 0}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Up next</div>
            <div className="stat-value">
              {upNext ? `Court ${upNext.court}` : '—'}
            </div>
          </div>
        </div>

        <div className="player-day mt-1">
          {schedule.map(entry => (
            <ScheduleRow key={entry.roundNumber} entry={entry} />
          ))}
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default PlayerScheduleModal;
