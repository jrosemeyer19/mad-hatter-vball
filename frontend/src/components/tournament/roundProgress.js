// Where the day is up to, derived from the matches the page already holds.
// Shared by the round status strip and the "my match" panel so they agree on
// which round is "now".

const hasScore = (match, game) =>
  match[`team1_game${game}_score`] !== null && match[`team1_game${game}_score`] !== undefined;

export function courtState(match) {
  if (match.is_completed) return 'done';
  if (hasScore(match, 1)) return 'game2';
  return 'waiting';
}

const touched = match => match.is_completed || hasScore(match, 1);

// The round being played: the first with a match still unscored. Matches the
// round the page lands on.
export function currentRoundNumber(sortedRounds, matches) {
  const round = sortedRounds.find(r =>
    matches.some(m => m.round_number === r.round_number && !m.is_completed)
  );
  return round ? round.round_number : null;
}

// Rounds worth reporting on: the current one, plus any earlier round left with
// an unscored court after a later round has started (a forgotten entry). Each
// comes with its courts in court order.
export function openRounds(sortedRounds, matches) {
  const matchesOf = n => matches.filter(m => m.round_number === n);
  const current = currentRoundNumber(sortedRounds, matches);
  if (current === null) return [];

  const latestStarted = Math.max(
    current,
    ...matches.filter(touched).map(m => m.round_number)
  );

  return sortedRounds
    .filter(r => r.round_number >= current && r.round_number <= latestStarted)
    .map(r => ({
      roundNumber: r.round_number,
      courts: [...matchesOf(r.round_number)]
        .sort((a, b) => a.court - b.court)
        .map(m => ({ matchId: m.id, court: m.court, state: courtState(m) }))
    }))
    .filter(r => r.courts.some(c => c.state !== 'done'));
}
