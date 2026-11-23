import React from 'react';

// "This is me": a player picks their name once and the page leads with where
// they need to be. Everything here is derived from buildPlayerSchedule, the
// same source as the printed sheet and the schedule popup.

function MyMatchPanel({ players, me, schedule, currentRound, onPick, onForget, onJump, onOpenSchedule }) {
  if (!me) {
    const choices = [...players]
      .filter(p => !p.is_withdrawn)
      .sort((a, b) => a.name.localeCompare(b.name));

    return (
      <div className="card my-match is-picker">
        <label className="field-label" htmlFor="my-player">Find your matches</label>
        <select
          id="my-player"
          value=""
          onChange={e => {
            const player = players.find(p => p.id === Number(e.target.value));
            if (player) onPick(player);
          }}
        >
          <option value="">Pick your name…</option>
          {choices.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <p className="field-hint">Remembered on this phone only.</p>
      </div>
    );
  }

  const playing = schedule.filter(e => e.status === 'playing');
  const upNext = playing.find(e => !e.completed);
  const nowEntry = schedule.find(e => e.roundNumber === currentRound);
  const sittingOutNow = nowEntry?.status === 'bye';
  const isNow = upNext && upNext.roundNumber === currentRound;

  let body;
  if (me.is_withdrawn) {
    body = <p className="my-match-line">You've withdrawn. Thanks for playing!</p>;
  } else if (!upNext) {
    body = (
      <p className="my-match-line">
        You're done for the day: <strong>{me.total_points ?? 0} points</strong> from{' '}
        {playing.length} matches.
      </p>
    );
  } else {
    body = (
      <>
        {sittingOutNow && (
          <p className="my-match-line text-muted">You're sitting out round {currentRound}.</p>
        )}
        <div className="my-match-where">
          <span className={`badge ${isNow ? 'badge-success' : 'badge-primary'}`}>
            {isNow ? 'Playing now' : 'Up next'}
          </span>
          <span className="my-match-court">
            Round {upNext.roundNumber} · Court {upNext.court}
          </span>
        </div>
        <p className="my-match-line">
          Team {upNext.teamNumber}
          {upNext.opponentTeamNumber !== null && <> vs Team {upNext.opponentTeamNumber}</>}
        </p>
        {upNext.teammates.length > 0 && (
          <p className="my-match-line text-muted text-sm">
            with {upNext.teammates.map(p => p.name).join(', ')}
          </p>
        )}
      </>
    );
  }

  return (
    <div className="card my-match">
      <div className="flex-between">
        <strong>{me.name}</strong>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onForget}>
          Not you?
        </button>
      </div>

      {body}

      <div className="my-match-actions">
        {upNext && !me.is_withdrawn && (
          <button type="button" className="btn btn-primary" onClick={() => onJump(upNext.roundNumber)}>
            Go to my match
          </button>
        )}
        <button type="button" className="btn btn-secondary" onClick={onOpenSchedule}>
          My full schedule
        </button>
      </div>
    </div>
  );
}

export default MyMatchPanel;
