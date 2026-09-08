import React, { useState, useEffect } from 'react';
import axios from 'axios';
import PasswordRequirements from './PasswordRequirements';
import { evaluatePassword, RULES_TEXT, MIN_LENGTH } from '../utils/passwordPolicy';

function UserManagement({ user: currentUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    isSuperAdmin: false
  });
  // The user whose password is being reset, plus the value being typed
  const [resetTarget, setResetTarget] = useState(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await axios.get('/api/users');
      setUsers(response.data);
    } catch (error) {
      setError('Failed to load users');
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!evaluatePassword(newUser.password, { username: newUser.username }).valid) {
      setError(`Password does not meet the requirements. ${RULES_TEXT}`);
      return;
    }

    try {
      await axios.post('/api/users', newUser);
      setSuccess(`User ${newUser.username} created successfully`);
      setNewUser({ username: '', password: '', isSuperAdmin: false });
      setShowCreateForm(false);
      fetchUsers();
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to create user');
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!evaluatePassword(resetPassword, { username: resetTarget.username }).valid) {
      setError(`Password does not meet the requirements. ${RULES_TEXT}`);
      return;
    }

    setResetting(true);

    try {
      const response = await axios.put(`/api/users/${resetTarget.id}/password`, {
        newPassword: resetPassword
      });
      setSuccess(
        `${response.data.message}. Give it to them directly and have them change it.`
      );
      setResetTarget(null);
      setResetPassword('');
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to reset password');
    } finally {
      setResetting(false);
    }
  };

  const startReset = (user) => {
    setError('');
    setSuccess('');
    setResetPassword('');
    setResetTarget(user);
  };

  const handleDeleteUser = async (userId, username) => {
    if (!window.confirm(`Are you sure you want to delete user "${username}"? This cannot be undone.`)) {
      return;
    }

    try {
      await axios.delete(`/api/users/${userId}`);
      setSuccess(`User ${username} deleted successfully`);
      fetchUsers();
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to delete user');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
      <div className="card">
        <div className="flex-between mb-2">
          <h1>User Management</h1>
          <button
            className="btn btn-primary"
            onClick={() => setShowCreateForm(!showCreateForm)}
          >
            {showCreateForm ? 'Cancel' : 'Create New User'}
          </button>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {success && (
          <div className="success-message">
            {success}
          </div>
        )}

        {showCreateForm && (
          <div className="card" style={{ marginBottom: '2rem', backgroundColor: '#f8f9fa' }}>
            <h3>Create New User</h3>
            <form onSubmit={handleCreateUser}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div className="form-group">
                  <label htmlFor="username">Username:</label>
                  <input
                    type="text"
                    id="username"
                    value={newUser.username}
                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="password">Password:</label>
                  <input
                    type="password"
                    id="password"
                    autoComplete="new-password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    required
                    minLength={MIN_LENGTH}
                  />
                  <PasswordRequirements
                    password={newUser.password}
                    username={newUser.username}
                  />
                </div>

                <div className="form-group">
                  <div className="checkbox-group" style={{ marginTop: '2rem' }}>
                    <input
                      type="checkbox"
                      id="isSuperAdmin"
                      checked={newUser.isSuperAdmin}
                      onChange={(e) => setNewUser({ ...newUser, isSuperAdmin: e.target.checked })}
                    />
                    <label htmlFor="isSuperAdmin">Super Admin</label>
                  </div>
                </div>
              </div>

              <div className="flex gap-1 mt-1">
                <button type="submit" className="btn btn-success">
                  Create User
                </button>
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => setShowCreateForm(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {resetTarget && (
          <div className="card" style={{ marginBottom: '2rem', backgroundColor: '#f8f9fa' }}>
            <h3>Reset password for {resetTarget.username}</h3>
            <p className="field-hint">
              There is no email on these accounts, so this is the only way back in
              for someone who has forgotten their password. It signs them out of
              every device they are currently logged in on.
            </p>
            <form onSubmit={handleResetPassword}>
              <div className="form-group">
                <label htmlFor="resetPassword">New password:</label>
                <input
                  type="text"
                  id="resetPassword"
                  autoComplete="off"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  required
                  disabled={resetting}
                />
                {/* Shown in plain text on purpose: whoever resets it has to be
                    able to read it back to the user. */}
                <PasswordRequirements
                  password={resetPassword}
                  username={resetTarget.username}
                />
              </div>

              <div className="flex gap-1 mt-1">
                <button type="submit" className="btn btn-success" disabled={resetting}>
                  {resetting ? 'Resetting...' : 'Reset Password'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setResetTarget(null)}
                  disabled={resetting}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <h2>Existing Users ({users.length})</h2>
        
        {users.length === 0 ? (
          <p>No users found.</p>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <strong>{user.username}</strong>
                    </td>
                    <td>
                      <span className={`tournament-status ${user.is_super_admin ? 'status-in_progress' : 'status-setup'}`}>
                        {user.is_super_admin ? 'Super Admin' : 'Regular User'}
                      </span>
                    </td>
                    <td>
                      {formatDate(user.created_at)}
                    </td>
                    <td>
                      <div className="flex gap-1">
                        {/* Own password goes through the change form, which
                            asks for the current one first */}
                        {user.id !== currentUser?.id && (
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '0.25rem 0.75rem', fontSize: '0.9rem' }}
                            onClick={() => startReset(user)}
                          >
                            Reset Password
                          </button>
                        )}
                        <button
                          className="btn btn-danger"
                          style={{ padding: '0.25rem 0.75rem', fontSize: '0.9rem' }}
                          onClick={() => handleDeleteUser(user.id, user.username)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h2>User Management Guide</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
          <div>
            <h4>Super Admin Users</h4>
            <ul style={{ marginLeft: '1rem' }}>
              <li>Can create and delete users</li>
              <li>Can create tournaments</li>
              <li>Can manage all tournament functions</li>
              <li>Can view tournament history</li>
            </ul>
          </div>
          <div>
            <h4>Regular Users</h4>
            <ul style={{ marginLeft: '1rem' }}>
              <li>Can create tournaments</li>
              <li>Can manage tournament functions</li>
              <li>Can view tournament history</li>
              <li>Cannot create or delete users</li>
            </ul>
          </div>
          <div>
            <h4>Security Notes</h4>
            <ul style={{ marginLeft: '1rem' }}>
              <li>{RULES_TEXT}</li>
              <li>Users change their own password from the account name in the header</li>
              <li>Changing or resetting a password signs that user out everywhere</li>
              <li>User sessions expire after 24 hours</li>
              <li>Cannot delete your own account</li>
              <li>Regular users cannot self-register</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UserManagement;
