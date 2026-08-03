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
    allowSevenPlayerTeams: false,
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
  const [editingPlayerId, setEditingPlayerId] = useState(null);
  const [editedPlayer, setEditedPlayer] = useState({});
  const [sortBy, setSortBy] = useState('name'); // 'name', 'gender', 'skill', 'setter'
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc', 'desc'

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
        allowSevenPlayerTeams: tournament.allow_seven_player_teams === true,
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
    const player = players.find(p => p.id === playerId);
    const confirmMessage = `Are you sure you want to remove ${player?.name || 'this player'}?`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      await axios.delete(`/api/tournaments/${tournamentId}/players/${playerId}`);
      setPlayers(players.filter(p => p.id !== playerId));
    } catch (error) {
      setError('Failed to remove player');
    }
  };

  const startEditingPlayer = (player) => {
    setEditingPlayerId(player.id);
    setEditedPlayer({
      name: player.name,
      gender: player.gender,
      skillLevel: player.skill_level,
      isSetter: player.is_setter
    });
  };

  const cancelEditingPlayer = () => {
    setEditingPlayerId(null);
    setEditedPlayer({});
  };

  const savePlayerEdit = async (playerId) => {
    try {
      await axios.put(`/api/tournaments/${tournamentId}/players/${playerId}`, editedPlayer);

      // Update local state
      setPlayers(players.map(p =>
        p.id === playerId
          ? { ...p, name: editedPlayer.name, gender: editedPlayer.gender, skill_level: editedPlayer.skillLevel, is_setter: editedPlayer.isSetter }
          : p
      ));

      setEditingPlayerId(null);
      setEditedPlayer({});
      setError('');
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to update player');
    }
  };

  const handleEditPlayerChange = (field, value) => {
    setEditedPlayer({ ...editedPlayer, [field]: value });
  };

  const handleSort = (column) => {
    if (sortBy === column) {
      // Toggle direction if clicking the same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new column and default to ascending
      setSortBy(column);
      setSortDirection('asc');
    }
  };

  const getSortedPlayers = () => {
    const sorted = [...players].sort((a, b) => {
      let compareA, compareB;

      switch (sortBy) {
        case 'name':
          compareA = a.name.toLowerCase();
          compareB = b.name.toLowerCase();
          break;
        case 'gender':
          compareA = a.gender.toLowerCase();
          compareB = b.gender.toLowerCase();
          break;
        case 'skill':
          const skillOrder = { 'AA': 4, 'A': 3, 'BB': 2, 'B': 1 };
          compareA = skillOrder[a.skill_level] || 0;
          compareB = skillOrder[b.skill_level] || 0;
          break;
        case 'setter':
          compareA = a.is_setter ? 1 : 0;
          compareB = b.is_setter ? 1 : 0;
          break;
        default:
          return 0;
      }

      if (compareA < compareB) return sortDirection === 'asc' ? -1 : 1;
      if (compareA > compareB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  };

  const exportPlayers = () => {
    if (players.length === 0) {
      setError('No players to export');
      return;
    }

    // Create CSV content
    const headers = 'name,gender,skill_level,is_setter\n';
    const rows = players.map(player =>
      `${player.name},${player.gender},${player.skill_level},${player.is_setter}`
    ).join('\n');
    const csvContent = headers + rows;

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${tournamentData.name || 'tournament'}_players.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const importPlayers = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target.result;
        const lines = text.trim().split('\n');

        // Validate header
        const header = lines[0].toLowerCase().trim();
        if (header !== 'name,gender,skill_level,is_setter') {
          setError('Invalid CSV format. Expected headers: name,gender,skill_level,is_setter');
          return;
        }

        // Parse players
        const playersToImport = [];
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue; // Skip empty lines

          const [name, gender, skillLevel, isSetter] = line.split(',').map(s => s.trim());

          // Validate data
          if (!name || !gender || !skillLevel) {
            setError(`Invalid data on line ${i + 1}: missing required fields`);
            return;
          }

          if (!['male', 'female', 'm', 'f'].includes(gender.toLowerCase())) {
            setError(`Invalid gender on line ${i + 1}: ${gender}. Must be 'male' or 'female'`);
            return;
          }

          if (!['AA', 'A', 'BB', 'B'].includes(skillLevel.toUpperCase())) {
            setError(`Invalid skill level on line ${i + 1}: ${skillLevel}. Must be AA, A, BB, or B`);
            return;
          }

          if (!['true', 'false'].includes(isSetter?.toLowerCase())) {
            setError(`Invalid is_setter value on line ${i + 1}: ${isSetter}. Must be 'true' or 'false'`);
            return;
          }

          playersToImport.push({
            name: name,
            gender: gender.toLowerCase(),
            skillLevel: skillLevel.toUpperCase(),
            isSetter: isSetter.toLowerCase() === 'true'
          });
        }

        if (playersToImport.length === 0) {
          setError('No players found in CSV file');
          return;
        }

        // Add all players
        setLoading(true);
        for (const player of playersToImport) {
          await axios.post(`/api/tournaments/${tournamentId}/players`, player);
        }

        // Refresh player list
        const response = await axios.get(`/api/tournaments/${tournamentId}`);
        setPlayers(response.data.players || []);
        setError('');
        alert(`Successfully imported ${playersToImport.length} players`);
      } catch (error) {
        setError(error.response?.data?.message || 'Failed to import players');
      } finally {
        setLoading(false);
        // Reset file input
        event.target.value = '';
      }
    };

    reader.readAsText(file);
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
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="allowSevenPlayerTeams"
                checked={tournamentData.allowSevenPlayerTeams}
                onChange={handleTournamentChange}
              />
              Allow 7-player teams
            </label>
            <p className="field-hint">
              Off by default. When a player count does not divide evenly, the schedule
              adds a round and gives everyone a bye instead. Turning this on lets one or
              more teams carry a 7th player who rotates on and off the court, which can
              save a whole round — for example 37 players finish in 4 rounds with nobody
              sitting out, instead of 5 rounds with one bye each.
            </p>
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

        {/* Import Players from CSV Section */}
        <div className="card" style={{ backgroundColor: '#f0fff0', border: '2px solid #27ae60' }}>
          <h3>Import Players from CSV</h3>
          <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1rem' }}>
            Upload a CSV file with player data. Format: name,gender,skill_level,is_setter
          </p>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="file"
              accept=".csv"
              onChange={importPlayers}
              style={{ display: 'none' }}
              id="csvFileInput"
            />
            <label htmlFor="csvFileInput">
              <button
                type="button"
                className="btn btn-success"
                onClick={() => document.getElementById('csvFileInput').click()}
                disabled={loading || !tournamentId}
                style={{ height: 'fit-content' }}
              >
                Choose CSV File
              </button>
            </label>

            {players.length > 0 && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={exportPlayers}
                style={{ height: 'fit-content' }}
              >
                Export Current Players
              </button>
            )}
          </div>

          <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.5rem' }}>
            Example: Jeff Rosemeyer,male,AA,false
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>Current Players ({players.length})</h3>
          {players.length > 0 && (
            <button
              className="btn btn-secondary"
              onClick={exportPlayers}
              style={{ padding: '0.5rem 1rem' }}
            >
              Export Players
            </button>
          )}
        </div>

        {players.length === 0 ? (
          <p>No players added yet.</p>
        ) : (
          <div className="table-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th
                    onClick={() => handleSort('name')}
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                  >
                    Name {sortBy === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    onClick={() => handleSort('gender')}
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                  >
                    Gender {sortBy === 'gender' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    onClick={() => handleSort('skill')}
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                  >
                    Skill {sortBy === 'skill' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    onClick={() => handleSort('setter')}
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                  >
                    Setter {sortBy === 'setter' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {getSortedPlayers().map((player) => (
                  <tr key={player.id}>
                    {editingPlayerId === player.id ? (
                      // Edit mode
                      <>
                        <td>
                          <input
                            type="text"
                            value={editedPlayer.name}
                            onChange={(e) => handleEditPlayerChange('name', e.target.value)}
                            style={{ width: '100%', padding: '0.25rem' }}
                          />
                        </td>
                        <td>
                          <select
                            value={editedPlayer.gender}
                            onChange={(e) => handleEditPlayerChange('gender', e.target.value)}
                            style={{ width: '100%', padding: '0.25rem' }}
                          >
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                          </select>
                        </td>
                        <td>
                          <select
                            value={editedPlayer.skillLevel}
                            onChange={(e) => handleEditPlayerChange('skillLevel', e.target.value)}
                            style={{ width: '100%', padding: '0.25rem' }}
                          >
                            <option value="AA">AA</option>
                            <option value="A">A</option>
                            <option value="BB">BB</option>
                            <option value="B">B</option>
                          </select>
                        </td>
                        <td>
                          <select
                            value={editedPlayer.isSetter}
                            onChange={(e) => handleEditPlayerChange('isSetter', e.target.value === 'true')}
                            style={{ width: '100%', padding: '0.25rem' }}
                          >
                            <option value="true">Yes</option>
                            <option value="false">No</option>
                          </select>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.25rem' }}>
                            <button
                              className="btn btn-success"
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                              onClick={() => savePlayerEdit(player.id)}
                            >
                              Save
                            </button>
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                              onClick={cancelEditingPlayer}
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      // Display mode
                      <>
                        <td>{player.name}</td>
                        <td>{player.gender}</td>
                        <td>{player.skill_level}</td>
                        <td>{player.is_setter ? 'Yes' : 'No'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.25rem' }}>
                            <button
                              className="btn btn-primary"
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                              onClick={() => startEditingPlayer(player)}
                            >
                              Edit
                            </button>
                            <button
                              className="btn btn-danger"
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                              onClick={() => removePlayer(player.id)}
                            >
                              Remove
                            </button>
                          </div>
                        </td>
                      </>
                    )}
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
