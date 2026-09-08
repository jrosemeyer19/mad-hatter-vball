import React, { useState } from 'react';
import axios from 'axios';
import PasswordRequirements from './PasswordRequirements';
import { evaluatePassword } from '../utils/passwordPolicy';

function ChangePassword({ user, onTokenRefresh }) {
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const { valid: meetsPolicy } = evaluatePassword(formData.newPassword, {
    username: user?.username
  });
  const passwordsMatch =
    formData.confirmPassword.length > 0 &&
    formData.newPassword === formData.confirmPassword;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (formData.newPassword !== formData.confirmPassword) {
      setError('New password and confirmation do not match');
      return;
    }

    if (!meetsPolicy) {
      setError('New password does not meet the requirements below');
      return;
    }

    if (formData.newPassword === formData.currentPassword) {
      setError('New password must be different from the current one');
      return;
    }

    setSaving(true);

    try {
      const response = await axios.post('/api/auth/change-password', {
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword
      });

      // The server retires every token issued before the change, so adopt the
      // replacement it sent or this tab would be logged out on its next call.
      if (response.data.token && onTokenRefresh) {
        onTokenRefresh(response.data.token);
      }

      setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setSuccess(
        'Password updated. Any other device you were signed in on will need to log in again.'
      );
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: '480px', margin: '2rem auto' }}>
      <h1>Change Password</h1>
      <p className="field-hint" style={{ marginBottom: '1.5rem' }}>
        Signed in as <strong>{user?.username}</strong>
      </p>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="currentPassword">Current password:</label>
          <input
            type={showPasswords ? 'text' : 'password'}
            id="currentPassword"
            name="currentPassword"
            autoComplete="current-password"
            value={formData.currentPassword}
            onChange={handleChange}
            required
            disabled={saving}
          />
        </div>

        <div className="form-group">
          <label htmlFor="newPassword">New password:</label>
          <input
            type={showPasswords ? 'text' : 'password'}
            id="newPassword"
            name="newPassword"
            autoComplete="new-password"
            value={formData.newPassword}
            onChange={handleChange}
            required
            disabled={saving}
          />
          <PasswordRequirements
            password={formData.newPassword}
            username={user?.username}
          />
        </div>

        <div className="form-group">
          <label htmlFor="confirmPassword">Confirm new password:</label>
          <input
            type={showPasswords ? 'text' : 'password'}
            id="confirmPassword"
            name="confirmPassword"
            autoComplete="new-password"
            value={formData.confirmPassword}
            onChange={handleChange}
            required
            disabled={saving}
          />
          {formData.confirmPassword.length > 0 && !passwordsMatch && (
            <div className="field-hint" style={{ color: 'var(--c-danger)' }}>
              Passwords do not match
            </div>
          )}
        </div>

        {/* Typing a 9-plus character password with symbols on a phone keyboard
            is error prone, and these forms are often filled in courtside. */}
        <label className="checkbox-label" style={{ marginBottom: '1rem' }}>
          <input
            type="checkbox"
            checked={showPasswords}
            onChange={(e) => setShowPasswords(e.target.checked)}
          />
          Show passwords
        </label>

        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: '100%' }}
          disabled={saving || !meetsPolicy || !passwordsMatch}
        >
          {saving ? 'Updating...' : 'Update Password'}
        </button>
      </form>
    </div>
  );
}

export default ChangePassword;
