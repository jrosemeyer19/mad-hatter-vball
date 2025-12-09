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
  const [showPlayerDetails, setShowPlayerDetails] = useState(false);
  const [showPayouts, setShowPayouts] = useState(false);
  const [leaderboardTab, setLeaderboardTab] = useState('all'); // 'all', 'male', 'female'
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [finalByePlayerName, setFinalByePlayerName] = useState('');

  useEffect(() => {
    fetchTournamentData();
  }, [id]);

  const fetchTournamentData = async () => {
    try {
      const response = await axios.get(`/api/tournaments/${id}`);
      setTournament(response.data.tournament);
      setPlayers(response.data.players);
      setRounds(response.data.rounds);
      setMatches(response.data.matches);
      
      // If tournament is completed, fetch results automatically
      if (response.data.tournament.status === 'completed') {
        await fetchTournamentResults();
      }
    } catch (error) {
      setError('Failed to load tournament data');
      console.error('Error fetching tournament:', error);
    } finally {
      setLoading(false);
    }
  };

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

  const calculateTeamSkillRating = (players) => {
    if (!players || players.length === 0) return 0;

    const skillValues = {
      'AA': 4.0,
      'A': 3.0,
      'BB': 2.0,
      'B': 1.0
    };

    return players.reduce((total, player) => {
      const baseSkill = skillValues[player.skill_level] || 1.5;
      const setterBonus = player.is_setter ? 0.3 : 0;
      return total + baseSkill + setterBonus;
    }, 0);
  };

  // Helper function to get player color styling based on gender, skill level, and setter status
  const getPlayerStyle = (player) => {
    // Color scheme:
    // Males: blue tones, Females: pink/purple tones
    // AA: darkest/elite, A: darker/strong, BB: medium, B: lighter
    // Setters get a special indicator

    const colors = {
      male: {
        AA: { bg: '#0d2f4a', text: '#ffffff' },   // Very dark blue (elite)
        A: { bg: '#1a5276', text: '#ffffff' },    // Dark blue (strong)
        BB: { bg: '#3498db', text: '#ffffff' },   // Medium blue
        B: { bg: '#85c1e9', text: '#1a5276' }     // Light blue
      },
      female: {
        AA: { bg: '#4a0d0d', text: '#ffffff' },   // Very dark red/maroon (elite)
        A: { bg: '#7b241c', text: '#ffffff' },    // Dark red/maroon (strong)
        BB: { bg: '#c0392b', text: '#ffffff' },   // Medium red
        B: { bg: '#f1948a', text: '#7b241c' }     // Light pink
      }
    };

    const gender = player.gender?.toLowerCase() || 'male';
    const skill = player.skill_level || 'BB';
    const colorSet = colors[gender]?.[skill] || colors.male.BB;

    return {
      backgroundColor: colorSet.bg,
      color: colorSet.text,
      padding: '0.25rem 0.5rem',
      borderRadius: '4px',
      display: 'inline-block',
      fontSize: '0.85rem',
      fontWeight: player.is_setter ? 'bold' : 'normal',
      border: player.is_setter ? '2px solid #f39c12' : 'none',
      boxShadow: player.is_setter ? '0 0 4px #f39c12' : 'none'
    };
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
    
    // Check if Game 1 scores are present
    const hasGame1Scores = scores && 
      scores.team1Game1 !== undefined && scores.team1Game1 !== null && scores.team1Game1 >= 0 &&
      scores.team2Game1 !== undefined && scores.team2Game1 !== null && scores.team2Game1 >= 0;
    
    if (!hasGame1Scores) {
      setError('Please enter Game 1 scores');
      return;
    }
    
    // Validate all provided scores are within range
    const allScores = [scores.team1Game1, scores.team2Game1, scores.team1Game2, scores.team2Game2];
    if (allScores.some(score => score !== undefined && score !== null && score !== '' && (score < 0 || score > 50))) {
      setError('Please enter valid scores (0-50)');
      return;
    }

    try {
      await axios.put(`/api/tournaments/${id}/matches/${matchId}/scores`, {
        team1Game1: scores.team1Game1,
        team1Game2: scores.team1Game2 !== '' && scores.team1Game2 !== undefined && scores.team1Game2 !== null ? scores.team1Game2 : null,
        team2Game1: scores.team2Game1,
        team2Game2: scores.team2Game2 !== '' && scores.team2Game2 !== undefined && scores.team2Game2 !== null ? scores.team2Game2 : null
      });
      
      // Clear the editing state and score inputs for this match
      setEditingMatch(null);
      const newScoreInputs = { ...scoreInputs };
      delete newScoreInputs[matchId];
      setScoreInputs(newScoreInputs);
      
      // Fetch updated data
      await fetchTournamentData();
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
      await fetchTournamentData();
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

  const initiateRegenerate = () => {
    if (!user) {
      setError('You must be logged in to regenerate teams');
      return;
    }
    setShowRegenerateModal(true);
  };

  const confirmRegenerate = async () => {
    try {
      setLoading(true);
      setShowRegenerateModal(false);
      await axios.post(`/api/tournaments/${id}/regenerate`, {
        finalByePlayerName: finalByePlayerName || null
      });
      setFinalByePlayerName(''); // Reset selection
      await fetchTournamentData(); // Refresh the tournament data
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to regenerate teams');
    } finally {
      setLoading(false);
    }
  };

  const cancelRegenerate = () => {
    setShowRegenerateModal(false);
    setFinalByePlayerName('');
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
                {tournament.status === 'in_progress' && user && (
                  <button
                    className="btn btn-secondary"
                    onClick={initiateRegenerate}
                    disabled={loading}
                    title="Regenerate all teams and matches"
                  >
                    Re-generate Teams
                  </button>
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
          {/* Player Details Toggle - Only for authenticated users */}
          {user && rounds.length > 0 && (
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                <input
                  type="checkbox"
                  checked={showPlayerDetails}
                  onChange={(e) => setShowPlayerDetails(e.target.checked)}
                />
                Show player details in teams
              </label>
              {showPlayerDetails && (
                <div style={{
                  marginTop: '0.75rem',
                  padding: '0.75rem',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '4px',
                  fontSize: '0.8rem'
                }}>
                  <div style={{ marginBottom: '0.5rem', fontWeight: 'bold' }}>Color Legend:</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{ backgroundColor: '#0d2f4a', color: '#fff', padding: '0.15rem 0.4rem', borderRadius: '3px' }}>M-AA</span>
                    <span style={{ backgroundColor: '#1a5276', color: '#fff', padding: '0.15rem 0.4rem', borderRadius: '3px' }}>M-A</span>
                    <span style={{ backgroundColor: '#3498db', color: '#fff', padding: '0.15rem 0.4rem', borderRadius: '3px' }}>M-BB</span>
                    <span style={{ backgroundColor: '#85c1e9', color: '#1a5276', padding: '0.15rem 0.4rem', borderRadius: '3px' }}>M-B</span>
                    <span style={{ margin: '0 0.25rem', color: '#999' }}>|</span>
                    <span style={{ backgroundColor: '#4a0d0d', color: '#fff', padding: '0.15rem 0.4rem', borderRadius: '3px' }}>F-AA</span>
                    <span style={{ backgroundColor: '#7b241c', color: '#fff', padding: '0.15rem 0.4rem', borderRadius: '3px' }}>F-A</span>
                    <span style={{ backgroundColor: '#c0392b', color: '#fff', padding: '0.15rem 0.4rem', borderRadius: '3px' }}>F-BB</span>
                    <span style={{ backgroundColor: '#f1948a', color: '#7b241c', padding: '0.15rem 0.4rem', borderRadius: '3px' }}>F-B</span>
                    <span style={{ margin: '0 0.25rem', color: '#999' }}>|</span>
                    <span style={{ backgroundColor: '#3498db', color: '#fff', padding: '0.15rem 0.4rem', borderRadius: '3px', border: '2px solid #f39c12', boxShadow: '0 0 4px #f39c12', fontWeight: 'bold' }}>★ Setter</span>
                  </div>
                </div>
              )}
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
      <div className="flex-between" style={{ alignItems: 'center', marginBottom: '1rem' }}>
        <h4>Prize Pool Information</h4>
        {user && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
            <input
              type="checkbox"
              checked={showPayouts}
              onChange={(e) => setShowPayouts(e.target.checked)}
            />
            Show payout columns (Admin only)
          </label>
        )}
      </div>
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
              <th>Points +/-</th>
              {user && showPayouts && <th>Payout</th>}
            </tr>
          </thead>
          <tbody>
            {completionResults.standings
              .filter(p => p.gender === 'male')
              .map((player, index) => {
                // Simple payout calculation based on rank
                let payout = '$0';
                const rank = Number(player.rank);
                
                if (completionResults.hasPayouts) {
                  switch (rank) {
                    case 1:
                      payout = `$${completionResults.payouts.first}`;
                      break;
                    case 2:
                      payout = `$${completionResults.payouts.second}`;
                      break;
                    case 3:
                      payout = `$${completionResults.payouts.third}`;
                      break;
                    default:
                      payout = '$0';
                  }
                }
                
                return (
                  <tr key={player.name}>
                    <td>{rank}</td>
                    <td>{player.name}</td>
                    <td><strong>{player.total_points}</strong></td>
                    <td>
                      <strong 
                        style={{ 
                          color: player.point_differential > 0 ? '#27ae60' : 
                                 player.point_differential < 0 ? '#e74c3c' : '#7f8c8d'
                        }}
                      >
                        {player.point_differential > 0 ? '+' : ''}{player.point_differential}
                      </strong>
                    </td>
                    {user && showPayouts && <td><strong>{payout}</strong></td>}
                  </tr>
                );
              })}
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
              <th>Points +/-</th>
              {user && showPayouts && <th>Payout</th>}
            </tr>
          </thead>
          <tbody>
            {completionResults.standings
              .filter(p => p.gender === 'female')
              .map((player, index) => {
                // Simple payout calculation based on rank
                let payout = '$0';
                const rank = Number(player.rank);
                
                if (completionResults.hasPayouts) {
                  switch (rank) {
                    case 1:
                      payout = `$${completionResults.payouts.first}`;
                      break;
                    case 2:
                      payout = `$${completionResults.payouts.second}`;
                      break;
                    case 3:
                      payout = `$${completionResults.payouts.third}`;
                      break;
                    default:
                      payout = '$0';
                  }
                }
                
                return (
                  <tr key={player.name}>
                    <td>{rank}</td>
                    <td>{player.name}</td>
                    <td><strong>{player.total_points}</strong></td>
                    <td>
                      <strong 
                        style={{ 
                          color: player.point_differential > 0 ? '#27ae60' : 
                                 player.point_differential < 0 ? '#e74c3c' : '#7f8c8d'
                        }}
                      >
                        {player.point_differential > 0 ? '+' : ''}{player.point_differential}
                      </strong>
                    </td>
                    {user && showPayouts && <td><strong>{payout}</strong></td>}
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
    
    {completionResults.hasPayouts && user && showPayouts && (
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

      {/* Players List with Tabs */}
      {players.length > 0 && (
        <div className="card">
          <h2>Leaderboard ({players.length} Players)</h2>
          
          {/* Tab Navigation */}
          <div style={{ 
            display: 'flex', 
            gap: '0.5rem', 
            marginBottom: '1rem',
            borderBottom: '2px solid #e0e0e0',
            paddingBottom: '0.5rem'
          }}>
            <button
              onClick={() => setLeaderboardTab('all')}
              style={{
                padding: '0.5rem 1rem',
                border: 'none',
                background: leaderboardTab === 'all' ? '#3498db' : 'transparent',
                color: leaderboardTab === 'all' ? 'white' : '#333',
                borderRadius: '4px 4px 0 0',
                cursor: 'pointer',
                fontWeight: leaderboardTab === 'all' ? 'bold' : 'normal',
                transition: 'all 0.2s'
              }}
            >
              All Players ({players.length})
            </button>
            <button
              onClick={() => setLeaderboardTab('male')}
              style={{
                padding: '0.5rem 1rem',
                border: 'none',
                background: leaderboardTab === 'male' ? '#3498db' : 'transparent',
                color: leaderboardTab === 'male' ? 'white' : '#333',
                borderRadius: '4px 4px 0 0',
                cursor: 'pointer',
                fontWeight: leaderboardTab === 'male' ? 'bold' : 'normal',
                transition: 'all 0.2s'
              }}
            >
              Male ({players.filter(p => p.gender.toLowerCase() === 'male' || p.gender.toLowerCase() === 'm').length})
            </button>
            <button
              onClick={() => setLeaderboardTab('female')}
              style={{
                padding: '0.5rem 1rem',
                border: 'none',
                background: leaderboardTab === 'female' ? '#3498db' : 'transparent',
                color: leaderboardTab === 'female' ? 'white' : '#333',
                borderRadius: '4px 4px 0 0',
                cursor: 'pointer',
                fontWeight: leaderboardTab === 'female' ? 'bold' : 'normal',
                transition: 'all 0.2s'
              }}
            >
              Female ({players.filter(p => p.gender.toLowerCase() === 'female' || p.gender.toLowerCase() === 'f').length})
            </button>
          </div>

          {/* Leaderboard Table */}
          <div className="table-container" style={{ maxHeight: '300px', overflowY: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Name</th>
                  <th>Gender</th>
                  <th>Matches Played</th>
                  <th>Total Points</th>
                  <th>Points +/-</th>
                </tr>
              </thead>
              <tbody>
                {players
                  .filter(player => {
                    if (leaderboardTab === 'all') return true;
                    const gender = player.gender.toLowerCase();
                    if (leaderboardTab === 'male') return gender === 'male' || gender === 'm';
                    if (leaderboardTab === 'female') return gender === 'female' || gender === 'f';
                    return true;
                  })
                  .sort((a, b) => {
                    // Sort by total points first, then by point differential as tiebreaker
                    if (b.total_points !== a.total_points) {
                      return b.total_points - a.total_points;
                    }
                    return b.point_differential - a.point_differential;
                  })
                  .map((player, index) => (
                    <tr key={player.id}>
                      <td>
                        <strong style={{ 
                          color: index === 0 ? '#f39c12' : 
                                 index === 1 ? '#95a5a6' : 
                                 index === 2 ? '#cd7f32' : '#333',
                          fontSize: index < 3 ? '1.1rem' : '1rem'
                        }}>
                          {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}
                        </strong>
                      </td>
                      <td>
                        <strong style={{
                          color: index === 0 ? '#f39c12' : 
                                 index === 1 ? '#95a5a6' : 
                                 index === 2 ? '#cd7f32' : '#333'
                        }}>
                          {player.name}
                        </strong>
                      </td>
                      <td>{player.gender}</td>
                      <td>{player.matches_played}</td>
                      <td><strong>{player.total_points}</strong></td>
                      <td>
                        <strong 
                          style={{ 
                            color: player.point_differential > 0 ? '#27ae60' : 
                                   player.point_differential < 0 ? '#e74c3c' : '#7f8c8d'
                          }}
                        >
                          {player.point_differential > 0 ? '+' : ''}{player.point_differential}
                        </strong>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          
          {leaderboardTab !== 'all' && (
            <div style={{ 
              fontSize: '0.85rem', 
              color: '#7f8c8d', 
              marginTop: '0.5rem',
              fontStyle: 'italic'
            }}>
              Showing {leaderboardTab} players only. Rankings are within this category.
            </div>
          )}
        </div>
      )}

      {/* Rounds and Matches - FIXED VERSION */}
      {rounds.length > 0 && (
        <div>
          {rounds
            .sort((a, b) => a.round_number - b.round_number)
            .map((round) => {
              const roundMatches = getRoundMatches(round.round_number);
              const playingTeams = round.teams?.filter(team => !team.is_bye_team) || [];
              const byeTeam = round.teams?.find(team => team.is_bye_team);
              
              // Enhanced bye detection - also check for players who should be on bye
              // based on tournament structure if no explicit bye team exists
              const playersInMatches = playingTeams.reduce((acc, team) => {
                return acc.concat(team.players || []);
              }, []);
              
              // Calculate bye players - either from explicit bye team or missing from playing teams  
              let byePlayers = [];
              if (byeTeam && byeTeam.players) {
                byePlayers = byeTeam.players;
              } else {
                // For rounds without explicit bye teams, check if all players are accounted for
                const allTournamentPlayers = players.length;
                const playingInThisRound = playersInMatches.length;
                if (playingInThisRound < allTournamentPlayers) {
                  // There are players on bye, but no explicit bye team was created
                  // This might happen in the final round or due to algorithm issues
                  const playingPlayerIds = new Set(playersInMatches.map(p => p.id));
                  byePlayers = players.filter(p => !playingPlayerIds.has(p.id));
                }
              }
              
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
                    <div><strong>On Bye:</strong> {byePlayers.length} players</div>
                    <div><strong>Completed:</strong> {roundMatches.filter(m => m.is_completed).length}/{roundMatches.length}</div>
                  </div>
                  
                  {/* Teams Grid - Including Enhanced Bye Team Detection */}
                  {round.teams && round.teams.length > 0 && (
                    <div>
                      <h3>Teams</h3>
                      <div className="teams-grid">
                        {/* Playing Teams */}
                        {playingTeams
                          .sort((a, b) => a.team_number - b.team_number)
                          .map((team) => {
                            const teamSkillRating = calculateTeamSkillRating(team.players);
    
                            return (
                              <div key={team.id} className="team-card">
                                <div className="team-header">
                                  Team {team.team_number} (Court {team.court})
                                  {showPlayerDetails && (
                                    <div style={{ 
                                      fontSize: '0.85rem', 
                                      fontWeight: 'normal', 
                                      color: '#3498db',
                                      marginTop: '0.25rem'
                                    }}>
                                      Team Skill: {teamSkillRating.toFixed(1)}
                                    </div>
                                  )}
                                </div>
                                <ul className="player-list">
                                  {team.players?.map((player) => (
                                    <li key={player.id} style={{ marginBottom: showPlayerDetails ? '0.4rem' : '0' }}>
                                      {showPlayerDetails ? (
                                        <span style={getPlayerStyle(player)}>
                                          {player.name}
                                          {player.is_setter ? ' ★' : ''}
                                        </span>
                                      ) : (
                                        player.name
                                      )}
                                    </li>
                                  )) || []}
                                </ul>
                              </div>
                            );
                          })}
                        {/* Bye Team - Enhanced to show even when not explicitly created */}
                        {byePlayers.length > 0 && (
                          <div className="team-card" style={{ 
                            backgroundColor: '#fff3cd', 
                            borderLeft: '4px solid #ffc107' 
                          }}>
                            <div className="team-header" style={{ color: '#856404' }}>
                              On Bye ({byePlayers.length} players)
                            </div>
                            <ul className="player-list">
                              {byePlayers.map((player) => (
                                <li key={player.id} style={{ marginBottom: showPlayerDetails ? '0.4rem' : '0' }}>
                                  {showPlayerDetails ? (
                                    <span style={getPlayerStyle(player)}>
                                      {player.name}
                                      {player.is_setter ? ' ★' : ''}
                                    </span>
                                  ) : (
                                    <span style={{ color: '#856404' }}>{player.name}</span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Matches - FIXED VERSION */}
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
                              
                              {/* FIXED: Proper 3-column grid with correct player arrays */}
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '1rem', alignItems: 'center' }}>
                                <div>
                                  <strong>Team 1</strong>
                                  {showPlayerDetails && team1Players.length > 0 && (
                                    <div style={{ 
                                      fontSize: '0.8rem', 
                                      color: '#3498db',
                                      fontWeight: 'normal',
                                      marginTop: '0.25rem'
                                    }}>
                                      Skill: {calculateTeamSkillRating(team1Players).toFixed(1)}
                                    </div>
                                  )}
                                  <ul style={{ listStyle: 'none', fontSize: '0.9rem', marginTop: '0.5rem', padding: 0 }}>
                                    {team1Players.map(p => (
                                      <li key={p.id} style={{ marginBottom: showPlayerDetails ? '0.4rem' : '0.2rem' }}>
                                        {showPlayerDetails ? (
                                          <span style={getPlayerStyle(p)}>
                                            {p.name}
                                            {p.is_setter ? ' ★' : ''}
                                          </span>
                                        ) : (
                                          p.name
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                </div>

                                <div style={{ textAlign: 'center' }}>
                                  <strong>VS</strong>
                                  {showPlayerDetails && team1Players.length > 0 && team2Players.length > 0 && (() => {
                                    const team1Skill = calculateTeamSkillRating(team1Players);
                                    const team2Skill = calculateTeamSkillRating(team2Players);
                                    const skillDiff = Math.abs(team1Skill - team2Skill);
                                    const avgSkill = (team1Skill + team2Skill) / 2;
                                    const balancePercent = avgSkill > 0 ? (skillDiff / avgSkill * 100).toFixed(0) : 0;
    
                                    let balanceColor = '#27ae60'; // green
                                    let balanceLabel = 'Excellent';
    
                                    if (skillDiff >= 6) {
                                      balanceColor = '#e74c3c'; // red
                                      balanceLabel = 'Poor';
                                    } else if (skillDiff >= 4) {
                                      balanceColor = '#f39c12'; // orange
                                      balanceLabel = 'Fair';
                                    } else if (skillDiff >= 2) {
                                      balanceColor = '#3498db'; // blue
                                      balanceLabel = 'Good';
                                    }
    
                                    return (
                                      <div style={{ 
                                        fontSize: '0.75rem',
                                        color: balanceColor,
                                        marginTop: '0.5rem',
                                        fontWeight: 'bold'
                                      }}>
                                        {balancePercent}% diff<br/>
                                        {balanceLabel}
                                      </div>
                                    );
                                  })()}
                                </div>

                                <div>
                                  <strong>Team 2</strong>
                                  {showPlayerDetails && team2Players.length > 0 && (
                                    <div style={{
                                      fontSize: '0.8rem',
                                      color: '#3498db',
                                      fontWeight: 'normal',
                                      marginTop: '0.25rem'
                                    }}>
                                      Skill: {calculateTeamSkillRating(team2Players).toFixed(1)}
                                    </div>
                                  )}
                                  <ul style={{ listStyle: 'none', fontSize: '0.9rem', marginTop: '0.5rem', padding: 0 }}>
                                    {team2Players.map(p => (
                                      <li key={p.id} style={{ marginBottom: showPlayerDetails ? '0.4rem' : '0.2rem' }}>
                                        {showPlayerDetails ? (
                                          <span style={getPlayerStyle(p)}>
                                            {p.name}
                                            {p.is_setter ? ' ★' : ''}
                                          </span>
                                        ) : (
                                          p.name
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>

                              {/* Match score display with proper permissions */}
                              {(() => {
                                const hasGame1 = match.team1_game1_score !== null && match.team1_game1_score !== undefined;
                                const hasGame2 = match.team1_game2_score !== null && match.team1_game2_score !== undefined;
                                const isEditing = editingMatch === match.id;
                                const isLoggedIn = !!user;

                                // Case 1: Match fully completed (both games) and not editing
                                if (match.is_completed && !isEditing) {
                                  return (
                                    <div className="mt-1">
                                      <div className="flex-between" style={{ alignItems: 'center', marginBottom: '0.5rem' }}>
                                        <strong>Final Scores:</strong>
                                        {isLoggedIn && (
                                          <button
                                            className="btn btn-secondary"
                                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                                            onClick={() => startEditingMatch(match)}
                                          >
                                            Edit Scores
                                          </button>
                                        )}
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
                                      {!isLoggedIn && (
                                        <div style={{ fontSize: '0.8rem', color: '#7f8c8d', marginTop: '0.5rem', fontStyle: 'italic' }}>
                                          Match completed. Login required to edit scores.
                                        </div>
                                      )}
                                    </div>
                                  );
                                }

                                // Case 2: Only Game 1 submitted (partial) and not editing
                                if (hasGame1 && !hasGame2 && !isEditing) {
                                  return (
                                    <div className="mt-1">
                                      <div className="flex-between" style={{ alignItems: 'center', marginBottom: '0.5rem' }}>
                                        <strong>Game 1 Scores (Game 2 Pending):</strong>
                                        <button
                                          className="btn btn-primary"
                                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                                          onClick={() => startEditingMatch(match)}
                                        >
                                          Add Game 2 Scores
                                        </button>
                                      </div>
                                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                                        <div className="text-center">
                                          <div style={{ fontSize: '0.8rem' }}>Team 1 Game 1</div>
                                          <div><strong>{match.team1_game1_score}</strong></div>
                                        </div>
                                        <div className="text-center">
                                          <div style={{ fontSize: '0.8rem' }}>Team 2 Game 1</div>
                                          <div><strong>{match.team2_game1_score}</strong></div>
                                        </div>
                                      </div>
                                      <div style={{ fontSize: '0.8rem', color: '#f39c12', marginTop: '0.5rem', fontWeight: 'bold' }}>
                                        ℹ️ Game 2 scores needed to complete this match
                                      </div>
                                    </div>
                                  );
                                }

                                // Case 3: Editing mode - different behavior for logged in vs not logged in
                                if (isEditing) {
                                  // For non-logged users with partial scores, only allow Game 2 input
                                  if (!isLoggedIn && hasGame1 && !hasGame2) {
                                    return (
                                      <div className="mt-1">
                                        <strong>Add Game 2 Scores:</strong>
                                        
                                        {/* Show Game 1 as read-only */}
                                        <div style={{ marginTop: '0.5rem', padding: '0.75rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                                          <div style={{ fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '0.5rem', color: '#666' }}>
                                            Game 1 Scores (Locked)
                                          </div>
                                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                                            <div className="text-center">
                                              <div style={{ fontSize: '0.8rem' }}>Team 1</div>
                                              <div><strong>{match.team1_game1_score}</strong></div>
                                            </div>
                                            <div className="text-center">
                                              <div style={{ fontSize: '0.8rem' }}>Team 2</div>
                                              <div><strong>{match.team2_game1_score}</strong></div>
                                            </div>
                                          </div>
                                        </div>

                                        {/* Show Game 2 as editable */}
                                        <div style={{ marginTop: '1rem' }}>
                                          <div style={{ fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                                            Enter Game 2 Scores
                                          </div>
                                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                                            <div>
                                              <label style={{ fontSize: '0.8rem' }}>Team 1 Game 2</label>
                                              <input
                                                type="number"
                                                min="0"
                                                max="50"
                                                value={matchScores.team1Game2 || ''}
                                                onChange={(e) => handleScoreChange(match.id, 'team1Game2', e.target.value)}
                                                style={{ padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px', width: '100%', textAlign: 'center' }}
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
                                                style={{ padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px', width: '100%', textAlign: 'center' }}
                                              />
                                            </div>
                                          </div>
                                        </div>

                                        <div className="flex gap-1 mt-1">
                                          <button
                                            className="btn btn-success"
                                            onClick={() => submitScores(match.id)}
                                            disabled={
                                              (!matchScores.team1Game2 && matchScores.team1Game2 !== 0) ||
                                              (!matchScores.team2Game2 && matchScores.team2Game2 !== 0)
                                            }
                                          >
                                            Complete Match
                                          </button>
                                          <button
                                            className="btn btn-secondary"
                                            onClick={cancelEditing}
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: '#7f8c8d', marginTop: '0.5rem' }}>
                                          Game 1 scores cannot be changed. Login to edit all scores.
                                        </div>
                                      </div>
                                    );
                                  }

                                  // For logged users or first-time entry - allow editing everything
                                  return (
                                    <div className="mt-1">
                                      <strong>{match.is_completed ? 'Edit Scores:' : hasGame1 ? 'Edit All Scores:' : 'Enter Scores:'}</strong>
                                      <div className="score-inputs-grouped">
                                        <div className="game-group">
                                          <div className="game-label">Game 1</div>
                                          <div className="game-scores">
                                            <div>
                                              <label style={{ fontSize: '0.8rem' }}>Team 1</label>
                                              <input
                                                type="number"
                                                min="0"
                                                max="50"
                                                value={matchScores.team1Game1 !== undefined ? matchScores.team1Game1 : ''}
                                                onChange={(e) => handleScoreChange(match.id, 'team1Game1', e.target.value)}
                                              />
                                            </div>
                                            <div>
                                              <label style={{ fontSize: '0.8rem' }}>Team 2</label>
                                              <input
                                                type="number"
                                                min="0"
                                                max="50"
                                                value={matchScores.team2Game1 !== undefined ? matchScores.team2Game1 : ''}
                                                onChange={(e) => handleScoreChange(match.id, 'team2Game1', e.target.value)}
                                              />
                                            </div>
                                          </div>
                                        </div>
                                        <div className="game-group">
                                          <div className="game-label">Game 2</div>
                                          <div className="game-scores">
                                            <div>
                                              <label style={{ fontSize: '0.8rem' }}>Team 1</label>
                                              <input
                                                type="number"
                                                min="0"
                                                max="50"
                                                value={matchScores.team1Game2 !== undefined ? matchScores.team1Game2 : ''}
                                                onChange={(e) => handleScoreChange(match.id, 'team1Game2', e.target.value)}
                                              />
                                            </div>
                                            <div>
                                              <label style={{ fontSize: '0.8rem' }}>Team 2</label>
                                              <input
                                                type="number"
                                                min="0"
                                                max="50"
                                                value={matchScores.team2Game2 !== undefined ? matchScores.team2Game2 : ''}
                                                onChange={(e) => handleScoreChange(match.id, 'team2Game2', e.target.value)}
                                              />
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex gap-1 mt-1">
                                        <button
                                          className="btn btn-success"
                                          onClick={() => submitScores(match.id)}
                                          disabled={
                                            (matchScores.team1Game1 === undefined || matchScores.team1Game1 === '') ||
                                            (matchScores.team2Game1 === undefined || matchScores.team2Game1 === '')
                                          }
                                        >
                                          {match.is_completed ? 'Update Scores' : 'Submit Scores'}
                                        </button>
                                        {(match.is_completed || (hasGame1 && !hasGame2)) && (
                                          <button
                                            className="btn btn-secondary"
                                            onClick={cancelEditing}
                                          >
                                            Cancel
                                          </button>
                                        )}
                                      </div>
                                      {!match.is_completed && !hasGame1 && !isLoggedIn && (
                                        <div style={{ fontSize: '0.8rem', color: '#7f8c8d', marginTop: '0.5rem' }}>
                                          Anyone can enter scores.
                                        </div>
                                      )}
                                      {hasGame1 && !hasGame2 && isLoggedIn && (
                                        <div style={{ fontSize: '0.8rem', color: '#3498db', marginTop: '0.5rem' }}>
                                          As a logged-in user, you can edit all scores.
                                        </div>
                                      )}
                                    </div>
                                  );
                                }

                                // Case 4: No scores entered yet - show input form
                                return (
                                  <div className="mt-1">
                                    <strong>Enter Scores:</strong>
                                    <div className="score-inputs-grouped">
                                      <div className="game-group">
                                        <div className="game-label">Game 1</div>
                                        <div className="game-scores">
                                          <div>
                                            <label style={{ fontSize: '0.8rem' }}>Team 1</label>
                                            <input
                                              type="number"
                                              min="0"
                                              max="50"
                                              value={matchScores.team1Game1 !== undefined ? matchScores.team1Game1 : ''}
                                              onChange={(e) => handleScoreChange(match.id, 'team1Game1', e.target.value)}
                                            />
                                          </div>
                                          <div>
                                            <label style={{ fontSize: '0.8rem' }}>Team 2</label>
                                            <input
                                              type="number"
                                              min="0"
                                              max="50"
                                              value={matchScores.team2Game1 !== undefined ? matchScores.team2Game1 : ''}
                                              onChange={(e) => handleScoreChange(match.id, 'team2Game1', e.target.value)}
                                            />
                                          </div>
                                        </div>
                                      </div>
                                      <div className="game-group">
                                        <div className="game-label">Game 2</div>
                                        <div className="game-scores">
                                          <div>
                                            <label style={{ fontSize: '0.8rem' }}>Team 1</label>
                                            <input
                                              type="number"
                                              min="0"
                                              max="50"
                                              value={matchScores.team1Game2 !== undefined ? matchScores.team1Game2 : ''}
                                              onChange={(e) => handleScoreChange(match.id, 'team1Game2', e.target.value)}
                                            />
                                          </div>
                                          <div>
                                            <label style={{ fontSize: '0.8rem' }}>Team 2</label>
                                            <input
                                              type="number"
                                              min="0"
                                              max="50"
                                              value={matchScores.team2Game2 !== undefined ? matchScores.team2Game2 : ''}
                                              onChange={(e) => handleScoreChange(match.id, 'team2Game2', e.target.value)}
                                            />
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex gap-1 mt-1">
                                      <button
                                        className="btn btn-success"
                                        onClick={() => submitScores(match.id)}
                                        disabled={
                                          (matchScores.team1Game1 === undefined || matchScores.team1Game1 === '') ||
                                          (matchScores.team2Game1 === undefined || matchScores.team2Game1 === '')
                                        }
                                      >
                                        Submit Scores
                                      </button>
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: '#7f8c8d', marginTop: '0.5rem' }}>
                                      Anyone can enter scores - no login required.
                                    </div>
                                  </div>
                                );
                              })()}
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

      {/* Regenerate Teams Modal */}
      {showRegenerateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '8px',
            maxWidth: '500px',
            width: '90%',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <h2>Regenerate Tournament Teams</h2>
            <div style={{
              backgroundColor: '#fff3cd',
              border: '1px solid #ffc107',
              padding: '1rem',
              borderRadius: '4px',
              marginBottom: '1rem'
            }}>
              <strong>Warning:</strong> This will:
              <ul style={{ marginTop: '0.5rem', marginBottom: 0 }}>
                <li>Delete ALL existing teams and matches</li>
                <li>Reset all player scores to 0</li>
                <li>Generate completely new team assignments</li>
                <li>Lose all match results entered so far</li>
              </ul>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Final Round Bye Player (Optional)
              </label>
              <select
                value={finalByePlayerName}
                onChange={(e) => setFinalByePlayerName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '1rem'
                }}
              >
                <option value="">No preference (automatic assignment)</option>
                {players
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map(player => (
                    <option key={player.id} value={player.name}>
                      {player.name} ({player.gender}, {player.skill_level})
                    </option>
                  ))}
              </select>
              <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem' }}>
                Select a player to guarantee they get a bye in the final round
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-secondary"
                onClick={cancelRegenerate}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={confirmRegenerate}
              >
                Regenerate Teams
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TournamentDetail;