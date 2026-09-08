import React, { useState } from 'react';

function Delta({ value }) {
  const n = Number(value) || 0;
  const cls = n > 0 ? 'delta-pos' : n < 0 ? 'delta-neg' : 'delta-nil';
  return <span className={cls}>{n > 0 ? '+' : ''}{n}</span>;
}

// Paid on payout_rank, not the displayed rank. A player who withdrew keeps the
// place their points earned but is not eligible, so the money slides to the
// next person who played the whole tournament.
function payoutFor(results, payoutRank) {
  if (!results.hasPayouts || payoutRank == null) return null;
  if (payoutRank === 1) return results.payouts.first;
  if (payoutRank === 2) return results.payouts.second;
  if (payoutRank === 3) return results.payouts.third;
  return 0;
}

function StandingsTable({ title, rows, results, showPayouts }) {
  return (
    <div>
      <h3 className="mb-1">{title}</h3>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Player</th>
              <th>Points</th>
              <th>+/–</th>
              {showPayouts && <th>Payout</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map(player => {
              const rank = Number(player.rank);
              const withdrawn = player.is_withdrawn === true;
              const payoutRank = player.payout_rank == null ? null : Number(player.payout_rank);
              const payout = payoutFor(results, payoutRank);
              return (
                <tr key={player.name} className={withdrawn ? 'is-withdrawn-row' : undefined}>
                  <td className={!withdrawn && rank <= 3 ? `rank-${rank}` : 'text-faint'}>{rank}</td>
                  <td>
                    <strong>{player.name}</strong>
                    {withdrawn && <span className="withdrew-tag">withdrew</span>}
                  </td>
                  <td className="num">{player.total_points}</td>
                  <td className="num"><Delta value={player.point_differential} /></td>
                  {showPayouts && (
                    <td className="num">{withdrawn ? '—' : `$${payout ?? 0}`}</td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ResultsPanel({ results, user }) {
  const [showPayouts, setShowPayouts] = useState(false);

  if (!results) return null;

  const men = results.standings.filter(p => p.gender === 'male');
  const women = results.standings.filter(p => p.gender === 'female');
  const payoutColumns = !!user && showPayouts;

  return (
    <div className="stack">
      <div className="card">
        <div className="card-header">
          <h2>Final results</h2>
          {user && (
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={showPayouts}
                onChange={e => setShowPayouts(e.target.checked)}
              />
              Show payouts
            </label>
          )}
        </div>

        {/* The server omits the money entirely for anonymous visitors, so
            there is nothing to render for them here */}
        {user ? (
          <>
            <div className="stat-grid mb-1">
              <div className="stat">
                <div className="stat-label">Entry fee</div>
                <div className="stat-value">${results.tournament.entry_fee}</div>
              </div>
              <div className="stat">
                <div className="stat-label">Players</div>
                <div className="stat-value">{results.standings.length}</div>
              </div>
              <div className="stat">
                <div className="stat-label">Director cost</div>
                <div className="stat-value">${results.tournament.director_cost}</div>
              </div>
              <div className="stat">
                <div className="stat-label">Prize pool</div>
                <div className="stat-value">${results.totalPool}</div>
              </div>
            </div>

            {!results.hasPayouts && (
              <div className="info-message" style={{ marginBottom: 0 }}>
                No prize money to distribute — the entry fee is $0 or does not cover the director cost.
              </div>
            )}
          </>
        ) : (
          <div className="stat-grid">
            <div className="stat">
              <div className="stat-label">Players</div>
              <div className="stat-value">{results.standings.length}</div>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="stack">
          <StandingsTable title="Men" rows={men} results={results} showPayouts={payoutColumns} />
          <StandingsTable title="Women" rows={women} results={results} showPayouts={payoutColumns} />
        </div>

        {results.hasPayouts && payoutColumns && (
          <div className="mt-1">
            <h3 className="mb-1">Payout summary</h3>
            <div className="stat-grid">
              <div className="stat">
                <div className="stat-label">1st (each)</div>
                <div className="stat-value">${results.payouts.first}</div>
              </div>
              <div className="stat">
                <div className="stat-label">2nd (each)</div>
                <div className="stat-value">${results.payouts.second}</div>
              </div>
              <div className="stat">
                <div className="stat-label">3rd (each)</div>
                <div className="stat-value">${results.payouts.third}</div>
              </div>
              <div className="stat">
                <div className="stat-label">Total paid</div>
                <div className="stat-value">
                  ${(results.payouts.first + results.payouts.second + results.payouts.third) * 2}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ResultsPanel;
