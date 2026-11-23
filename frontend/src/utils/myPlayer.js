/*
 * "This is me" — which player this phone belongs to, remembered per browser.
 *
 * Player ids are per-tournament (rosters are copied, not shared), so the choice
 * is stored per tournament. The name is also remembered on its own, so next
 * week's tournament can pick the same person automatically when exactly one
 * player has that name.
 *
 * Not identity and not authenticated: it only decides what this screen puts
 * first. Storage can be unavailable (private windows, blocked site data), in
 * which case every call quietly does nothing and the picker just reappears.
 */

const keyFor = tournamentId => `madhatter.me.${tournamentId}`;
const NAME_KEY = 'madhatter.myName';

const normalise = name => (name || '').trim().toLowerCase();

export function loadMyPlayerId(tournamentId, players) {
  try {
    const stored = Number(localStorage.getItem(keyFor(tournamentId)));
    if (stored && players.some(p => p.id === stored)) return stored;

    // New tournament on a phone that has picked before: match on name, but
    // only when it is unambiguous
    const name = normalise(localStorage.getItem(NAME_KEY));
    if (!name) return null;

    const matches = players.filter(p => normalise(p.name) === name);
    return matches.length === 1 ? matches[0].id : null;
  } catch {
    return null;
  }
}

export function saveMyPlayer(tournamentId, player) {
  try {
    if (player) {
      localStorage.setItem(keyFor(tournamentId), String(player.id));
      localStorage.setItem(NAME_KEY, player.name);
    } else {
      // "Not you?" forgets the name too, or the next tournament would pick
      // the wrong person straight back
      localStorage.removeItem(keyFor(tournamentId));
      localStorage.removeItem(NAME_KEY);
    }
  } catch {
    // Nothing to do: the choice just lasts for this page view
  }
}
