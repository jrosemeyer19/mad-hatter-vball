import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import axios from 'axios';

function TournamentSetup({ isEditing = false }) {
  const { id } = useParams(); // For editing existing tournaments
  const [tournamentData, setTournamentData] = useState({
    name: '',
    date: '',
    location: '',
    courtsAvailable: 3,
    minPlayersPerTeam: 5,
    matchesPerPlayer: 4,
    entryFee: 0,
    directorCost: 0,
    hasPowerMatch: false
  });
  
  const [players, setPlayers] = useState([]);
  const [currentPlayer, setCurrentPlayer] = useState({
    name: '',
    gender: 'male',
    skillLevel: 'B',
    isSetter: false
  });
  
  const [step, setStep] = useState(isEditing ? 2 : 1); // Skip to step 2 if editing
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tournamentId, setTournamentId] = useState(isEditing ? id : null);
  
  const navigate = useNavigate();

  useEffect(() => {
    if (isEditing && id) {
      fetchTournamentData();
    }
  }, [isEditing, id]);

  const fetchTournamentData = async () => {
    try {
      const response = await axios.get(`/api/tournaments/${id}`);
      const tournament = response.data.tournament;
      
      if (tournament.status !== 'setup') {
        setError('Can only edit tournaments in setup phase');
        return;
      }
      
      setTournamentData({
        name: tournament.name,
        date: tournament.date.split('T')[0], // Format date for input
        location: tournament.location,
        courtsAvailable: tournament.courts_available,
        minPlayersPerTeam: tournament.min_players_per_team,
        matchesPerPlayer: tournament.matches_per_player,
        entryFee: tournament.entry_fee,
        directorCost: tournament.director_cost,
        hasPowerMatch: tournament.has_power_match
      });
      
      setPlayers(response.data.players);
    } catch (error) {
      setError('Failed to load tournament data');
    }
  };

  const handleTournamentChange = (e) => {
    const { name, value, type, checked } = e.target;
    setTournamentData({
      ...tournamentData,
      [name]: type === 'checkbox' ? checked : type === 'number' ? Number(value) : value
    });
  };

  const handlePlayerChange = (e) => {
    const { name, value, type, checked } = e.target;
    setCurrentPlayer({
      ...currentPlayer,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const createTournament = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isEditing) {
        // Update existing tournament
        await axios.put(`/api/tournaments/${tournamentId}`, tournamentData);
        setStep(2);
      } else {
        // Create new tournament
        const response = await axios.post('/api/tournaments', tournamentData);
        setTournamentId(response.data.id);
        setStep(2);
      }
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to save tournament');
    } finally {
      setLoading(false);
    }
  };

  const addPlayer = async (e) => {
    e.preventDefault();
    setError('');

    if (!currentPlayer.name.trim()) {
      setError('Player name is required');
      return;
    }

    try {
      const response = await axios.post(`/api/tournaments/${tournamentId}/players`, currentPlayer);
      setPlayers([...players, response.data]);
      setCurrentPlayer({
        name: '',
        gender: 'male',
        skillLevel: 'B',
        isSetter: false
      });
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to add player');
    }
  };

  const removePlayer = async (playerId) => {
    try {
      await axios.delete(`/api/tournaments/${tournamentId}/players/${playerId}`);
      setPlayers(players.filter(p => p.id !== playerId));
    } catch (error) {
      setError('Failed to remove player');
    }
  };

  const startTournament = async () => {
    if (players.length < tournamentData.minPlayersPerTeam * 2) {
      setError(`Need at least ${tournamentData.minPlayersPerTeam * 2} players to start tournament`);
      return;
    }

    setLoading(true);
    try {
      await axios.post(`/api/tournaments/${tournamentId}/start`);
      navigate(`/tournament/${tournamentId}`);
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to start tournament');
      setLoading(false);
    }
  };

  const getPlayerCounts = () => {
    const counts = {
      total: players.length,
      male: players.filter(p => p.gender === 'male').length,
      female: players.filter(p => p.gender === 'female').length,
      setters: players.filter(p => p.is_setter).length,
      skillA: players.filter(p => p.skill_level === 'A').length,
      skillBB: players.filter(p => p.skill_level === 'BB').length,
      skillB: players.filter(p => p.skill_level === 'B').length
    };
    return counts;
  };

  if (step === 1) {
    return (
      <div className="card" style={{ maxWidth: '600px', margin: '0 auto' }}>
        <h2>{isEditing ? 'Edit Tournament' : 'Create New Tournament'}</h2>
        
        {error && <div className="error-message">{error}</div>}
        
        <form onSubmit={createTournament}>
          <div className="form-group">
            <label htmlFor="name">Tournament Name:</label>
            <input
              type="text"
              id="name"
              name="name"
              value={tournamentData.name}
              onChange={handleTournamentChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="date">Date:</label>
            <input
              type="date"
              id="date"
              name="date"
              value={tournamentData.date}
              onChange={handleTournamentChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="location">Location:</label>
            <input
              type="text"
              id="location"
              name="location"
              value={tournamentData.location}
              onChange={handleTournamentChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="courtsAvailable">Courts Available:</label>
            <input
              type="number"
              id="courtsAvailable"
              name="courtsAvailable"
              value={tournamentData.courtsAvailable}
              onChange={handleTournamentChange}
              min="1"
              max="10"
            />
          </div>

          <div className="form-group">
            <label htmlFor="minPlayersPerTeam">Minimum Players per Team:</label>
            <input
              type="number"
              id="minPlayersPerTeam"
              name="minPlayersPerTeam"
              value={tournamentData.minPlayersPerTeam}
              onChange={handleTournamentChange}
              min="3"
              max="8"
            />
          </div>

          <div className="form-group">
            <label htmlFor="matchesPerPlayer">Matches per Player:</label>
            <input
              type="number"
              id="matchesPerPlayer"
              name="matchesPerPlayer"
              value={tournamentData.matchesPerPlayer}
              onChange={handleTournamentChange}
              min="1"
              max="10"
            />
          </div>

          <div className="form-group">
            <label htmlFor="entryFee">Entry Fee ($):</label>
            <input
              type="number"
              id="entryFee"
              name="entryFee"
              value={tournamentData.entryFee}
              onChange={handleTournamentChange}
              min="0"
              step="0.01"
            />
          </div>

          <div className="form-group">
            <label htmlFor="directorCost">Director Cost ($):</label>
            <input
              type="number"
              id="directorCost"
              name="directorCost"
              value={tournamentData.directorCost}
              onChange={handleTournamentChange}
              min="0"
              step="0.01"
            />
          </div>

          <div className="form-group">
            <div className="checkbox-group">
              <input
                type="checkbox"
                id="hasPowerMatch"
                name="hasPowerMatch"
                checked={tournamentData.hasPowerMatch}
                onChange={handleTournamentChange}
              />
              <label htmlFor="hasPowerMatch">Add power match?</label>
            </div>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%' }}
            disabled={loading}
          >
            {loading ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Tournament'}
          </button>
        </form>
      </div>
    );
  }

  const counts = getPlayerCounts();

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className="card">
        <h2>{isEditing ? 'Continue Tournament Setup' : 'Add Players to Tournament'}</h2>
        <p><strong>Tournament:</strong> {tournamentData.name}</p>
        
        {error && <div className="error-message">{error}</div>}
        
        <div className="flex" style={{ gap: '2rem', marginBottom: '2rem' }}>
          <div className="card" style={{ flex: 1 }}>
            <h3>Add Player</h3>
            <form onSubmit={addPlayer}>
              <div className="form-group">
                <label htmlFor="playerName">Name:</label>
                <input
                  type="text"
                  id="playerName"
                  name="name"
                  value={currentPlayer.name}
                  onChange={handlePlayerChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="gender">Gender:</label>
                <select
                  id="gender"
                  name="gender"
                  value={currentPlayer.gender}
                  onChange={handlePlayerChange}
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="skillLevel">Skill Level:</label>
                <select
                  id="skillLevel"
                  name="skillLevel"
                  value={currentPlayer.skillLevel}
                  onChange={handlePlayerChange}
                >
                  <option value="A">A (Advanced)</option>
                  <option value="BB">BB (Intermediate+)</option>
                  <option value="B">B (Beginner)</option>
                </select>
              </div>

              <div className="form-group">
                <div className="checkbox-group">
                  <input
                    type="checkbox"
                    id="isSetter"
                    name="isSetter"
                    checked={currentPlayer.isSetter}
                    onChange={handlePlayerChange}
                  />
                  <label htmlFor="isSetter">Is Setter</label>
                </div>
              </div>

              <button type="submit" className="btn btn-success">
                Add Player
              </button>
            </form>
          </div>

          <div className="card" style={{ flex: 1 }}>
            <h3>Player Summary</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.9rem' }}>
              <div><strong>Total Players:</strong> {counts.total}</div>
              <div><strong>Setters:</strong> {counts.setters}</div>
              <div><strong>Males:</strong> {counts.male}</div>
              <div><strong>Females:</strong> {counts.female}</div>
              <div><strong>A Level:</strong> {counts.skillA}</div>
              <div><strong>BB Level:</strong> {counts.skillBB}</div>
              <div><strong>B Level:</strong> {counts.skillB}</div>
              <div><strong>Min Needed:</strong> {tournamentData.minPlayersPerTeam * 2}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Current Players ({players.length})</h3>
        
        {players.length === 0 ? (
          <p>No players added yet.</p>
        ) : (
          <div className="table-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Gender</th>
                  <th>Skill</th>
                  <th>Setter</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {players.map((player) => (
                  <tr key={player.id}>
                    <td>{player.name}</td>
                    <td>{player.gender}</td>
                    <td>{player.skill_level}</td>
                    <td>{player.is_setter ? 'Yes' : 'No'}</td>
                    <td>
                      <button
                        className="btn btn-danger"
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                        onClick={() => removePlayer(player.id)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {players.length >= tournamentData.minPlayersPerTeam * 2 && (
          <div className="mt-2">
            <button
              className="btn btn-primary"
              onClick={startTournament}
              disabled={loading}
              style={{ fontSize: '1.1rem', padding: '1rem 2rem' }}
            >
              {loading ? 'Starting Tournament...' : 'Start Tournament'}
            </button>
            {isEditing && (
              <Link 
                to={`/tournament/${tournamentId}`}
                className="btn btn-secondary"
                style={{ marginLeft: '1rem' }}
              >
                Back to Tournament
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default TournamentSetup;
