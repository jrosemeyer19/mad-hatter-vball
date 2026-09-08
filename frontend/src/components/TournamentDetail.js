import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

import RoundView from './tournament/RoundView';
import Leaderboard from './tournament/Leaderboard';
import ResultsPanel from './tournament/ResultsPanel';
import { PlayerLegend } from './tournament/PlayerChip';
import PrintSchedule from './tournament/PrintSchedule';
import PlayerScheduleModal from './tournament/PlayerScheduleModal';
import { buildPlayerSchedule } from './tournament/playerSchedule';

function TournamentDetail({ user }) {
  const { id } = useParams();
  const navigate = useNavigate();

  const [tournament, setTournament] = useState(null);
  const [players, setPlayers] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [scoreInputs, setScoreInputs] = useState({});
  const [editingMatch, setEditingMatch] = useState(null);
  const [completionResults, setCompletionResults] = useState(null);

  const [activeTab, setActiveTab] = useState('rounds');
  const [activeRound, setActiveRound] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [finalByePlayerName, setFinalByePlayerName] = useState('');

  useEffect(() => {
    fetchTournamentData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchTournamentData = async () => {
    try {
      const response = await axios.get(`/api/tournaments/${id}`);
      setTournament(response.data.tournament);
      setPlayers(response.data.players);
      setRounds(response.data.rounds);
      setMatches(response.data.matches);

      if (response.data.tournament.status === 'completed') {
        await fetchTournamentResults();
      }
    } catch (err) {
      setError('Failed to load tournament data');
      console.error('Error fetching tournament:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTournamentResults = async () => {
    try {
      const response = await axios.get(`/api/tournaments/${id}/results`);
      setCompletionResults(response.data);
    } catch (err) {
      console.error('Error fetching tournament results:', err);
    }
  };

  const getRoundMatches = roundNumber => matches.filter(m => m.round_number === roundNumber);

  const openPlayerSchedule = player => setSelectedPlayerId(player.id);

  const sortedRounds = useMemo(
    () => [...rounds].sort((a, b) => a.round_number - b.round_number),
    [rounds]
  );

  // Land on the round that still needs scores rather than always round 1,
  // which is almost always the one being played right now.
  useEffect(() => {
    if (activeRound !== null || sortedRounds.length === 0) return;
    const firstUnfinished = sortedRounds.find(r =>
      getRoundMatches(r.round_number).some(m => !m.is_completed)
    );
    setActiveRound((firstUnfinished || sortedRounds[sortedRounds.length - 1]).round_number);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedRounds, matches]);

  useEffect(() => {
    if (tournament?.status === 'completed') setActiveTab('results');
  }, [tournament?.status]);

  const formatDate = dateString =>
    new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

  const handleScoreChange = (matchId, field, value) => {
    setScoreInputs(prev => ({
      ...prev,
      [matchId]: { ...prev[matchId], [field]: value }
    }));
  };

  const submitScores = async matchId => {
    setError('');
    const entered = scoreInputs[matchId] || {};
    const toNumber = v => (v === '' || v === undefined || v === null ? null : Number(v));

    const team1Game1 = toNumber(entered.team1Game1);
    const team2Game1 = toNumber(entered.team2Game1);
    const team1Game2 = toNumber(entered.team1Game2);
    const team2Game2 = toNumber(entered.team2Game2);

    if (team1Game1 === null || team2Game1 === null) {
      setError('Enter both game 1 scores.');
      return;
    }

    const provided = [team1Game1, team2Game1, team1Game2, team2Game2].filter(v => v !== null);
    if (provided.some(v => Number.isNaN(v) || v < 0 || v > 50)) {
      setError('Scores must be whole numbers between 0 and 50.');
      return;
    }

    // Half a game 2 would leave the match in a state nothing can score
    if ((team1Game2 === null) !== (team2Game2 === null)) {
      setError('Enter both game 2 scores, or leave both blank.');
      return;
    }

    try {
      await axios.put(`/api/tournaments/${id}/matches/${matchId}/scores`, {
        team1Game1,
        team2Game1,
        team1Game2,
        team2Game2
      });

      setEditingMatch(null);
      setScoreInputs(prev => {
        const next = { ...prev };
        delete next[matchId];
        return next;
      });
      await fetchTournamentData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit scores');
    }
  };

  const startEditingMatch = match => {
    setEditingMatch(match.id);
    setScoreInputs(prev => ({
      ...prev,
      [match.id]: {
        team1Game1: match.team1_game1_score ?? '',
        team2Game1: match.team2_game1_score ?? '',
        team1Game2: match.team1_game2_score ?? '',
        team2Game2: match.team2_game2_score ?? ''
      }
    }));
  };

  const completeTournament = async () => {
    if (!user) {
      setError('You must be logged in to complete tournaments');
      return;
    }
    if (!window.confirm('End this tournament? This cannot be undone.')) return;

    try {
      const response = await axios.post(`/api/tournaments/${id}/complete`);
      const results = response.data;
      await fetchTournamentData();
      // Set results after the refetch so it is not overwritten by it
      setCompletionResults(results);
      setActiveTab('results');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to complete tournament');
    }
  };

  const deleteTournament = async () => {
    if (!user) {
      setError('You must be logged in to delete tournaments');
      return;
    }
    const message = tournament.status === 'in_progress'
      ? 'Delete this in-progress tournament? All match data will be lost. This cannot be undone.'
      : 'Delete this tournament? This cannot be undone.';
    if (!window.confirm(message)) return;

    try {
      await axios.delete(`/api/tournaments/${id}`);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete tournament');
    }
  };

  const exportPlayers = () => {
    if (players.length === 0) {
      setError('No players to export');
      return;
    }
    const headers = 'name,gender,skill_level,is_setter\n';
    const rows = players
      .map(p => `${p.name},${p.gender},${p.skill_level},${p.is_setter}`)
      .join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${tournament.name || 'tournament'}_players.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const copyTournamentLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setNotice('Link copied — share it so players can enter their own scores.');
      setTimeout(() => setNotice(''), 4000);
    } catch {
      setError('Could not copy the link');
    }
  };

  const confirmRegenerate = async () => {
    try {
      setLoading(true);
      setShowRegenerateModal(false);
      await axios.post(`/api/tournaments/${id}/regenerate`, {
        finalByePlayerName: finalByePlayerName || null
      });
      setFinalByePlayerName('');
      await fetchTournamentData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to regenerate teams');
    } finally {
      setLoading(false);
    }
  };

  const allRoundsComplete = () =>
    rounds.length > 0 && matches.length > 0 && matches.every(m => m.is_completed);

  // Rounds carry a snapshot of each player, so look the live row up by id to
  // get totals that reflect the scores entered so far.
  const selectedPlayer = useMemo(
    () => players.find(p => p.id === selectedPlayerId) || null,
    [players, selectedPlayerId]
  );

  const selectedSchedule = useMemo(
    () =>
      selectedPlayer ? buildPlayerSchedule(selectedPlayer.id, rounds, matches, players) : [],
    [selectedPlayer, rounds, matches, players]
  );

  const progress = useMemo(() => {
    const total = matches.length;
    const completed = matches.filter(m => m.is_completed).length;
    return {
      completed,
      total,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0
    };
  }, [matches]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="card">
        <div className="empty-state">
          <div className="empty-state-icon">🤷</div>
          <h2>Tournament not found</h2>
          <p>The tournament you are looking for does not exist.</p>
          <Link to="/" className="btn btn-primary mt-1">Back to tournaments</Link>
        </div>
      </div>
    );
  }

  const currentRound = sortedRounds.find(r => r.round_number === activeRound);
  // Management controls follow what the API will actually allow: the creator,
  // a super admin, or anyone signed in if the creator shared the tournament.
  // Anonymous visitors get can_manage false, so this covers them too.
  const isAdmin = tournament.can_manage === true;

  return (
    <div className="stack">
      {/* Hidden on screen; this is what the Print schedule button produces */}
      <PrintSchedule
        tournament={tournament}
        players={players}
        rounds={rounds}
        matches={matches}
      />

      {/* ---- Tournament header ---- */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">
              <h1>{tournament.name}</h1>
              <span className={`tournament-status ${tournament.status}`}>
                {tournament.status.replace('_', ' ')}
              </span>
            </div>
            <p className="text-muted text-sm">
              {formatDate(tournament.date)} · {tournament.location}
            </p>
          </div>

          <div className="row-end">
            <button className="btn btn-secondary btn-sm" onClick={copyTournamentLink}>
              Share link
            </button>
            {rounds.length > 0 && (
              <button className="btn btn-secondary btn-sm" onClick={() => window.print()}>
                Print schedule
              </button>
            )}
            {tournament.status === 'setup' && isAdmin && (
              <Link to={`/tournament/${id}/setup`} className="btn btn-success btn-sm">
                Continue setup
              </Link>
            )}
            {tournament.status === 'in_progress' && isAdmin && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowRegenerateModal(true)}
                disabled={loading}
              >
                Re-generate teams
              </button>
            )}
            {tournament.status === 'in_progress' && isAdmin && allRoundsComplete() && (
              <button className="btn btn-success btn-sm" onClick={completeTournament}>
                Complete tournament
              </button>
            )}
            {tournament.status !== 'completed' && isAdmin && (
              <button className="btn btn-danger btn-sm" onClick={deleteTournament}>
                Delete
              </button>
            )}
          </div>
        </div>

        {notice && <div className="success-message">{notice}</div>}
        {error && <div className="error-message">{error}</div>}

        {tournament.status === 'in_progress' && progress.total > 0 && (
          <div className="mb-1">
            <div className="flex-between text-sm mb-1">
              <strong>{progress.completed} of {progress.total} matches played</strong>
              <span className="text-muted nums">{progress.percentage}%</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progress.percentage}%` }} />
            </div>
          </div>
        )}

        {tournament.status === 'in_progress' && !isAdmin && allRoundsComplete() && (
          <div className="info-message">
            All matches are in. The tournament director can now finalise the results.
          </div>
        )}

        <div className="stat-grid">
          <div className="stat">
            <div className="stat-label">Players</div>
            <div className="stat-value">{players.length}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Courts</div>
            <div className="stat-value">{tournament.courts_available}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Rounds</div>
            <div className="stat-value">{rounds.length || '—'}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Matches each</div>
            <div className="stat-value">{tournament.matches_per_player}</div>
          </div>
        </div>

        {isAdmin && rounds.length > 0 && (
          <div className="mt-1">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={showDetails}
                onChange={e => setShowDetails(e.target.checked)}
              />
              Show skill ratings, rosters and match balance
            </label>
            {showDetails && <PlayerLegend />}
          </div>
        )}
      </div>

      {tournament.status === 'setup' && (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <h2>Still setting up</h2>
            <p>Players are being added. Teams have not been generated yet.</p>
            {isAdmin && (
              <Link to={`/tournament/${id}/setup`} className="btn btn-primary mt-1">
                Continue setup
              </Link>
            )}
          </div>
        </div>
      )}

      {/* ---- Tabs ---- */}
      {rounds.length > 0 && (
        <>
          <div className="tabs">
            <button
              className={`tab${activeTab === 'rounds' ? ' is-active' : ''}`}
              onClick={() => setActiveTab('rounds')}
            >
              Rounds <span className="tab-count">{rounds.length}</span>
            </button>
            <button
              className={`tab${activeTab === 'leaderboard' ? ' is-active' : ''}`}
              onClick={() => setActiveTab('leaderboard')}
            >
              Leaderboard <span className="tab-count">{players.length}</span>
            </button>
            {completionResults && (
              <button
                className={`tab${activeTab === 'results' ? ' is-active' : ''}`}
                onClick={() => setActiveTab('results')}
              >
                Results
              </button>
            )}
          </div>

          {activeTab === 'rounds' && (
            <div className="stack">
              <div className="segmented">
                {sortedRounds.map(round => {
                  const roundMatches = getRoundMatches(round.round_number);
                  const done = roundMatches.length > 0 && roundMatches.every(m => m.is_completed);
                  return (
                    <button
                      key={round.id}
                      className={activeRound === round.round_number ? 'is-active' : ''}
                      onClick={() => setActiveRound(round.round_number)}
                    >
                      Round {round.round_number}{done ? ' ✓' : ''}
                    </button>
                  );
                })}
              </div>

              {currentRound && (
                <RoundView
                  round={currentRound}
                  roundMatches={getRoundMatches(currentRound.round_number)}
                  allPlayers={players}
                  showDetails={showDetails}
                  user={user}
                  editingMatch={editingMatch}
                  scoreInputs={scoreInputs}
                  onScoreChange={handleScoreChange}
                  onSubmit={submitScores}
                  onStartEdit={startEditingMatch}
                  onCancelEdit={() => setEditingMatch(null)}
                  onSelectPlayer={openPlayerSchedule}
                />
              )}
            </div>
          )}

          {activeTab === 'leaderboard' && (
            <Leaderboard
              players={players}
              onExport={exportPlayers}
              canExport={isAdmin}
              onSelectPlayer={openPlayerSchedule}
            />
          )}

          {activeTab === 'results' && <ResultsPanel results={completionResults} user={user} />}
        </>
      )}

      {/* ---- Player schedule modal ---- */}
      {selectedPlayer && (
        <PlayerScheduleModal
          player={selectedPlayer}
          schedule={selectedSchedule}
          user={user}
          onClose={() => setSelectedPlayerId(null)}
        />
      )}

      {/* ---- Regenerate modal ---- */}
      {showRegenerateModal && (
        <div className="modal-backdrop" onClick={() => setShowRegenerateModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Re-generate teams</h2>
            <div className="warn-message mt-1">
              <strong>This will:</strong>
              <ul style={{ margin: '0.5rem 0 0 1.1rem' }}>
                <li>Delete all existing teams and matches</li>
                <li>Reset every player's score to 0</li>
                <li>Discard all match results entered so far</li>
              </ul>
            </div>

            <div className="form-group">
              <label className="field-label" htmlFor="final-bye">
                Final round bye (optional)
              </label>
              <select
                id="final-bye"
                value={finalByePlayerName}
                onChange={e => setFinalByePlayerName(e.target.value)}
              >
                <option value="">No preference — assign automatically</option>
                {[...players]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map(player => (
                    <option key={player.id} value={player.name}>
                      {player.name} ({player.gender}, {player.skill_level})
                    </option>
                  ))}
              </select>
              <p className="field-hint">
                Pick someone who needs to leave early and they are guaranteed the final-round bye.
              </p>
            </div>

            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowRegenerateModal(false);
                  setFinalByePlayerName('');
                }}
              >
                Cancel
              </button>
              <button className="btn btn-danger" onClick={confirmRegenerate}>
                Re-generate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TournamentDetail;
