const jwt = require('jsonwebtoken');
const pool = require('../database/db');

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [decoded.userId]);
    
    if (result.rows.length === 0) {
      return res.status(403).json({ message: 'Invalid token' });
    }
    
    req.user = result.rows[0];
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid token' });
  }
};

// Populates req.user when a valid token is present, but lets the request
// through when it is not. The tournament pages are deliberately public so
// players can view teams and enter scores without an account; this lets those
// same routes withhold director-only details from anonymous visitors.
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return next();

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [decoded.userId]);
    if (result.rows.length > 0) {
      req.user = result.rows[0];
    }
  } catch (error) {
    // An expired or malformed token is treated as anonymous rather than an
    // error, so a stale login never locks someone out of the public view
  }

  next();
};

const requireSuperAdmin = (req, res, next) => {
  if (!req.user.is_super_admin) {
    return res.status(403).json({ message: 'Super admin access required' });
  }
  next();
};

module.exports = { authenticateToken, optionalAuth, requireSuperAdmin };
