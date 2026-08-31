import React from 'react';
import PlayerChip from './PlayerChip';
import MatchBalance from './MatchBalance';

function ScoreField({ id, label, value, onChange, autoFocus }) {
  return (
    <div className="score-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        // inputMode brings up the numeric keypad on phones instead of the
        // full keyboard, which is the difference between a one-tap entry and
        // a fiddly one when you are standing at the net.
        inputMode="numeric"
        pattern="[0-9]*"
        min="0"
        max="50"
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={e => e.target.select()}
        autoFocus={autoFocus}
        placeholder="0"
      />
    </div>
  );
}

function ScoreCell({ label, value, win }) {
  return (
    <div className={`score-cell${win ? ' win' : ''}`}>
      <div className="score-cell-label">{label}</div>
      <div className="score-cell-value">{value ?? '–'}</div>
    </div>
  );
}

function TeamSide({ team, players, detailed, won, onSelectPlayer }) {
  return (
    <div className={`match-side${won ? ' win' : ''}`}>
      <div className="match-side-name">Team {team?.team_number ?? '?'}</div>
      <ul className="player-list">
        {players.map(p => (
          <li key={p.id}>
            <PlayerChip player={p} detailed={detailed} onSelect={onSelectPlayer} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function MatchCard({
  match,
  team1,
  team2,
  team1Players,
  team2Players,
  showDetails,
  user,
  isEditing,
  scores,
  onScoreChange,
  onSubmit,
  onStartEdit,
  onCancelEdit,
  onSelectPlayer
}) {
  const t1Label = `Team ${team1?.team_number ?? 1}`;
  const t2Label = `Team ${team2?.team_number ?? 2}`;

  const hasGame1 = match.team1_game1_score !== null && match.team1_game1_score !== undefined;
  const hasGame2 = match.team1_game2_score !== null && match.team1_game2_score !== undefined;
  const isLoggedIn = !!user;

  let status = { label: 'Not started', cls: 'badge-neutral' };
  if (match.is_completed) status = { label: 'Final', cls: 'badge-success' };
  else if (hasGame1) status = { label: 'Game 2 needed', cls: 'badge-warn' };

  // Total points decide the winner, matching how standings are scored
  const t1Total = (match.team1_game1_score || 0) + (match.team1_game2_score || 0);
  const t2Total = (match.team2_game1_score || 0) + (match.team2_game2_score || 0);

  const set = (field, value) => onScoreChange(match.id, field, value);
  const val = field => (scores[field] === undefined || scores[field] === null ? '' : scores[field]);

  const game1Ready = val('team1Game1') !== '' && val('team2Game1') !== '';
  const game2Ready = val('team1Game2') !== '' && val('team2Game2') !== '';

  const renderScoreSection = () => {
    // Finished, just showing the result
    if (match.is_completed && !isEditing) {
      return (
        <div className="score-entry">
          <div className="flex-between mb-1">
            <strong className="text-sm">Final score</strong>
            {isLoggedIn && (
              <button className="btn btn-secondary btn-sm" onClick={() => onStartEdit(match)}>
                Edit
              </button>
            )}
          </div>
          <div className="score-readout four-up">
            <ScoreCell label={`${t1Label} · G1`} value={match.team1_game1_score} win={match.team1_game1_score > match.team2_game1_score} />
            <ScoreCell label={`${t2Label} · G1`} value={match.team2_game1_score} win={match.team2_game1_score > match.team1_game1_score} />
            <ScoreCell label={`${t1Label} · G2`} value={match.team1_game2_score} win={match.team1_game2_score > match.team2_game2_score} />
            <ScoreCell label={`${t2Label} · G2`} value={match.team2_game2_score} win={match.team2_game2_score > match.team1_game2_score} />
          </div>
          {!isLoggedIn && (
            <p className="field-hint">Match complete. Log in to change a score.</p>
          )}
        </div>
      );
    }

    // Game 1 is in, game 2 still owed
    if (hasGame1 && !hasGame2 && !isEditing) {
      return (
        <div className="score-entry">
          <div className="flex-between mb-1">
            <strong className="text-sm">Game 1 result</strong>
            <button className="btn btn-primary btn-sm" onClick={() => onStartEdit(match)}>
              Add game 2
            </button>
          </div>
          <div className="score-readout">
            <ScoreCell label={t1Label} value={match.team1_game1_score} win={match.team1_game1_score > match.team2_game1_score} />
            <ScoreCell label={t2Label} value={match.team2_game1_score} win={match.team2_game1_score > match.team1_game1_score} />
          </div>
          <div className="warn-message mt-1 text-sm" style={{ marginBottom: 0 }}>
            Game 2 scores are still needed to finish this match.
          </div>
        </div>
      );
    }

    if (isEditing) {
      // A visitor who is not logged in may add game 2 but cannot rewrite game 1
      const lockGame1 = !isLoggedIn && hasGame1 && !hasGame2;

      return (
        <div className="score-entry">
          <strong className="text-sm">
            {lockGame1 ? 'Add game 2' : match.is_completed ? 'Edit scores' : 'Enter scores'}
          </strong>

          <div className="score-games mt-1">
            <div className={`game-group${lockGame1 ? ' is-locked' : ''}`}>
              <div className="game-label">Game 1{lockGame1 ? ' · locked' : ''}</div>
              {lockGame1 ? (
                <div className="game-scores">
                  <ScoreCell label={t1Label} value={match.team1_game1_score} />
                  <ScoreCell label={t2Label} value={match.team2_game1_score} />
                </div>
              ) : (
                <div className="game-scores">
                  <ScoreField id={`m${match.id}-t1g1`} label={t1Label} value={val('team1Game1')} onChange={v => set('team1Game1', v)} autoFocus />
                  <ScoreField id={`m${match.id}-t2g1`} label={t2Label} value={val('team2Game1')} onChange={v => set('team2Game1', v)} />
                </div>
              )}
            </div>

            <div className="game-group">
              <div className="game-label">Game 2</div>
              <div className="game-scores">
                <ScoreField id={`m${match.id}-t1g2`} label={t1Label} value={val('team1Game2')} onChange={v => set('team1Game2', v)} autoFocus={lockGame1} />
                <ScoreField id={`m${match.id}-t2g2`} label={t2Label} value={val('team2Game2')} onChange={v => set('team2Game2', v)} />
              </div>
            </div>
          </div>

          <div className="score-actions">
            <button
              className="btn btn-success"
              onClick={() => onSubmit(match.id)}
              disabled={lockGame1 ? !game2Ready : !game1Ready}
            >
              {lockGame1 ? 'Finish match' : match.is_completed ? 'Update scores' : 'Save scores'}
            </button>
            <button className="btn btn-secondary" onClick={onCancelEdit}>Cancel</button>
          </div>

          {lockGame1 && (
            <p className="field-hint">Game 1 is locked. Log in to change it.</p>
          )}
        </div>
      );
    }

    // Nothing entered yet
    return (
      <div className="score-entry">
        <div className="score-games">
          <div className="game-group">
            <div className="game-label">Game 1</div>
            <div className="game-scores">
              <ScoreField id={`m${match.id}-t1g1`} label={t1Label} value={val('team1Game1')} onChange={v => set('team1Game1', v)} />
              <ScoreField id={`m${match.id}-t2g1`} label={t2Label} value={val('team2Game1')} onChange={v => set('team2Game1', v)} />
            </div>
          </div>
          <div className="game-group">
            <div className="game-label">Game 2</div>
            <div className="game-scores">
              <ScoreField id={`m${match.id}-t1g2`} label={t1Label} value={val('team1Game2')} onChange={v => set('team1Game2', v)} />
              <ScoreField id={`m${match.id}-t2g2`} label={t2Label} value={val('team2Game2')} onChange={v => set('team2Game2', v)} />
            </div>
          </div>
        </div>
        <div className="score-actions">
          <button
            className="btn btn-success btn-lg btn-block"
            onClick={() => onSubmit(match.id)}
            disabled={!game1Ready}
          >
            Save scores
          </button>
        </div>
        <p className="field-hint">Anyone can enter scores — no login needed.</p>
      </div>
    );
  };

  return (
    <div className={`match-card${match.is_completed ? ' is-complete' : ''}`}>
      <div className="match-top">
        <span className="match-court">Court {match.court}</span>
        <span className={`badge ${status.cls}`}>{status.label}</span>
      </div>

      <div className="match-body">
        <div className="match-teams">
          <TeamSide
            team={team1}
            players={team1Players}
            detailed={showDetails}
            won={match.is_completed && t1Total > t2Total}
            onSelectPlayer={onSelectPlayer}
          />
          <span className="match-vs">VS</span>
          <TeamSide
            team={team2}
            players={team2Players}
            detailed={showDetails}
            won={match.is_completed && t2Total > t1Total}
            onSelectPlayer={onSelectPlayer}
          />
        </div>

        {showDetails && <MatchBalance balance={match.balance} />}

        {renderScoreSection()}
      </div>
    </div>
  );
}

export default MatchCard;
