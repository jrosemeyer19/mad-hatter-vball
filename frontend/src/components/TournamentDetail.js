import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

function TournamentDetail({ user }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState(null);
  const [players, setPlayers] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scoreInputs, setScoreInputs] = useState({});
  const [completionResults, setCompletionResults] = useState(null);
  const [editingMatch, setEditingMatch] = useState(null);

  useEffect(() => {
    fetchTournamentData();
  }, [id]);

  const fetchTournamentResults = async () => {
    try {
      const response = await axios.get(`/api/tournaments/${id}/results`);
      setCompletionResults(response.data);
    } catch (error) {
      console.error('Error fetching tournament results:', error);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleScoreChange = (matchId, field, value) => {
    setScoreInputs({
      ...scoreInputs,
      [matchId]: {
        ...scoreInputs[matchId],
        [field]: parseInt(value) || 0
      }
    });
  };

  const submitScores = async (matchId) => {
    const scores = scoreInputs[matchId];
    if (!scores || Object.values(scores).some(score => score < 0 || score > 50)) {
      setError('Please enter valid scores (0-50)');
      return;
    }

    try {
      await axios.put(`/api/tournaments/${id}/matches/${matchId}/scores`, {
        team1Game1: scores.team1Game1,
        team1Game2: scores.team1Game2,
        team2Game1: scores.team2Game1,
        team2Game2: scores.team2Game2
      });
      
      setEditingMatch(null);
      fetchTournamentData();
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to submit scores');
    }
  };

  const startEditingMatch = (match) => {
    setEditingMatch(match.id);
    setScoreInputs({
      ...scoreInputs,
      [match.id]: {
        team1Game1: match.team1_game1_score || 0,
        team1Game2: match.team1_game2_score || 0,
        team2Game1: match.team2_game1_score || 0,
        team2Game2: match.team2_game2_score || 0
      }
    });
  };

  const cancelEditing = () => {
    setEditingMatch(null);
  };

  const completeTournament = async () => {
    if (!user) {
      setError('You must be logged in to complete tournaments');
      return;
    }

    if (!window.confirm('Are you sure you want to end this tournament? This cannot be undone.')) {
      return;
    }

    try {
      const response = await axios.post(`/api/tournaments/${id}/complete`);
      setCompletionResults(response.data);
      fetchTournamentData();
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to complete tournament');
    }
  };

  const deleteTournament = async () => {
    if (!user) {
      setError('You must be logged in to delete tournaments');
      return;
    }

    const confirmMessage = tournament.status === 'in_progress' 
      ? 'Are you sure you want to delete this in-progress tournament? All match data will be lost. This cannot be undone.'
      : 'Are you sure you want to delete this tournament? This cannot be undone.';

    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      await axios.delete(`/api/tournaments/${id}`);
      navigate('/');
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to delete tournament');
    }
  };

  const getTeamPlayers = (teamId, roundNumber) => {
    const round = rounds.find(r => r.round_number === roundNumber);
    if (!round || !round.teams) return [];
    
    const team = round.teams.find(t => t.id === teamId);
    return team ? team.players || [] : [];
  };

  const getRoundMatches = (roundNumber) => {
    return matches.filter(m => m.round_number === roundNumber);
  };

  const allRoundsComplete = () => {
    return rounds.length > 0 && 
           rounds.every(round => {
             const roundMatches = getRoundMatches(round.round_number);
             return roundMatches.every(m => m.is_completed);
           });
  };

  const getTournamentProgress = () => {
    if (!rounds.length) return { completed: 0, total: 0, percentage: 0 };
    
    const totalMatches = matches.length;
    const completedMatches = matches.filter(m => m.is_completed).length;
    
    return {
      completed: completedMatches,
      total: totalMatches,
      percentage: totalMatches > 0 ? Math.round((completedMatches / totalMatches) * 100) : 0
    };
  };

  if (loading) {
    return (
      <div className="flex-center" style={{ height: '200px' }}>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="card">
        <h2>Tournament Not Found</h2>
        <p>The tournament you're looking for doesn't exist.</p>
      </div>
    );
  }

  const progress = getTournamentProgress();

  return (
    <div>
      <div className="card">
        <div className="flex-between">
          <div>
            <h1>{tournament.name}</h1>
            <p><strong>Date:</strong> {formatDate(tournament.date)}</p>
            <p><strong>Location:</strong> {tournament.location}</p>
            <p><strong>Status:</strong> 
              <span className={`tournament-status ${tournament.status}`} style={{ marginLeft: '0.5rem' }}>
                {tournament.status.replace('_', ' ').toUpperCase()}
              </span>
            </p>
            {tournament.status === 'in_progress' && (
              <p><strong>Progress:</strong> {progress.completed}/{progress.total} matches completed ({progress.percentage}%)</p>
            )}
          </div>
          <div>
            {tournament.status !== 'completed' && (
              <div className="flex gap-1">
                {tournament.status === 'setup' && user && (
                  <Link 
                    to={`/tournament/${id}/setup`}
                    className="btn btn-success"
                  >
                    Continue Setup
                  </Link>
                )}
                {tournament.status === 'in_progress' && user && allRoundsComplete() && (
                  <button 
                    className="btn btn-success"
                    onClick={completeTournament}
                  >
                    Complete Tournament
                  </button>
                )}
                {tournament.status === 'in_progress' && !user && allRoundsComplete() && (
                  <div style={{ 
                    padding: '0.75rem 1rem', 
                    backgroundColor: '#e8f4f8', 
                    border: '1px solid #bee5eb', 
                    borderRadius: '4px',
                    fontSize: '0.9rem'
                  }}>
                    All matches completed! Tournament admin can finalize results.
                  </div>
                )}
                {user && (
                  <button 
                    className="btn btn-danger"
                    onClick={deleteTournament}
                  >
                    Delete Tournament
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
          <div>
            <strong>Courts Available:</strong> {tournament.courts_available}
          </div>
          <div>
            <strong>Min Players/Team:</strong> {tournament.min_players_per_team}
          </div>
          <div>
            <strong>Matches/Player:</strong> {tournament.matches_per_player}
          </div>
          <div>
            <strong>Entry Fee:</strong> ${tournament.entry_fee}
          </div>
          {rounds.length > 0 && (
            <div>
              <strong>Total Rounds:</strong> {rounds.length}
            </div>
          )}
          {tournament.status === 'completed' && (
            <div>
              <button 
                className="btn btn-secondary" 
                onClick={fetchTournamentResults}
                style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}
              >
                Load Results
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tournament Completion Results */}
      {completionResults && (
        <div className="card">
          <h2>Tournament Results</h2>
          
          {/* Prize Pool Information */}
          <div style={{ 
            backgroundColor: completionResults.hasPayouts ? '#d4edda' : '#fff3cd', 
            border: `1px solid ${completionResults.hasPayouts ? '#c3e6cb' : '#ffeaa7'}`,
            padding: '1rem', 
            borderRadius: '4px', 
            marginBottom: '1rem' 
          }}>
            <h4>Prize Pool Information</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div><strong>Entry Fee per Player:</strong> ${completionResults.tournament.entry_fee}</div>
              <div><strong>Total Players:</strong> {completionResults.standings.length}</div>
              <div><strong>Director Cost:</strong> ${completionResults.tournament.director_cost}</div>
              <div><strong>Total Prize Pool:</strong> ${completionResults.totalPool}</div>
            </div>
            {!completionResults.hasPayouts && (
              <div style={{ marginTop: '0.5rem', fontStyle: 'italic', color: '#856404' }}>
                No prize money to distribute (entry fee is $0 or insufficient to cover director costs)
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            <div>
              <h3>Male Results</h3>
              <table className="table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Player</th>
                    <th>Points</th>
                    {completionResults.hasPayouts && <th>Payout</th>}
                  </tr>
                </thead>
                <tbody>
                  {completionResults.standings
                    .filter(p => p.gender === 'male')
                    .map((player, index) => (
                      <tr key={player.name}>
                        <td>{player.rank}</td>
                        <td>{player.name}</td>
                        <td>{player.total_points}</td>
                        {completionResults.hasPayouts && (
                          <td>
                            {player.rank === 1 ? `${completionResults.payouts.first}` :
                             player.rank === 2 ? `${completionResults.payouts.second}` :
                             player.rank === 3 ? `${completionResults.payouts.third}` : '$0'}
                          </td>
                        )}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <div>
              <h3>Female Results</h3>
              <table className="table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Player</th>
                    <th>Points</th>
                    {completionResults.hasPayouts && <th>Payout</th>}
                  </tr>
                </thead>
                <tbody>
                  {completionResults.standings
                    .filter(p => p.gender === 'female')
                    .map((player, index) => (
                      <tr key={player.name}>
                        <td>{player.rank}</td>
                        <td>{player.name}</td>
                        <td>{player.total_points}</td>
                        {completionResults.hasPayouts && (
                          <td>
                            {player.rank === 1 ? `${completionResults.payouts.first}` :
                             player.rank === 2 ? `${completionResults.payouts.second}` :
                             player.rank === 3 ? `${completionResults.payouts.third}` : '$0'}
                          </td>
                        )}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
          
          {completionResults.hasPayouts && (
            <div className="mt-2">
              <h4>Payout Summary</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                <div><strong>1st Place (Male & Female):</strong> ${completionResults.payouts.first} each</div>
                <div><strong>2nd Place (Male & Female):</strong> ${completionResults.payouts.second} each</div>
                <div><strong>3rd Place (Male & Female):</strong> ${completionResults.payouts.third} each</div>
                <div><strong>Total Distributed:</strong> ${(completionResults.payouts.first + completionResults.payouts.second + completionResults.payouts.third) * 2}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Players List */}
      {players.length > 0 && (
        <div className="card">
          <h2>Players ({players.length})</h2>
          <div className="table-container" style={{ maxHeight: '300px', overflowY: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Gender</th>
                  <th>Matches Played</th>
                  <th>Total Points</th>
                </tr>
              </thead>
              <tbody>
                {players
                  .sort((a, b) => b.total_points - a.total_points)
                  .map((player) => (
                    <tr key={player.id}>
                      <td>{player.name}</td>
                      <td>{player.gender}</td>
                      <td>{player.matches_played}</td>
                      <td><strong>{player.total_points}</strong></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Rounds and Matches */}
      {rounds.length > 0 && (
        <div>
          {rounds
            .sort((a, b) => a.round_number - b.round_number)
            .map((round) => {
              const roundMatches = getRoundMatches(round.round_number);
              const playingTeams = round.teams?.filter(team => !team.is_bye_team) || [];
              const byeTeam = round.teams?.find(team => team.is_bye_team);
              
              return (
                <div key={round.id} className="card round-section">
                  <h2>Round {round.round_number}</h2>
                  
                  {/* Round Statistics */}
                  <div style={{ 
                    backgroundColor: '#f8f9fa', 
                    padding: '1rem', 
                    borderRadius: '4px', 
                    marginBottom: '1rem',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                    gap: '1rem'
                  }}>
                    <div><strong>Playing Teams:</strong> {playingTeams.length}</div>
                    <div><strong>Matches:</strong> {roundMatches.length}</div>
                    <div><strong>On Bye:</strong> {byeTeam?.players?.length || 0} players</div>
                    <div><strong>Completed:</strong> {roundMatches.filter(m => m.is_completed).length}/{roundMatches.length}</div>
                  </div>
                  
                  {/* Teams Grid - Including Bye Team */}
                  {round.teams && round.teams.length > 0 && (
                    <div>
                      <h3>Teams</h3>
                      <div className="teams-grid">
                        {/* Playing Teams */}
                        {playingTeams
                          .sort((a, b) => a.team_number - b.team_number)
                          .map((team) => (
                            <div key={team.id} className="team-card">
                              <div className="team-header">
                                Team {team.team_number} (Court {team.court})
                              </div>
                              <ul className="player-list">
                                {team.players?.map((player) => (
                                  <li key={player.id}>
                                    {player.name}
                                    <span style={{ fontSize: '0.8rem', color: '#666', marginLeft: '0.5rem' }}>
                                      ({player.skill_level}{player.is_setter ? ', Setter' : ''})
                                    </span>
                                  </li>
                                )) || []}
                              </ul>
                            </div>
                          ))}
                        
                        {/* Bye Team */}
                        {byeTeam && (
                          <div className="team-card" style={{ 
                            backgroundColor: '#fff3cd', 
                            borderLeft: '4px solid #ffc107' 
                          }}>
                            <div className="team-header" style={{ color: '#856404' }}>
                              On Bye ({byeTeam.players?.length || 0} players)
                            </div>
                            <ul className="player-list">
                              {byeTeam.players?.map((player) => (
                                <li key={player.id} style={{ color: '#856404' }}>
                                  {player.name}
                                  <span style={{ fontSize: '0.8rem', color: '#6c757d', marginLeft: '0.5rem' }}>
                                    ({player.skill_level}{player.is_setter ? ', Setter' : ''})
                                  </span>
                                </li>
                              )) || []}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Matches */}
                  {roundMatches.length > 0 && (
                    <div>
                      <h3>Matches</h3>
                      {roundMatches
                        .sort((a, b) => a.court - b.court)
                        .map((match) => {
                          const team1Players = getTeamPlayers(match.team1_id, round.round_number);
                          const team2Players = getTeamPlayers(match.team2_id, round.round_number);
                          const matchScores = scoreInputs[match.id] || {};

                          return (
                            <div key={match.id} className="match-card">
                              <h4>Court {match.court}</h4>
                              
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '1rem', alignItems: 'center' }}>
                                <div>
                                  <strong>Team 1</strong>
                                  <ul style={{ listStyle: 'none', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                                    {team1Players.map(p => (
                                      <li key={p.id}>{p.name}</li>
                                    ))}
                                  </ul>
                                </div>
                                
                                <div style={{ textAlign: 'center' }}>
                                  <strong>VS</strong>
                                </div>
                                
                                <div>
                                  <strong>Team 2</strong>
                                  <ul style={{ listStyle: 'none', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                                    {team2Players.map(p => (
                                      <li key={p.id}>{p.name}</li>
                                    ))}
                                  </ul>
                                </div>
                              </div>

                              {match.is_completed && editingMatch !== match.id ? (
                                <div className="mt-1">
                                  <div className="flex-between" style={{ alignItems: 'center', marginBottom: '0.5rem' }}>
                                    <strong>Final Scores:</strong>
                                    <button
                                      className="btn btn-secondary"
                                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                                      onClick={() => startEditingMatch(match)}
                                    >
                                      Edit Scores
                                    </button>
                                  </div>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
                                    <div className="text-center">
                                      <div style={{ fontSize: '0.8rem' }}>Team 1 Game 1</div>
                                      <div><strong>{match.team1_game1_score}</strong></div>
                                    </div>
                                    <div className="text-center">
                                      <div style={{ fontSize: '0.8rem' }}>Team 2 Game 1</div>
                                      <div><strong>{match.team2_game1_score}</strong></div>
                                    </div>
                                    <div className="text-center">
                                      <div style={{ fontSize: '0.8rem' }}>Team 1 Game 2</div>
                                      <div><strong>{match.team1_game2_score}</strong></div>
                                    </div>
                                    <div className="text-center">
                                      <div style={{ fontSize: '0.8rem' }}>Team 2 Game 2</div>
                                      <div><strong>{match.team2_game2_score}</strong></div>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="mt-1">
                                  <strong>{match.is_completed ? 'Edit Scores:' : 'Enter Scores:'}</strong>
                                  <div className="score-inputs">
                                    <div>
                                      <label style={{ fontSize: '0.8rem' }}>Team 1 Game 1</label>
                                      <input
                                        type="number"
                                        min="0"
                                        max="50"
                                        value={matchScores.team1Game1 || ''}
                                        onChange={(e) => handleScoreChange(match.id, 'team1Game1', e.target.value)}
                                      />
                                    </div>
                                    <div>
                                      <label style={{ fontSize: '0.8rem' }}>Team 2 Game 1</label>
                                      <input
                                        type="number"
                                        min="0"
                                        max="50"
                                        value={matchScores.team2Game1 || ''}
                                        onChange={(e) => handleScoreChange(match.id, 'team2Game1', e.target.value)}
                                      />
                                    </div>
                                    <div>
                                      <label style={{ fontSize: '0.8rem' }}>Team 1 Game 2</label>
                                      <input
                                        type="number"
                                        min="0"
                                        max="50"
                                        value={matchScores.team1Game2 || ''}
                                        onChange={(e) => handleScoreChange(match.id, 'team1Game2', e.target.value)}
                                      />
                                    </div>
                                    <div>
                                      <label style={{ fontSize: '0.8rem' }}>Team 2 Game 2</label>
                                      <input
                                        type="number"
                                        min="0"
                                        max="50"
                                        value={matchScores.team2Game2 || ''}
                                        onChange={(e) => handleScoreChange(match.id, 'team2Game2', e.target.value)}
                                      />
                                    </div>
                                  </div>
                                  <div className="flex gap-1 mt-1">
                                    <button
                                      className="btn btn-success"
                                      onClick={() => submitScores(match.id)}
                                      disabled={!Object.values(matchScores).every(score => score >= 0)}
                                    >
                                      {match.is_completed ? 'Update Scores' : 'Submit Scores'}
                                    </button>
                                    {match.is_completed && (
                                      <button
                                        className="btn btn-secondary"
                                        onClick={cancelEditing}
                                      >
                                        Cancel
                                      </button>
                                    )}
                                  </div>
                                  {!match.is_completed && (
                                    <div style={{ fontSize: '0.8rem', color: '#7f8c8d', marginTop: '0.5rem' }}>
                                      Anyone can enter scores - no login required
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {tournament.status === 'setup' && (
        <div className="card">
          <h2>Tournament Setup</h2>
          <p>This tournament is still in setup phase. Players are being added and teams haven't been generated yet.</p>
        </div>
      )}
    </div>
  );
}

export default TournamentDetail;Data = async () => {
    try {
      const response = await axios.get(`/api/tournaments/${id}`);
      setTournament(response.data.tournament);
      setPlayers(response.data.players);
      setRounds(response.data.rounds);
      setMatches(response.data.matches);
      
      // If tournament is completed, fetch results automatically
      if (response.data.tournament.status === 'completed') {
        fetchTournamentResults();
      }
    } catch (error) {
      setError('Failed to load tournament data');
      console.error('Error fetching tournament:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTournament
