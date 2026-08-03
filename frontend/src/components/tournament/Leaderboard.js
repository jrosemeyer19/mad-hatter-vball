import React, { useState } from 'react';

const MEDALS = ['🥇', '🥈', '🥉'];

function Delta({ value }) {
  const n = Number(value) || 0;
  const cls = n > 0 ? 'delta-pos' : n < 0 ? 'delta-neg' : 'delta-nil';
  return <span className={cls}>{n > 0 ? '+' : ''}{n}</span>;
}

function isMale(p) {
  const g = p.gender?.toLowerCase();
  return g === 'male' || g === 'm';
}

function Leaderboard({ players, onExport, canExport }) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const maleCount = players.filter(isMale).length;

  const visible = players
    .filter(p => {
      if (filter === 'male' && !isMale(p)) return false;
      if (filter === 'female' && isMale(p)) return false;
      return search === '' || p.name.toLowerCase().includes(search.toLowerCase());
    })
    .sort((a, b) => (b.total_points - a.total_points) || (b.point_differential - a.point_differential));

  return (
    <div className="card">
      <div className="card-header">
        <h2>Leaderboard</h2>
        {canExport && (
          <button className="btn btn-secondary btn-sm" onClick={onExport}>
            Export players
          </button>
        )}
      </div>

      <div className="stack-sm mb-1">
        <div className="segmented">
          <button className={filter === 'all' ? 'is-active' : ''} onClick={() => setFilter('all')}>
            All ({players.length})
          </button>
          <button className={filter === 'male' ? 'is-active' : ''} onClick={() => setFilter('male')}>
            Men ({maleCount})
          </button>
          <button className={filter === 'female' ? 'is-active' : ''} onClick={() => setFilter('female')}>
            Women ({players.length - maleCount})
          </button>
        </div>
        <input
          type="search"
          placeholder="Search by name…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          aria-label="Search players by name"
        />
      </div>

      {visible.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <p>No players match “{search}”.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th>Played</th>
                <th>Points</th>
                <th>+/–</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((player, i) => (
                <tr key={player.id}>
                  <td className={i < 3 ? `rank-${i + 1}` : 'text-faint'}>
                    {i < 3 ? MEDALS[i] : i + 1}
                  </td>
                  <td><strong>{player.name}</strong></td>
                  <td className="num">{player.matches_played}</td>
                  <td className="num">{player.total_points}</td>
                  <td className="num"><Delta value={player.point_differential} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filter !== 'all' && (
        <p className="field-hint">Ranked within {filter === 'male' ? 'men' : 'women'} only.</p>
      )}
    </div>
  );
}

export default Leaderboard;
