const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../database/db');
const { authenticateToken, requireSuperAdmin } = require('../middleware/auth');
const { validatePassword } = require('../utils/passwordPolicy');

const router = express.Router();

const BCRYPT_ROUNDS = 10;

// Get all users (super admin only)
router.get('/', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, username, is_super_admin, created_at 
      FROM users 
      ORDER BY created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new user (super admin only)
router.post('/', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { username, password, isSuperAdmin = false } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password required' });
    }
    
    const problems = validatePassword(password, { username });
    if (problems.length > 0) {
      return res.status(400).json({ message: problems[0], errors: problems });
    }
    
    // Check if username already exists
    const existingUser = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ message: 'Username already exists' });
    }
    
    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
    
    const result = await pool.query(`
      INSERT INTO users (username, password_hash, is_super_admin) 
      VALUES ($1, $2, $3) 
      RETURNING id, username, is_super_admin, created_at
    `, [username, hashedPassword, isSuperAdmin]);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Reset another user's password (super admin only).
// There is no email on an account and so no self-service reset; without this a
// forgotten password would mean deleting and recreating the user, which orphans
// the tournaments they created.
router.put('/:id/password', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (parseInt(id) === req.user.id) {
      return res.status(400).json({
        message: 'Use the Change Password page to change your own password'
      });
    }

    const target = await pool.query('SELECT id, username FROM users WHERE id = $1', [id]);
    if (target.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const problems = validatePassword(newPassword, { username: target.rows[0].username });
    if (problems.length > 0) {
      return res.status(400).json({ message: problems[0], errors: problems });
    }

    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    // Stamping password_changed_at also signs the user out everywhere, which is
    // the point when the reset is because their account may be compromised.
    await pool.query(
      'UPDATE users SET password_hash = $1, password_changed_at = $2 WHERE id = $3',
      [hashedPassword, new Date(), id]
    );

    res.json({ message: `Password reset for ${target.rows[0].username}` });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete user (super admin only)
router.delete('/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Prevent deleting self
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }
    
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING username', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({ message: `User ${result.rows[0].username} deleted successfully` });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
