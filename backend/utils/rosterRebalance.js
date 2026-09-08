/*
 * Rebalancing after a mid-tournament withdrawal.
 *
 * When someone leaves partway through, their team would otherwise play the
 * rest of the day a player short AND weakened by exactly whoever left — if it
 * was their strongest player, that court becomes a blowout. This reassigns the
 * remaining players among the teams of matches that have not been played yet,
 * so the shortfall is spread and the short-handed side is compensated with
 * stronger players, the same way the generator already compensates the
 * 6-v-5 matches it produces at some player counts.
 *
 * Deliberate limits:
 *
 *  - Only teams whose match is still unplayed are touched. A scored match
 *    awarded points by joining team_players, and re-scoring reverses that
 *    award, so moving a player off a scored team would corrupt totals.
 *  - Players are only ever moved between teams that are already playing the
 *    same round. Nobody is promoted off a bye, because that would hand them an
 *    extra match, and standings are cumulative points — more matches is an
 *    advantage. Every remaining player keeps exactly the match count they were
 *    scheduled for; only the person who withdrew plays fewer.
 *  - Rounds, courts and who-plays-whom are never changed. This does not
 *    re-solve the tournament; it only decides who stands on which side.
 */

const { getSkillRating, calculateNetStrength } = require('./teamGenerator');

// Squared differences, so one badly lopsided court costs more than two mildly
// uneven ones — the same shape of objective the generator's refinement uses.
const NET_STRENGTH_WEIGHT = 0.5;

// Kept well below the balance terms: a repeat teammate is a blemish, a
// lopsided court ruins the match.
const TEAMMATE_REPEAT_WEIGHT = 0.25;

const teamSkill = (players) => players.reduce((sum, p) => sum + getSkillRating(p), 0);

/**
 * How large each team should be once `total` players are spread across
 * `teamCount` teams: as even as possible, differing by at most one, which is
 * what the generator itself produces.
 */
function computeTargetSizes(total, teamCount) {
  const base = Math.floor(total / teamCount);
  const remainder = total % teamCount;
  // The larger teams come first so the list is descending and stable.
  return Array.from({ length: teamCount }, (_, i) => (i < remainder ? base + 1 : base));
}

/** Repeat-teammate count for one team, from history of who has played with whom. */
function teammateRepeats(players, teammateHistory) {
  if (!teammateHistory) return 0;

  let repeats = 0;
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      repeats += teammateHistory[players[i].id]?.[players[j].id] || 0;
    }
  }
  return repeats;
}

/**
 * Cost of an arrangement: how uneven the courts are, plus a light penalty for
 * putting the same people together again.
 */
function arrangementCost(pairs, teammateHistory) {
  let cost = 0;

  for (const pair of pairs) {
    const a = pair.teamA.players;
    const b = pair.teamB.players;

    cost += (teamSkill(a) - teamSkill(b)) ** 2;
    cost += NET_STRENGTH_WEIGHT * (calculateNetStrength(a) - calculateNetStrength(b)) ** 2;
    cost += TEAMMATE_REPEAT_WEIGHT *
      (teammateRepeats(a, teammateHistory) + teammateRepeats(b, teammateHistory));
  }

  return cost;
}

/**
 * Bring team sizes to `targets` by moving single players out of oversized
 * teams into undersized ones, picking whichever move costs least each time.
 * Runs before the swap pass, which cannot change sizes.
 */
function normalizeSizes(teams, targetByTeamId, pairs, teammateHistory) {
  const oversized = () => teams.filter(t => t.players.length > targetByTeamId.get(t.id));
  const undersized = () => teams.filter(t => t.players.length < targetByTeamId.get(t.id));

  let guard = teams.length * 10;

  while (oversized().length > 0 && undersized().length > 0 && guard-- > 0) {
    let best = null;

    for (const from of oversized()) {
      for (const to of undersized()) {
        for (let i = 0; i < from.players.length; i++) {
          const [moved] = from.players.splice(i, 1);
          to.players.push(moved);

          const cost = arrangementCost(pairs, teammateHistory);
          if (!best || cost < best.cost) best = { cost, fromId: from.id, toId: to.id, index: i };

          to.players.pop();
          from.players.splice(i, 0, moved);
        }
      }
    }

    if (!best) break;

    const from = teams.find(t => t.id === best.fromId);
    const to = teams.find(t => t.id === best.toId);
    const [moved] = from.players.splice(best.index, 1);
    to.players.push(moved);
  }
}

/**
 * Swap players between teams until no single swap improves the arrangement.
 * Sizes are fixed by this point, so every player keeps exactly one slot.
 */
function improveBySwapping(teams, pairs, teammateHistory, maxPasses = 200) {
  let passes = 0;
  let improved = true;

  while (improved && passes < maxPasses) {
    improved = false;
    passes++;

    for (let x = 0; x < teams.length; x++) {
      for (let y = x + 1; y < teams.length; y++) {
        const t1 = teams[x];
        const t2 = teams[y];

        for (let i = 0; i < t1.players.length; i++) {
          for (let j = 0; j < t2.players.length; j++) {
            const before = arrangementCost(pairs, teammateHistory);

            [t1.players[i], t2.players[j]] = [t2.players[j], t1.players[i]];

            if (arrangementCost(pairs, teammateHistory) < before - 1e-9) {
              improved = true;
            } else {
              [t1.players[i], t2.players[j]] = [t2.players[j], t1.players[i]];
            }
          }
        }
      }
    }
  }

  return passes;
}

/**
 * Rebalance the teams of one round's unplayed matches.
 *
 * @param {Array} pairs - unplayed matches as
 *        [{ court, teamA: { id, players }, teamB: { id, players } }]. Mutated
 *        in place; players are the objects to reassign.
 * @param {Object} options
 * @param {number} options.minPlayersPerTeam - the tournament's configured
 *        minimum. A withdrawal may take one team to minPlayersPerTeam - 1, but
 *        no lower; below that the caller is told to regenerate instead.
 * @param {Object} [options.teammateHistory] - { playerId: { otherId: count } }
 * @returns {{ changed: boolean, smallestTeam: number, passes: number,
 *             worstSkillGapBefore: number, worstSkillGapAfter: number }}
 */
function rebalanceUnplayedMatches(pairs, options) {
  const { minPlayersPerTeam, teammateHistory } = options;

  if (pairs.length === 0) {
    return { changed: false, smallestTeam: null, passes: 0,
             worstSkillGapBefore: 0, worstSkillGapAfter: 0 };
  }

  const teams = pairs.flatMap(pair => [pair.teamA, pair.teamB]);
  const totalPlayers = teams.reduce((sum, t) => sum + t.players.length, 0);

  const targets = computeTargetSizes(totalPlayers, teams.length);
  const floor = minPlayersPerTeam - 1;
  const smallestTarget = Math.min(...targets);

  if (smallestTarget < floor) {
    throw new Error(
      `Rebalancing would leave a team of ${smallestTarget}, below the floor of ${floor} ` +
      `for a minimum team size of ${minPlayersPerTeam}`
    );
  }

  const worstGap = () => Math.max(...pairs.map(
    p => Math.abs(teamSkill(p.teamA.players) - teamSkill(p.teamB.players))
  ));

  const worstSkillGapBefore = worstGap();

  // Largest teams keep the largest targets, so sizes move as little as possible
  const byDescendingSize = [...teams].sort((a, b) => b.players.length - a.players.length);
  const targetByTeamId = new Map(byDescendingSize.map((t, i) => [t.id, targets[i]]));

  normalizeSizes(teams, targetByTeamId, pairs, teammateHistory);
  const passes = improveBySwapping(teams, pairs, teammateHistory);

  return {
    changed: true,
    smallestTeam: Math.min(...teams.map(t => t.players.length)),
    passes,
    worstSkillGapBefore,
    worstSkillGapAfter: worstGap()
  };
}

module.exports = {
  rebalanceUnplayedMatches,
  computeTargetSizes,
  arrangementCost,
  teammateRepeats,
  NET_STRENGTH_WEIGHT,
  TEAMMATE_REPEAT_WEIGHT
};
