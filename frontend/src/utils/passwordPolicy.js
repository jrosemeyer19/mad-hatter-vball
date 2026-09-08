/*
 * Password policy — mirror of backend/utils/passwordPolicy.js.
 *
 * This copy exists only so the form can tick requirements off as someone
 * types. The server re-checks everything and is the real gate, so if the rules
 * change there, change them here too.
 */

export const MIN_LENGTH = 9;
export const REQUIRED_CLASSES = 3;

// bcrypt ignores anything past 72 bytes, so the server refuses longer input
// rather than silently truncating it.
export const MAX_BYTES = 72;

export const CHARACTER_CLASSES = [
  { key: 'upper',  label: 'Uppercase letter', pattern: /[A-Z]/ },
  { key: 'lower',  label: 'Lowercase letter', pattern: /[a-z]/ },
  { key: 'number', label: 'Number',           pattern: /[0-9]/ },
  { key: 'symbol', label: 'Symbol',           pattern: /[^A-Za-z0-9]/ }
];

// Mirror of COMMON_PASSWORDS on the server. Kept here only so the checklist
// does not show all green on something the server is about to refuse; it is
// not a secret and is not meant to be exhaustive.
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

export const RULES_TEXT =
  `At least ${MIN_LENGTH} characters, including ${REQUIRED_CLASSES} of these 4: ` +
  'uppercase letter, lowercase letter, number, symbol.';

const byteLength = (value) =>
  typeof TextEncoder !== 'undefined'
    ? new TextEncoder().encode(value).length
    : value.length;

/**
 * Describe how a candidate password measures up, for live form feedback.
 *
 * @param {string} password
 * @param {{ username?: string }} [options]
 * @returns {{ classes: Array, classesMet: number, checks: Array, valid: boolean }}
 */
export function evaluatePassword(password = '', options = {}) {
  const { username } = options;

  const classes = CHARACTER_CLASSES.map((c) => ({
    key: c.key,
    label: c.label,
    met: c.pattern.test(password)
  }));

  const classesMet = classes.filter((c) => c.met).length;

  const checks = [
    {
      key: 'length',
      label: `At least ${MIN_LENGTH} characters`,
      met: password.length >= MIN_LENGTH
    },
    {
      key: 'classes',
      label: `${REQUIRED_CLASSES} of 4 character types (${classesMet} of 4 used)`,
      met: classesMet >= REQUIRED_CLASSES
    }
  ];

  if (byteLength(password) > MAX_BYTES) {
    checks.push({
      key: 'maxLength',
      label: `No longer than ${MAX_BYTES} bytes`,
      met: false
    });
  }

  // Only worth showing once it actually applies — an empty box should not be
  // scolded about containing the username.
  if (username && username.length >= 3 && password.length > 0 &&
      password.toLowerCase().includes(username.toLowerCase())) {
    checks.push({
      key: 'username',
      label: 'Does not contain the username',
      met: false
    });
  }

  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    checks.push({
      key: 'common',
      label: 'Not one of the obvious choices',
      met: false
    });
  }

  return {
    classes,
    classesMet,
    checks,
    valid: checks.every((c) => c.met)
  };
}
