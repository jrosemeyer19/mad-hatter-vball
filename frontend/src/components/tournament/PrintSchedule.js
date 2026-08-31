import React from 'react';

import { buildPlayerSchedule, byePlayersOf } from './playerSchedule';

// The printable sheet. It is hidden on screen and laid out for one landscape
// page: the court grid up top (the copy that gets taped to the wall) and the
// player lookup below it (what someone scans to find their own name). Two views
// of the same day because they answer different questions.

const tagFor = player =>
  `${player.gender?.toLowerCase() === 'female' ? 'F' : 'M'}-${player.skill_level}`;

function PrintSchedule({ tournament, players, rounds, matches }) {
  const sortedRounds = [...rounds].sort((a, b) => a.round_number - b.round_number);
  if (sortedRounds.length === 0) return null;

  const matchesOf = round =>
    matches
      .filter(m => m.round_number === round.round_number)
      .sort((a, b) => a.court - b.court);

  const teamById = (round, id) => (round.teams || []).find(t => t.id === id);

  const courts = [...new Set(matches.map(m => m.court))].sort((a, b) => a - b);
  const anyByes = sortedRounds.some(round => byePlayersOf(round, players).length > 0);

  const sortedPlayers = [...players].sort((a, b) => a.name.localeCompare(b.name));

  // Same source of truth as the tap-a-name popup, so paper and phone agree
  const scheduleByPlayer = new Map(
    sortedPlayers.map(player => [
      player.id,
      buildPlayerSchedule(player.id, sortedRounds, matches, players)
    ])
  );

  // A landscape page fits roughly 10in of table. Each lookup column costs about
  // 1.3in for the name plus 0.5in per round, so only split the roster into
  // side-by-side columns while they still fit across the sheet.
  const columnWidth = 1.3 + 0.5 * sortedRounds.length;
  const columnCount = Math.max(1, Math.min(3, Math.floor(10 / columnWidth)));
  const perColumn = Math.ceil(sortedPlayers.length / columnCount);
  const playerColumns = Array.from({ length: columnCount }, (_, i) =>
    sortedPlayers.slice(i * perColumn, (i + 1) * perColumn)
  ).filter(column => column.length > 0);

  const printedDate = new Date(tournament.date).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <div className="print-sheet">
      <div className="print-head">
        <h1>{tournament.name}</h1>
        <div className="print-meta">
          {printedDate} · {tournament.location} · {players.length} players ·{' '}
          {courts.length} {courts.length === 1 ? 'court' : 'courts'} ·{' '}
          {sortedRounds.length} rounds
        </div>
      </div>

      <table className="print-grid">
        <thead>
          <tr>
            <th className="print-rowhead" />
            {courts.map(court => (
              <th key={court}>Court {court}</th>
            ))}
            {anyByes && <th className="print-bye-col">Bye</th>}
          </tr>
        </thead>
        <tbody>
          {sortedRounds.map(round => {
            const roundMatches = matchesOf(round);
            const byes = byePlayersOf(round, players);

            return (
              <tr key={round.id}>
                <th className="print-rowhead">Round {round.round_number}</th>

                {courts.map(court => {
                  const match = roundMatches.find(m => m.court === court);
                  if (!match) {
                    return (
                      <td key={court} className="print-empty">
                        —
                      </td>
                    );
                  }

                  const sides = [
                    teamById(round, match.team1_id),
                    teamById(round, match.team2_id)
                  ];

                  return (
                    <td key={court}>
                      <div className="print-match">
                        {sides.map((team, index) => (
                          <div className="print-team" key={team?.id ?? index}>
                            <div className="print-team-name">
                              Team {team?.team_number ?? '?'}
                            </div>
                            {(team?.players || []).map(player => (
                              <div className="print-player" key={player.id}>
                                <span className="print-player-name">{player.name}</span>
                                <span className="print-player-tag">{tagFor(player)}</span>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </td>
                  );
                })}

                {anyByes && (
                  <td className="print-bye-col">
                    {byes.map(player => (
                      <div className="print-player" key={player.id}>
                        <span className="print-player-name">{player.name}</span>
                      </div>
                    ))}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      <h2 className="print-subhead">Find yourself</h2>

      <div className="print-columns">
        {playerColumns.map((column, index) => (
          <table className="print-lookup" key={index}>
            <thead>
              <tr>
                <th>Player</th>
                {sortedRounds.map(round => (
                  <th key={round.id}>R{round.round_number}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {column.map(player => (
                <tr key={player.id}>
                  <td className="print-lookup-name">
                    {player.name} <span className="print-player-tag">{tagFor(player)}</span>
                  </td>
                  {sortedRounds.map((round, roundIndex) => {
                    const entry = scheduleByPlayer.get(player.id)?.[roundIndex];

                    if (entry?.status === 'playing') {
                      return (
                        <td key={round.id}>
                          C{entry.court} · T{entry.teamNumber}
                        </td>
                      );
                    }

                    // 'absent' means the player was added after the draw and is
                    // not in this round at all, which is not the same as a bye
                    return (
                      <td key={round.id} className="print-bye-cell">
                        {entry?.status === 'bye' ? 'bye' : '—'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>

      <div className="print-foot">
        C = court · T = team · the same team number within a round means teammates ·
        M/F with AA/A/BB/B is gender and skill level
      </div>
    </div>
  );
}

export default PrintSchedule;
