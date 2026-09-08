const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../database/db');
const { authenticateToken } = require('../middleware/auth');
const { loginLimiter, passwordChangeLimiter } = require('../middleware/rateLimit');
const { validatePassword } = require('../utils/passwordPolicy');

const router = express.Router();

const BCRYPT_ROUNDS = 10;

// passwordChangedAt is passed explicitly when a password has just been changed,
// because the user row in hand still holds the old value at that point.
const signToken = (user, passwordChangedAt = user.password_changed_at) => jwt.sign(
  {
    userId: user.id,
    username: user.username,
    isSuperAdmin: user.is_super_admin,
    // Ties the token to one particular password; see the middleware for how
    // this retires tokens minted against an older one.
    pwc: passwordChangedAt ? new Date(passwordChangedAt).getTime() : null
  },
  process.env.JWT_SECRET,
  { expiresIn: '24h' }
);

// Login
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password required' });
    }
    
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0];
    
    if (!user || !await bcrypt.compare(password, user.password_hash)) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    const token = signToken(user);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        isSuperAdmin: user.is_super_admin
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Verify token
router.get('/verify', authenticateToken, (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      username: req.user.username,
      isSuperAdmin: req.user.is_super_admin
    }
  });
});

// Change own password
router.post('/change-password', authenticateToken, passwordChangeLimiter, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new password are required' });
    }

    // Requiring the current password means a token someone else got hold of
    // cannot be used to take the account over.
    if (!await bcrypt.compare(currentPassword, req.user.password_hash)) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    const problems = validatePassword(newPassword, { username: req.user.username });
    if (problems.length > 0) {
      return res.status(400).json({ message: problems[0], errors: problems });
    }

    if (await bcrypt.compare(newPassword, req.user.password_hash)) {
      return res.status(400).json({ message: 'New password must be different from the current one' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    const changedAt = new Date();

    await pool.query(
      'UPDATE users SET password_hash = $1, password_changed_at = $2 WHERE id = $3',
      [hashedPassword, changedAt, req.user.id]
    );

    // Every token minted against the old password is now dead, including the
    // one this request arrived with, so hand back a fresh one to keep this
    // session signed in.
    res.json({
      message: 'Password updated successfully',
      token: signToken(req.user, changedAt)
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
