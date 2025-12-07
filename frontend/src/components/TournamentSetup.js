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
    directorCost: 0
  });
  
  const [players, setPlayers] = useState([]);
  const [currentPlayer, setCurrentPlayer] = useState({
    name: '',
    gender: 'male',
    skillLevel: 'B',
    isSetter: false
  });
  
  // New state for generate players feature
  const [generateCount, setGenerateCount] = useState(20);
  const [isGenerating, setIsGenerating] = useState(false);

  const [step, setStep] = useState(isEditing ? 2 : 1); // Skip to step 2 if editing
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tournamentId, setTournamentId] = useState(isEditing ? id : null);
  const [showStartModal, setShowStartModal] = useState(false);
  const [finalByePlayerName, setFinalByePlayerName] = useState('');

  const navigate = useNavigate();

  // Arrays for generating random player data
  const maleNames = [
    'James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph',
    'Thomas', 'Christopher', 'Charles', 'Daniel', 'Matthew', 'Anthony', 'Mark',
    'Donald', 'Steven', 'Paul', 'Andrew', 'Joshua', 'Kenneth', 'Kevin', 'Brian',
    'George', 'Timothy', 'Ronald', 'Jason', 'Edward', 'Jeffrey', 'Ryan', 'Jacob',
    'Gary', 'Nicholas', 'Eric', 'Jonathan', 'Stephen', 'Larry', 'Justin', 'Scott',
    'Brandon', 'Benjamin', 'Samuel', 'Gregory', 'Frank', 'Raymond', 'Alexander',
    'Patrick', 'Jack', 'Dennis', 'Jerry', 'Tyler', 'Aaron', 'Jose', 'Henry'
  ];

  const femaleNames = [
    'Mary', 'Patricia', 'Jennifer', 'Linda', 'Elizabeth', 'Barbara', 'Susan',
    'Jessica', 'Sarah', 'Karen', 'Nancy', 'Lisa', 'Betty', 'Helen', 'Sandra',
    'Donna', 'Carol', 'Ruth', 'Sharon', 'Michelle', 'Laura', 'Sarah', 'Kimberly',
    'Deborah', 'Dorothy', 'Lisa', 'Nancy', 'Karen', 'Betty', 'Helen', 'Sandra',
    'Donna', 'Carol', 'Ruth', 'Sharon', 'Michelle', 'Laura', 'Sarah', 'Kimberly',
    'Amy', 'Angela', 'Ashley', 'Brenda', 'Emma', 'Olivia', 'Cynthia', 'Marie',
    'Janet', 'Catherine', 'Frances', 'Christine', 'Samantha', 'Debra', 'Rachel'
  ];

  const lastNames = [
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
    'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
    'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson',
    'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker',
    'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill',
    'Flores', 'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell'
  ];

  const skillLevels = ['A', 'BB', 'B'];
  const genders = ['male', 'female'];

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
        directorCost: tournament.director_cost
      });
      
      setPlayers(response.data.players);
    } catch (error) {
      setError('Failed to load tournament data');
    }
  };

  const getRandomElement = (array) => {
    return array[Math.floor(Math.random() * array.length)];
  };

  const generateRandomPlayer = () => {
    const gender = getRandomElement(genders);
    const firstName = gender === 'male' ? getRandomElement(maleNames) : getRandomElement(femaleNames);
    const lastName = getRandomElement(lastNames);
    const name = `${firstName} ${lastName}`;
    const skillLevel = getRandomElement(skillLevels);
    // About 15% chance of being a setter
    const isSetter = Math.random() < 0.15;

    return {
      name,
      gender,
      skillLevel,
      isSetter
    };
  };

  const generatePlayers = async () => {
    if (generateCount < 1 || generateCount > 100) {
      setError('Please enter a number between 1 and 100');
      return;
    }

    setIsGenerating(true);
    setError('');

    try {
      const newPlayers = [];
      const existingNames = new Set(players.map(p => p.name.toLowerCase()));

      for (let i = 0; i < generateCount; i++) {
        let attempts = 0;
        let player;
        
        // Try to generate a unique name (up to 50 attempts)
        do {
          player = generateRandomPlayer();
          attempts++;
        } while (existingNames.has(player.name.toLowerCase()) && attempts < 50);

        // If we couldn't find a unique name after 50 attempts, add a number suffix
        if (existingNames.has(player.name.toLowerCase())) {
          let suffix = 1;
          const baseName = player.name;
          while (existingNames.has(`${baseName} ${suffix}`.toLowerCase())) {
            suffix++;
          }
          player.name = `${baseName} ${suffix}`;
        }

        existingNames.add(player.name.toLowerCase());

        // Add player to tournament via API
        const response = await axios.post(`/api/tournaments/${tournamentId}/players`, player);
        newPlayers.push(response.data);
      }

      setPlayers([...players, ...newPlayers]);
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to generate players');
    } finally {
      setIsGenerating(false);
    }
  };

  const clearAllPlayers = async () => {
    if (!window.confirm('Are you sure you want to remove all players? This cannot be undone.')) {
      return;
    }

    setError('');
    
    try {
      // Remove all players one by one
      for (const player of players) {
        await axios.delete(`/api/tournaments/${tournamentId}/players/${player.id}`);
      }
      setPlayers([]);
    } catch (error) {
      setError('Failed to remove all players');
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

  const initiateStart = () => {
    if (players.length < tournamentData.minPlayersPerTeam * 2) {
      setError(`Need at least ${tournamentData.minPlayersPerTeam * 2} players to start tournament`);
      return;
    }
    setShowStartModal(true);
  };

  const confirmStart = async () => {
    setLoading(true);
    setShowStartModal(false);
    try {
      await axios.post(`/api/tournaments/${tournamentId}/start`, {
        finalByePlayerName: finalByePlayerName || null
      });
      setFinalByePlayerName(''); // Reset selection
      navigate(`/tournament/${tournamentId}`);
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to start tournament');
      setLoading(false);
    }
  };

  const cancelStart = () => {
    setShowStartModal(false);
    setFinalByePlayerName('');
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
                  <option value="AA">AA (Elite/Competitive)</option>
                  <option value="A">A (Strong)</option>
                  <option value="BB">BB (Intermediate)</option>
                  <option value="B">B (Developing)</option>
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

        {/* New Generate Players Section */}
        <div className="card" style={{ backgroundColor: '#f0f8ff', border: '2px solid #3498db' }}>
          <h3>Generate Random Players</h3>
          <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1rem' }}>
            Quickly populate your tournament with randomly generated players for testing or demonstrations.
          </p>
          
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'end', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ minWidth: '150px' }}>
              <label htmlFor="generateCount">Number of Players:</label>
              <input
                type="number"
                id="generateCount"
                value={generateCount}
                onChange={(e) => setGenerateCount(parseInt(e.target.value) || 0)}
                min="1"
                max="100"
                style={{ width: '100%' }}
              />
            </div>
            
            <button
              type="button"
              className="btn btn-primary"
              onClick={generatePlayers}
              disabled={isGenerating || !tournamentId}
              style={{ height: 'fit-content' }}
            >
              {isGenerating ? 'Generating...' : 'Generate Players'}
            </button>
            
            {players.length > 0 && (
              <button
                type="button"
                className="btn btn-danger"
                onClick={clearAllPlayers}
                style={{ height: 'fit-content' }}
              >
                Clear All Players
              </button>
            )}
          </div>
          
          <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.5rem' }}>
            Random attributes: ~50% male/female, ~15% setters, balanced skill levels (A/BB/B)
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
              onClick={initiateStart}
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

      {/* Start Tournament Modal */}
      {showStartModal && (
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
            <h2>Start Tournament</h2>
            <p style={{ marginBottom: '1.5rem' }}>
              Ready to generate teams and start the tournament?
            </p>

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
                onClick={cancelStart}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={confirmStart}
              >
                Start Tournament
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TournamentSetup;
