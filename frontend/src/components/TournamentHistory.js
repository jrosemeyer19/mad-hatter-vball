import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

function TournamentHistory({ user }) {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all'); // 'all', 'completed', 'in_progress', 'setup'
  const [sortBy, setSortBy] = useState('date_desc'); // 'date_desc', 'date_asc', 'name', 'status'

  useEffect(() => {
    fetchTournamentHistory();
  }, []);

  const fetchTournamentHistory = async () => {
    try {
      const response = await axios.get('/api/tournaments/history');
      setTournaments(response.data);
    } catch (error) {
      setError('Failed to load tournament history');
      console.error('Error fetching tournament history:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteTournament = async (tournamentId, tournamentName) => {
    if (!user?.isSuperAdmin) {
      setError('Only super admins can delete tournaments');
      return;
    }

    const confirmMessage = `Are you sure you want to delete "${tournamentName}"? This will permanently remove all tournament data and cannot be undone.`;
    
    if (!window.confirm(confirmMessage)) {
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

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
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

  const filteredTournaments = tournaments.filter(tournament => {
    if (filter === 'all') return true;
    return tournament.status === filter;
  });

  const sortedTournaments = [...filteredTournaments].sort((a, b) => {
    switch (sortBy) {
      case 'date_desc':
        return new Date(b.date) - new Date(a.date);
      case 'date_asc':
        return new Date(a.date) - new Date(b.date);
      case 'name':
        return a.name.localeCompare(b.name);
      case 'status':
        return a.status.localeCompare(b.status);
      default:
        return 0;
    }
  });

  const getTournamentStats = () => {
    const stats = {
      total: tournaments.length,
      completed: tournaments.filter(t => t.status === 'completed').length,
      inProgress: tournaments.filter(t => t.status === 'in_progress').length,
      setup: tournaments.filter(t => t.status === 'setup').length
    };
    return stats;
  };

  if (loading) {
    return (
      <div className="flex-center" style={{ height: '200px' }}>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  const stats = getTournamentStats();

  return (
    <div>
      <div className="card">
        <h1>Tournament History</h1>
        <p>View and manage all tournaments from the system.{user?.isSuperAdmin && ' Super admins can delete tournaments from this page.'}</p>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {/* Statistics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', margin: '1rem 0' }}>
          <div className="card" style={{ textAlign: 'center', padding: '1rem' }}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#3498db' }}>{stats.total}</div>
            <div>Total Tournaments</div>
          </div>
          <div className="card" style={{ textAlign: 'center', padding: '1rem' }}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#27ae60' }}>{stats.completed}</div>
            <div>Completed</div>
          </div>
          <div className="card" style={{ textAlign: 'center', padding: '1rem' }}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#e67e22' }}>{stats.inProgress}</div>
            <div>In Progress</div>
          </div>
          <div className="card" style={{ textAlign: 'center', padding: '1rem' }}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f39c12' }}>{stats.setup}</div>
            <div>Setup</div>
          </div>
        </div>

        {/* Filters and Sorting */}
        <div className="flex-between mb-2" style={{ flexWrap: 'wrap', gap: '1rem' }}>
          <div className="flex gap-1" style={{ alignItems: 'center' }}>
            <label htmlFor="filter"><strong>Filter:</strong></label>
            <select
              id="filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
            >
              <option value="all">All Tournaments</option>
              <option value="completed">Completed</option>
              <option value="in_progress">In Progress</option>
              <option value="setup">Setup</option>
            </select>
          </div>

          <div className="flex gap-1" style={{ alignItems: 'center' }}>
            <label htmlFor="sort"><strong>Sort by:</strong></label>
            <select
              id="sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
            >
              <option value="date_desc">Date (Newest First)</option>
              <option value="date_asc">Date (Oldest First)</option>
              <option value="name">Name (A-Z)</option>
              <option value="status">Status</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tournament List */}
      {sortedTournaments.length === 0 ? (
        <div className="card text-center">
          <h3>No Tournaments Found</h3>
          <p>
            {filter === 'all' 
              ? 'No tournaments have been created yet.' 
              : `No tournaments found with status "${getStatusText(filter)}".`
            }
          </p>
          <Link to="/create-tournament" className="btn btn-primary">
            Create Tournament
          </Link>
        </div>
      ) : (
        <div className="card">
          <h2>
            {filter === 'all' ? 'All Tournaments' : `${getStatusText(filter)} Tournaments`} 
            ({sortedTournaments.length})
          </h2>
          
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Tournament Name</th>
                  <th>Date</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Created By</th>
                  <th>Created On</th>
                  <th>Entry Fee</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedTournaments.map((tournament) => (
                  <tr key={tournament.id}>
                    <td>
                      <Link 
                        to={`/tournament/${tournament.id}`}
                        style={{ textDecoration: 'none', fontWeight: 'bold' }}
                      >
                        {tournament.name}
                      </Link>
                    </td>
                    <td>{formatDate(tournament.date)}</td>
                    <td>{tournament.location}</td>
                    <td>
                      <span className={`tournament-status ${getStatusClass(tournament.status)}`}>
                        {getStatusText(tournament.status)}
                      </span>
                    </td>
                    <td>{tournament.created_by_username || 'Unknown'}</td>
                    <td>{formatDateTime(tournament.created_at)}</td>
                    <td>${tournament.entry_fee}</td>
                    <td>
                      <div className="flex gap-1">
                        <Link 
                          to={`/tournament/${tournament.id}`}
                          className="btn btn-primary"
                          style={{ padding: '0.25rem 0.75rem', fontSize: '0.9rem' }}
                        >
                          View
                        </Link>
                        {user?.isSuperAdmin && (
                          <button
                            className="btn btn-danger"
                            style={{ padding: '0.25rem 0.75rem', fontSize: '0.9rem' }}
                            onClick={() => deleteTournament(tournament.id, tournament.name)}
                            title={`Delete ${tournament.name} (Super Admin Only)`}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Additional Information */}
      <div className="card">
        <h2>Tournament Management</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
          <div>
            <h4>Tournament Statuses</h4>
            <ul style={{ marginLeft: '1rem' }}>
              <li><strong>Setup:</strong> Tournament created, players being added</li>
              <li><strong>In Progress:</strong> Teams generated, matches being played</li>
              <li><strong>Completed:</strong> All matches finished, results finalized</li>
            </ul>
          </div>
          <div>
            <h4>Available Actions</h4>
            <ul style={{ marginLeft: '1rem' }}>
              <li>View tournament details and progress</li>
              <li>Enter scores for ongoing matches</li>
              <li>Generate new rounds when ready</li>
              <li>Complete tournaments and view final standings</li>
              <li>Review historical tournament data</li>
              {user?.isSuperAdmin && <li><strong>Delete tournaments (Super Admin only)</strong></li>}
            </ul>
          </div>
          <div>
            <h4>Data Retention</h4>
            <ul style={{ marginLeft: '1rem' }}>
              <li>All tournament data is permanently stored</li>
              <li>Player statistics are maintained across tournaments</li>
              <li>Complete match history is available</li>
              <li>Payout information is recorded for completed tournaments</li>
              {user?.isSuperAdmin && <li><strong>Super Admins can delete any tournament</strong></li>}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TournamentHistory;
