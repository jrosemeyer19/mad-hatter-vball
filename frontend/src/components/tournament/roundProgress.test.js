import { openRounds, currentRoundNumber, courtState } from './roundProgress';
import { loadMyPlayerId, saveMyPlayer } from '../../utils/myPlayer';

const rounds = [1, 2, 3].map(n => ({ round_number: n }));
let nextId = 1;
const match = (round, court, state) => ({
  id: nextId++,
  round_number: round,
  court,
  is_completed: state === 'done',
  team1_game1_score: state === 'waiting' ? null : 25
});

describe('round progress', () => {
  test('mid-round names the courts still out', () => {
    const matches = [
      match(1, 1, 'done'), match(1, 2, 'done'), match(1, 3, 'done'),
      match(2, 1, 'done'), match(2, 2, 'waiting'), match(2, 3, 'game2'),
      match(3, 1, 'waiting'), match(3, 2, 'waiting'), match(3, 3, 'waiting')
    ];
    expect(currentRoundNumber(rounds, matches)).toBe(2);
    const open = openRounds(rounds, matches);
    expect(open.map(r => r.roundNumber)).toEqual([2]);
    expect(open[0].courts.map(c => c.state)).toEqual(['done', 'waiting', 'game2']);
  });

  test('a forgotten court in an earlier round is reported alongside the live one', () => {
    const matches = [
      match(1, 1, 'done'), match(1, 2, 'done'), match(1, 3, 'waiting'),
      match(2, 1, 'done'), match(2, 2, 'waiting'), match(2, 3, 'waiting'),
      match(3, 1, 'waiting'), match(3, 2, 'waiting'), match(3, 3, 'waiting')
    ];
    expect(openRounds(rounds, matches).map(r => r.roundNumber)).toEqual([1, 2]);
  });

  test('nothing to report once every match is final', () => {
    const matches = [1, 2, 3].flatMap(r => [1, 2, 3].map(c => match(r, c, 'done')));
    expect(openRounds(rounds, matches)).toEqual([]);
    expect(courtState(matches[0])).toBe('done');
  });
});

describe('this is me', () => {
  const roster = [{ id: 10, name: 'Jeff R' }, { id: 11, name: 'Sam' }, { id: 12, name: 'sam ' }];
  beforeEach(() => localStorage.clear());

  test('remembers the pick for the tournament', () => {
    saveMyPlayer(5, roster[0]);
    expect(loadMyPlayerId(5, roster)).toBe(10);
  });

  test('carries the name to a new tournament when unambiguous', () => {
    saveMyPlayer(5, roster[0]);
    expect(loadMyPlayerId(6, [{ id: 40, name: ' jeff r' }, { id: 41, name: 'Pat' }])).toBe(40);
  });

  test('does not guess between two players with the same name', () => {
    saveMyPlayer(5, roster[1]);
    expect(loadMyPlayerId(6, roster)).toBeNull();
  });

  test('a stale id from a deleted player is ignored', () => {
    saveMyPlayer(5, { id: 99, name: 'Gone' });
    expect(loadMyPlayerId(5, roster)).toBeNull();
  });

  test('"Not you?" forgets both the pick and the name', () => {
    saveMyPlayer(5, roster[0]);
    saveMyPlayer(5, null);
    expect(loadMyPlayerId(5, roster)).toBeNull();
    expect(loadMyPlayerId(6, [{ id: 40, name: 'Jeff R' }])).toBeNull();
  });
});
