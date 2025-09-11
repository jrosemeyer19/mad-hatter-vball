import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

function TournamentList({ user }) {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchTournaments();
  }, []);

  const fetchTournaments = async () => {
    try {
      const response = await axios.get('/api/tournaments');
      setTournaments(response.data);
    } catch (error) {
      setError('Failed to load tournaments');
      console.error('Error fetching tournaments:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteTournament = async (tournamentId, tournamentName, e) => {
    e.preventDefault(); // Prevent navigation to tournament detail
    e.stopPropagation();

    if (!user) {
      alert('You must be logged in to delete tournaments');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete "${tournamentName}"? This cannot be undone.`)) {
      return;
    }

    try {
      await axios.delete(`/api/tournaments/${tournamentId}`);
      setTournaments(tournaments.filter(t => t.id !== tournamentId));
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to delete tournament');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'setup': return 'status-setup';
      case 'in_progress': return 'status-in_progress';
      case 'completed': return 'status-completed';
      default: return '';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'setup': return 'Setup';
      case 'in_progress': return 'In Progress';
      case 'completed': return 'Completed';
      default: return status;
    }
  };

  if (loading) {
    return (
      <div className="flex-center" style={{ height: '200px' }}>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex-between mb-2">
        <h1>Active Tournaments</h1>
        <Link to="/create-tournament" className="btn btn-primary">
          Create Tournament
        </Link>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {tournaments.length === 0 ? (
        <div className="card text-center">
          <h3>No Active Tournaments</h3>
          <p>There are currently no tournaments in progress or setup.</p>
          <Link to="/create-tournament" className="btn btn-primary">
            Create the First Tournament
          </Link>
        </div>
      ) : (
        <div className="tournament-grid">
          {tournaments.map((tournament) => (
            <div key={tournament.id} className="tournament-card" style={{ position: 'relative' }}>
              <Link
                to={`/tournament/${tournament.id}`}
                style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
              >
                <div className="flex-between mb-1">
                  <h3>{tournament.name}</h3>
                  <span className={`tournament-status ${getStatusClass(tournament.status)}`}>
                    {getStatusText(tournament.status)}
                  </span>
                </div>
                
                <div style={{ marginBottom: '0.5rem' }}>
                  <strong>Date:</strong> {formatDate(tournament.date)}
                </div>
                
                <div style={{ marginBottom: '0.5rem' }}>
                  <strong>Location:</strong> {tournament.location}
                </div>
                
                <div style={{ fontSize: '0.9rem', color: '#7f8c8d' }}>
                  Click to view details and manage tournament
                </div>
              </Link>
              
              {user && (
                <div style={{ 
                  position: 'absolute', 
                  top: '0.5rem', 
                  right: '0.5rem',
                  display: 'flex',
                  gap: '0.25rem'
                }}>
                  {tournament.status === 'setup' && (
                    <Link
                      to={`/tournament/${tournament.id}/setup`}
                      className="btn btn-success"
                      style={{ 
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.8rem',
                        textDecoration: 'none'
                      }}
                      onClick={(e) => e.stopPropagation()}
                      title="Continue Setup"
                    >
                      Setup
                    </Link>
                  )}
                  {tournament.status !== 'completed' && (
                    <button
                      className="btn btn-danger"
                      style={{ 
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.8rem'
                      }}
                      onClick={(e) => deleteTournament(tournament.id, tournament.name, e)}
                      title="Delete Tournament"
                    >
                      ×
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default TournamentList;
