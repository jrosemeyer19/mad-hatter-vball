/*
 * Minimal in-memory rate limiter for the password endpoints.
 *
 * This app runs as a single node process behind nginx, so a Map is enough and
 * avoids pulling in a dependency. Two consequences worth knowing: counters
 * reset when the process restarts, and they would not be shared if the app
 * were ever run clustered or on more than one box.
 *
 * Limits are keyed on the account (username or user id) rather than the client
 * IP on purpose — every request arrives from nginx on loopback, so an IP key
 * would put all clients in the same bucket and let one person's typos lock out
 * the whole gym. Add `proxy_set_header X-Real-IP` based limiting in nginx if
 * per-IP throttling is wanted too.
 */

const createRateLimiter = ({ windowMs, max, keyGenerator, message }) => {
  const buckets = new Map();

  const sweep = (now) => {
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  };

  return (req, res, next) => {
    const key = keyGenerator(req);

    // No key means there is nothing to attribute the attempt to (e.g. a login
    // post with no username). Let it through; the route rejects it anyway.
    if (!key) return next();

    const now = Date.now();

    // Keep the map from growing without bound on a long-running process.
    if (buckets.size > 5000) sweep(now);

    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;

    if (bucket.count > max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({
        message: message || `Too many attempts. Try again in ${retryAfter} seconds.`
      });
    }

    // A successful login should not count against the limit, otherwise a busy
    // director working through several tournaments could throttle themselves.
    res.on('finish', () => {
      if (res.statusCode < 400 && bucket.count > 0) bucket.count -= 1;
    });

    next();
  };
};

// Attempts are counted per username so one account being guessed at cannot
// lock out the others.
const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) =>
    typeof req.body?.username === 'string'
      ? `login:${req.body.username.toLowerCase()}`
      : null,
  message: 'Too many login attempts for this account. Try again in a few minutes.'
});

// Runs after authenticateToken, so the user is known. This limits how fast a
// stolen-but-still-valid token can be used to brute force the current password.
const passwordChangeLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => (req.user ? `pwchange:${req.user.id}` : null),
  message: 'Too many password change attempts. Try again in a few minutes.'
});

module.exports = { createRateLimiter, loginLimiter, passwordChangeLimiter };
