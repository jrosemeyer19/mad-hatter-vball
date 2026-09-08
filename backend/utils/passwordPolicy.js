/*
 * Password policy — the authoritative copy.
 *
 * frontend/src/utils/passwordPolicy.js mirrors these rules so the form can
 * show live feedback while typing. The server is what actually decides, so
 * any change here must be copied there (and vice versa).
 */

const MIN_LENGTH = 9;
const REQUIRED_CLASSES = 3;

// bcrypt hashes only the first 72 bytes of input and silently discards the
// rest, so a longer password would give a false sense of strength. Reject it
// instead of quietly truncating.
const MAX_BYTES = 72;

const CHARACTER_CLASSES = [
  { key: 'upper',  label: 'an uppercase letter', pattern: /[A-Z]/ },
  { key: 'lower',  label: 'a lowercase letter',  pattern: /[a-z]/ },
  { key: 'number', label: 'a number',            pattern: /[0-9]/ },
  { key: 'symbol', label: 'a symbol',            pattern: /[^A-Za-z0-9]/ }
];

// Deliberately short: a handful of passwords that satisfy the rules above but
// are the first thing anyone would try. Not a substitute for a real breach
// list, just a speed bump against the most obvious choices.
const COMMON_PASSWORDS = new Set([
  'password1!',
  'password123',
  'password123!',
  'passw0rd!',
  'welcome123',
  'welcome123!',
  'qwerty123!',
  'letmein123',
  'changeme123',
  'volleyball1',
  'volleyball1!',
  'madhatter1!',
  'admin12345',
  'admin123!',
  'iloveyou123'
]);

const RULES_TEXT =
  `At least ${MIN_LENGTH} characters, including ${REQUIRED_CLASSES} of these 4: ` +
  'uppercase letter, lowercase letter, number, symbol.';

/**
 * Validate a candidate password.
 *
 * @param {string} password
 * @param {{ username?: string }} [options] username is used to reject
 *        passwords that simply contain the account name.
 * @returns {string[]} human-readable problems; empty means the password is OK.
 */
function validatePassword(password, options = {}) {
  if (typeof password !== 'string' || password.length === 0) {
    return ['Password is required'];
  }

  const errors = [];

  if (password.length < MIN_LENGTH) {
    errors.push(`Password must be at least ${MIN_LENGTH} characters`);
  }

  if (Buffer.byteLength(password, 'utf8') > MAX_BYTES) {
    errors.push(`Password must be ${MAX_BYTES} bytes or fewer`);
  }

  const satisfied = CHARACTER_CLASSES.filter((c) => c.pattern.test(password));
  if (satisfied.length < REQUIRED_CLASSES) {
    const labels = CHARACTER_CLASSES.map((c) => c.label).join(', ');
    errors.push(
      `Password must include at least ${REQUIRED_CLASSES} of these 4: ${labels}`
    );
  }

  const { username } = options;
  if (username && username.length >= 3 &&
      password.toLowerCase().includes(username.toLowerCase())) {
    errors.push('Password must not contain the username');
  }

  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    errors.push('Password is too easy to guess — pick something less common');
  }

  return errors;
}

module.exports = {
  MIN_LENGTH,
  MAX_BYTES,
  REQUIRED_CLASSES,
  CHARACTER_CLASSES,
  RULES_TEXT,
  validatePassword
};
