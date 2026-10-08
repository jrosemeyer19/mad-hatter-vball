#!/usr/bin/env node
/*
 * Creates throwaway test tournaments on a running site (live or local) through
 * its public API, the same way the director UI does: create the tournament,
 * add randomly generated players, then start it so teams are generated.
 *
 * Usage:
 *   node scripts/createTestTournaments.js --url https://your-site --user admin --players 24
 *   node scripts/createTestTournaments.js --url https://your-site --user admin --start 10 --end 45
 *
 * Run with --help for every option. The password is read from VT_PASSWORD, or
 * prompted for (hidden) when that is unset. Needs Node 18+ for fetch and
 * util.parseArgs.
 */

const { parseArgs } = require('node:util');

const HELP = `
Create test tournaments on a running volleyball-tournament site.

Connection:
  --url <url>            Site base URL, e.g. https://example.com   (or VT_URL)
  --user <name>          Director username                           (or VT_USER)
                         Password comes from VT_PASSWORD, else a hidden prompt.

Player counts (pick one):
  --players <n>          Create one tournament with n players
  --start <n> --end <m>  Create one tournament per count from n to m inclusive

Tournament settings:
  --female-pct <0-100>   Percentage of players who are female       (default 50)
  --courts <n>           Courts available                           (default 3)
  --matches <n>          Guaranteed matches per player              (default 4)
  --min-team <n>         Minimum players per team                   (default 5)
  --allow-seven          Allow 7-player teams                       (default off)
  --setter-pct <0-100>   Percentage of players flagged as setters   (default 20)
  --prefix <text>        Tournament name prefix                     (default "TEST")
  --location <text>      Tournament location                        (default "Test")
  --date <YYYY-MM-DD>    Tournament date                            (default today)

Behaviour:
  --setup-only           Create and fill tournaments but don't start them
  --dry-run              Print what would be created without contacting the site
  -h, --help             Show this help
`;

const SKILL_LEVELS = ['AA', 'A', 'BB', 'B'];
const PLAYER_CONCURRENCY = 5;

function fail(message) {
  console.error(`Error: ${message}\nRun with --help for usage.`);
  process.exit(1);
}

function intOption(values, key, { min, max, fallback }) {
  const raw = values[key];
  if (raw === undefined) return fallback;
  if (!/^[0-9]+$/.test(raw)) fail(`--${key} must be a whole number (got "${raw}")`);
  const n = Number(raw);
  if (min !== undefined && n < min) fail(`--${key} must be at least ${min}`);
  if (max !== undefined && n > max) fail(`--${key} must be at most ${max}`);
  return n;
}

function readOptions() {
  let parsed;
  try {
    parsed = parseArgs({
      options: {
        url: { type: 'string' },
        user: { type: 'string' },
        players: { type: 'string' },
        start: { type: 'string' },
        end: { type: 'string' },
        'female-pct': { type: 'string' },
        courts: { type: 'string' },
        matches: { type: 'string' },
        'min-team': { type: 'string' },
        'allow-seven': { type: 'boolean', default: false },
        'setter-pct': { type: 'string' },
        prefix: { type: 'string', default: 'TEST' },
        location: { type: 'string', default: 'Test' },
        date: { type: 'string' },
        'setup-only': { type: 'boolean', default: false },
        'dry-run': { type: 'boolean', default: false },
        help: { type: 'boolean', short: 'h', default: false }
      }
    });
  } catch (error) {
    fail(error.message);
  }

  const { values } = parsed;
  if (values.help) {
    console.log(HELP);
    process.exit(0);
  }

  const single = intOption(values, 'players', { min: 2 });
  const rangeStart = intOption(values, 'start', { min: 2 });
  const rangeEnd = intOption(values, 'end', { min: 2 });

  let counts;
  if (single !== undefined) {
    if (rangeStart !== undefined || rangeEnd !== undefined) {
      fail('use either --players or --start/--end, not both');
    }
    counts = [single];
  } else if (rangeStart !== undefined && rangeEnd !== undefined) {
    if (rangeStart > rangeEnd) fail('--start must not be greater than --end');
    counts = [];
    for (let n = rangeStart; n <= rangeEnd; n++) counts.push(n);
  } else {
    fail('give --players, or both --start and --end');
  }

  const date = values.date || new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD, local
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail('--date must be YYYY-MM-DD');

  const options = {
    url: (values.url || process.env.VT_URL || '').replace(/\/+$/, ''),
    user: values.user || process.env.VT_USER,
    counts,
    femalePct: intOption(values, 'female-pct', { min: 0, max: 100, fallback: 50 }),
    setterPct: intOption(values, 'setter-pct', { min: 0, max: 100, fallback: 20 }),
    courts: intOption(values, 'courts', { min: 1, fallback: 3 }),
    matches: intOption(values, 'matches', { min: 1, fallback: 4 }),
    minTeam: intOption(values, 'min-team', { min: 1, fallback: 5 }),
    allowSeven: values['allow-seven'],
    prefix: values.prefix,
    location: values.location,
    date,
    setupOnly: values['setup-only'],
    dryRun: values['dry-run']
  };

  if (!options.dryRun) {
    if (!options.url) fail('--url (or VT_URL) is required');
    if (!/^https?:\/\//.test(options.url)) fail('--url must start with http:// or https://');
    if (!options.user) fail('--user (or VT_USER) is required');
  }

  return options;
}

// Fisher-Yates, so the female/setter split lands on random players rather than
// the first k of the list.
function shuffle(items) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function buildRoster(count, { femalePct, setterPct }) {
  const females = Math.round(count * femalePct / 100);
  const setters = Math.round(count * setterPct / 100);
  const genders = shuffle(Array.from({ length: count }, (_, i) => (i < females ? 'female' : 'male')));
  const setterFlags = shuffle(Array.from({ length: count }, (_, i) => i < setters));
  const width = String(count).length;

  return genders.map((gender, i) => ({
    name: `Test ${gender === 'female' ? 'F' : 'M'}${String(i + 1).padStart(width, '0')}`,
    gender,
    skillLevel: SKILL_LEVELS[Math.floor(Math.random() * SKILL_LEVELS.length)],
    isSetter: setterFlags[i]
  }));
}

function promptHidden(question) {
  return new Promise((resolve, reject) => {
    const { stdin, stdout } = process;
    if (!stdin.isTTY) {
      reject(new Error('no terminal to prompt for a password; set VT_PASSWORD'));
      return;
    }
    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let password = '';
    const onData = (char) => {
      if (char === '\r' || char === '\n' || char === '\u0004') {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener('data', onData);
        stdout.write('\n');
        resolve(password);
      } else if (char === '\u0003') {
        stdout.write('\n');
        process.exit(130);
      } else if (char === '\u007f' || char === '\b') {
        password = password.slice(0, -1);
      } else {
        password += char;
      }
    };
    stdin.on('data', onData);
  });
}

function createClient(baseUrl) {
  let token = null;

  async function request(method, path, body) {
    const response = await fetch(`${baseUrl}/api${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      // nginx error pages and the React index.html land here when --url is wrong
      data = { message: text.slice(0, 200) };
    }
    if (!response.ok) {
      throw new Error(`${method} ${path} → ${response.status}: ${data.message || response.statusText}`);
    }
    return data;
  }

  return {
    request,
    async login(username, password) {
      const data = await request('POST', '/auth/login', { username, password });
      if (!data.token) throw new Error('login response had no token; is --url pointing at the site?');
      token = data.token;
      return data.user;
    }
  };
}

// Small worker pool: one request at a time per tournament is slow over the
// internet, but firing all 45 at once is rude to a live server.
async function runLimited(items, limit, worker) {
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++];
      await worker(item);
    }
  });
  await Promise.all(runners);
}

async function createOne(client, count, options) {
  const roster = buildRoster(count, options);
  const females = roster.filter(p => p.gender === 'female').length;
  const result = { count, females, males: count - females, id: null, status: 'failed', note: '' };

  const tournament = await client.request('POST', '/tournaments', {
    name: `${options.prefix} ${count}p ${options.courts}c ${options.matches}m min${options.minTeam}`,
    date: options.date,
    location: options.location,
    courtsAvailable: options.courts,
    minPlayersPerTeam: options.minTeam,
    matchesPerPlayer: options.matches,
    allowSevenPlayerTeams: options.allowSeven
  });
  result.id = tournament.id;

  await runLimited(roster, PLAYER_CONCURRENCY, player =>
    client.request('POST', `/tournaments/${tournament.id}/players`, player));
  result.status = 'setup';

  if (options.setupOnly) return result;

  if (count < options.minTeam * 2) {
    result.note = `not started: needs at least ${options.minTeam * 2} players`;
    return result;
  }

  try {
    const started = await client.request('POST', `/tournaments/${tournament.id}/start`, {});
    result.status = 'in_progress';
    result.note = `${started.roundsGenerated} rounds, ${started.totalByePlayers} bye slots`;
  } catch (error) {
    // Left in setup so the failing roster can be inspected or regenerated in the UI
    result.note = `start failed: ${error.message}`;
  }
  return result;
}

async function main() {
  const options = readOptions();
  const { counts } = options;

  console.log(`${counts.length} tournament(s): ${counts[0]}${counts.length > 1 ? `–${counts[counts.length - 1]}` : ''} players, ` +
    `${options.femalePct}% female, ${options.courts} courts, ${options.matches} matches/player, ` +
    `min ${options.minTeam}/team${options.allowSeven ? ', 7-player teams allowed' : ''}` +
    `${options.setupOnly ? ', setup only' : ''}`);

  if (options.dryRun) {
    for (const count of counts) {
      const roster = buildRoster(count, options);
      const f = roster.filter(p => p.gender === 'female').length;
      const s = roster.filter(p => p.isSetter).length;
      console.log(`  ${count} players: ${f}F / ${count - f}M, ${s} setters`);
    }
    return;
  }

  const password = process.env.VT_PASSWORD || await promptHidden(`Password for ${options.user}: `);
  const client = createClient(options.url);
  await client.login(options.user, password);
  console.log(`Signed in to ${options.url} as ${options.user}\n`);

  const results = [];
  for (const count of counts) {
    process.stdout.write(`  ${String(count).padStart(3)} players … `);
    try {
      const result = await createOne(client, count, options);
      results.push(result);
      console.log(`#${result.id} ${result.status}${result.note ? ` (${result.note})` : ''}`);
    } catch (error) {
      results.push({ count, status: 'failed', note: error.message });
      console.log(`FAILED: ${error.message}`);
    }
  }

  const failed = results.filter(r => r.status === 'failed' || r.note.startsWith('start failed'));
  console.log(`\nDone: ${results.length - failed.length} ok, ${failed.length} with problems.`);
  if (failed.length) process.exitCode = 1;
}

main().catch(error => {
  console.error(`Error: ${error.message}`);
  process.exit(1);
});
