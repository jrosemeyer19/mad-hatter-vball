import React from 'react';
import { evaluatePassword } from '../utils/passwordPolicy';

/**
 * Live checklist for a new password. Shared by the change-password form and
 * the admin create/reset forms so the rules are described the same way
 * everywhere.
 */
function PasswordRequirements({ password = '', username = '' }) {
  const { checks, classes } = evaluatePassword(password, { username });

  return (
    <div className="password-rules">
      <ul>
        {checks.map((check) => (
          <li key={check.key} className={check.met ? 'met' : 'unmet'}>
            <span className="password-rule-icon" aria-hidden="true">
              {check.met ? '✓' : '○'}
            </span>
            {check.label}
          </li>
        ))}
      </ul>

      <div className="password-classes">
        {classes.map((c) => (
          <span key={c.key} className={`password-class ${c.met ? 'met' : ''}`}>
            {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default PasswordRequirements;
