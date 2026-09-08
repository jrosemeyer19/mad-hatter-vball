const jwt = require('jsonwebtoken');
const pool = require('../database/db');

// A JWT stays valid for its full 24h life no matter what happens to the
// account, so changing a password would otherwise leave every token issued
// before the change still working. Each token carries a `pwc` claim holding
// the users.password_changed_at it was minted against; when that no longer
// matches the stored value, the token belongs to a superseded password and is
// refused. Tokens issued before this claim existed simply have no `pwc`, which
// reads the same as the NULL stored for an account whose password has never
// been changed.
//
// The token's own `iat` cannot stand in for this: it has one-second resolution,
// so it cannot tell the replacement token issued by a password change apart
// from the token that change was meant to retire.
const passwordStamp = (value) =>
  value === null || value === undefined
    ? null
    // Second resolution, so a timestamp that loses sub-second precision on its
    // way through the database does not retire a perfectly good token.
    : Math.floor(new Date(value).getTime() / 1000);

const tokenRetiredByPasswordChange = (user, decoded) =>
  passwordStamp(decoded.pwc) !== passwordStamp(user.password_changed_at);

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

    if (tokenRetiredByPasswordChange(result.rows[0], decoded)) {
      return res.status(401).json({ message: 'Password changed. Please log in again.' });
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
    if (result.rows.length > 0 && !tokenRetiredByPasswordChange(result.rows[0], decoded)) {
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
