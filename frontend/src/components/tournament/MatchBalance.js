import React from 'react';

const GRADE_BADGE = {
  excellent: 'badge-success',
  good: 'badge-info',
  fair: 'badge-warn',
  poor: 'badge-danger'
};

const ROWS = [
  {
    key: 'skill',
    label: 'Total skill',
    hint: 'Combined rating of all players'
  },
  {
    key: 'net',
    label: 'Strength at the net',
    hint: 'Combined rating of the male hitters'
  },
  {
    key: 'males',
    label: 'Men per side',
    hint: 'Male count on each team'
  }
];

function BalanceRow({ label, hint, values }) {
  const { team1, team2 } = values;
  const total = team1 + team2;
  const leftPct = total > 0 ? (team1 / total) * 100 : 50;

  return (
    <div className="balance-row" title={hint}>
      <span className="balance-row-label">{label}</span>
      <span className={`balance-num${team1 > team2 ? ' lead' : ''}`}>{team1}</span>
      <span className="balance-bar" aria-hidden="true">
        <span className="left" style={{ width: `${leftPct}%` }} />
        <span className="right" style={{ width: `${100 - leftPct}%` }} />
      </span>
      <span className={`balance-num right${team2 > team1 ? ' lead' : ''}`}>{team2}</span>
    </div>
  );
}

// Renders the balance the generator actually optimized for. The numbers come
// from the API rather than being recomputed here, so the display can never
// drift from the algorithm's own rating scale.
function MatchBalance({ balance }) {
  if (!balance) return null;

  return (
    <div className="balance">
      <div className="balance-head">
        <span className="balance-title">Match balance</span>
        <span className={`badge ${GRADE_BADGE[balance.overall] || 'badge-neutral'}`}>
          {balance.overall}
        </span>
      </div>
      <div className="balance-rows">
        {ROWS.map(row => (
          <BalanceRow
            key={row.key}
            label={row.label}
            hint={row.hint}
            values={balance[row.key]}
          />
        ))}
      </div>
    </div>
  );
}

export default MatchBalance;
