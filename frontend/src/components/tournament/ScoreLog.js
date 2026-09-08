import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';

// "21-15, 21-17", or a dash when there was nothing there before
function formatScores(t1g1, t1g2, t2g1, t2g2) {
  if (t1g1 === null || t1g1 === undefined) return '—';

  const games = [`${t1g1}-${t2g1}`];
  if (t1g2 !== null && t1g2 !== undefined) games.push(`${t1g2}-${t2g2}`);
  return games.join(', ');
}

function formatWhen(value) {
  const when = new Date(value);
  return when.toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit'
  });
}

function actorFor(event) {
  if (event.changed_by_username) return event.changed_by_username;
  if (event.device_label) return `phone ${event.device_label.slice(0, 6)}`;
  return 'unknown device';
}

/**
 * Every score submission for this tournament, newest first. Director-only:
 * scoring is open to anyone with the link, so this is what makes a
 * disagreement answerable after the fact.
 */
function ScoreLog({ tournamentId }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const response = await axios.get(`/api/tournaments/${tournamentId}/score-events`);
      setEvents(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load the score log');
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex-center" style={{ height: '160px' }}>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  const overwrites = events.filter(e => e.previous_is_completed === true).length;

  return (
    <div className="card">
      <div className="card-header">
        <h2>Score log</h2>
        <button className="btn btn-secondary btn-sm" onClick={load}>Refresh</button>
      </div>

      {error && <div className="error-message">{error}</div>}

      <p className="field-hint">
        Every score submitted for this tournament, newest first. Anyone with the
        share link can enter scores, so names only appear for signed-in
        directors — otherwise the device is a rough hint, not proof of who it was.
        {overwrites > 0 && (
          <>
            {' '}
            <strong>
              {overwrites} change{overwrites === 1 ? '' : 's'} replaced a match that was
              already final.
            </strong>
          </>
        )}
      </p>

      {events.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <p>No scores have been entered yet.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>When</th>
                <th>Match</th>
                <th>Was</th>
                <th>Became</th>
                <th>Entered by</th>
              </tr>
            </thead>
            <tbody>
              {events.map(event => {
                const overwroteFinal = event.previous_is_completed === true;
                return (
                  <tr key={event.id} className={overwroteFinal ? 'score-log-overwrite' : undefined}>
                    <td className="text-faint">{formatWhen(event.created_at)}</td>
                    <td>
                      R{event.round_number} · court {event.court}
                      <span className="text-faint">
                        {' '}(team {event.team1_number} v {event.team2_number})
                      </span>
                    </td>
                    <td className="num text-faint">
                      {formatScores(
                        event.previous_team1_game1_score, event.previous_team1_game2_score,
                        event.previous_team2_game1_score, event.previous_team2_game2_score
                      )}
                      {overwroteFinal && <span className="withdrew-tag">was final</span>}
                    </td>
                    <td className="num">
                      {formatScores(
                        event.team1_game1_score, event.team1_game2_score,
                        event.team2_game1_score, event.team2_game2_score
                      )}
                    </td>
                    <td>
                      {actorFor(event)}
                      {event.client_ip && (
                        <span className="text-faint" style={{ fontSize: '0.78rem' }}>
                          {' '}· {event.client_ip}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default ScoreLog;
