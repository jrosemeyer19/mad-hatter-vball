import React from 'react';

// "Waiting on court 2" — tells players whether to stay warm or go get water,
// and tells the director which court has not reported. An earlier round still
// missing a score once a later one has started is called out, since that is
// how a forgotten entry hides until the end of the night.

const STATE_LABEL = { done: 'Done', game2: 'Game 2', waiting: 'Waiting' };

function summary(round, isStraggler) {
  const pending = round.courts.filter(c => c.state !== 'done').map(c => c.court);
  const doneCount = round.courts.length - pending.length;
  const list = pending.length === 1
    ? `court ${pending[0]}`
    : `courts ${pending.slice(0, -1).join(', ')} and ${pending[pending.length - 1]}`;

  if (isStraggler) return `Round ${round.roundNumber} is still missing a score from ${list}`;
  if (doneCount === 0) return `Round ${round.roundNumber} is underway`;
  return `Round ${round.roundNumber}: waiting on ${list}`;
}

function RoundStatus({ rounds, onJump }) {
  if (rounds.length === 0) return null;

  const latest = rounds[rounds.length - 1].roundNumber;

  return (
    <div className="round-status" aria-live="polite">
      {rounds.map(round => {
        const isStraggler = round.roundNumber !== latest;
        return (
          <div
            key={round.roundNumber}
            className={`round-status-row${isStraggler ? ' is-straggler' : ''}`}
          >
            <div className="round-status-text">{summary(round, isStraggler)}</div>
            <div className="round-status-courts">
              {round.courts.map(c => (
                <button
                  key={c.matchId}
                  type="button"
                  className={`court-pill is-${c.state}`}
                  onClick={() => onJump(round.roundNumber, c.matchId)}
                  aria-label={`Round ${round.roundNumber}, court ${c.court}: ${STATE_LABEL[c.state]}`}
                >
                  <span className="court-pill-court">Ct {c.court}</span>
                  <span className="court-pill-state">
                    {c.state === 'done' ? '✓' : STATE_LABEL[c.state]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default RoundStatus;
