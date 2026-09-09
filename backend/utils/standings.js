/*
 * Final standings and prize money.
 *
 * Both POST /:id/complete and GET /:id/results need these, and each used to
 * carry its own copy of the query and the payout arithmetic. They drifted:
 * withdrawn-player support was added to one and not the other, so finishing a
 * tournament showed $0 for everyone until the page was reloaded. One copy now.
 */

// Of the pool, per division. The remainder covers the director's costs.
const PAYOUT_SHARES = { first: 0.30, second: 0.15, third: 0.05 };

// Paid in cash at the gym, so nothing smaller than a $5 note.
const PAYOUT_ROUNDING = 5;

/*
 * Withdrawn players keep the place their points earned them, so the standings
 * match what everyone remembers of the day. payout_rank is ranked over eligible
 * players only, sliding the prize money to the next person who played the whole
 * tournament rather than leaving it unclaimed.
 */
const STANDINGS_SQL = `
  SELECT name, gender, total_points, point_differential, matches_played, is_withdrawn,
    RANK() OVER (
      PARTITION BY gender
      ORDER BY total_points DESC, point_differential DESC
    ) as rank,
    CASE WHEN is_withdrawn THEN NULL ELSE
      RANK() OVER (
        PARTITION BY gender, is_withdrawn
        ORDER BY total_points DESC, point_differential DESC
      )
    END as payout_rank
  FROM players
  WHERE tournament_id = $1
  ORDER BY gender, total_points DESC, point_differential DESC
`;

/**
 * @param {object} db - a pool or a client already inside a transaction
 * @param {number|string} tournamentId
 */
async function fetchStandings(db, tournamentId) {
  const result = await db.query(STANDINGS_SQL, [tournamentId]);
  return result.rows;
}

/**
 * Everyone who entered counts toward the pool, including anyone who withdrew —
 * they still paid.
 *
 * @param {{ playerCount: number, entryFee: number|string, directorCost: number|string }} input
 * @returns {{ payouts: { first: number, second: number, third: number },
 *             totalPool: number, hasPayouts: boolean }}
 */
function calculatePayouts({ playerCount, entryFee, directorCost }) {
  const totalEntryFees = playerCount * parseFloat(entryFee || 0);
  const cost = parseFloat(directorCost || 0);
  const totalPool = Math.max(0, totalEntryFees - cost);

  if (totalPool <= 0) {
    return { payouts: { first: 0, second: 0, third: 0 }, totalPool: 0, hasPayouts: false };
  }

  const toNote = amount => Math.floor(amount / PAYOUT_ROUNDING) * PAYOUT_ROUNDING;

  return {
    payouts: {
      first: toNote(totalPool * PAYOUT_SHARES.first),
      second: toNote(totalPool * PAYOUT_SHARES.second),
      third: toNote(totalPool * PAYOUT_SHARES.third)
    },
    totalPool,
    hasPayouts: true
  };
}

module.exports = { fetchStandings, calculatePayouts, PAYOUT_SHARES, PAYOUT_ROUNDING, STANDINGS_SQL };
