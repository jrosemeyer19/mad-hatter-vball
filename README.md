# Mad Hatter Volleyball Tournament Manager

A full-stack web app for running Mad Hatter (mixer) volleyball tournaments — the format where teams are
redrawn every round so nobody plays with the same people twice, and players are ranked individually
rather than as a team.

The hard part of that format is the draw: every round needs teams that are balanced by skill, by
gender, and at the net, without repeating teammates, while keeping every player's match count equal.
This app does that draw, then acts as the live scoreboard for the day — the director shares one link
and players enter their own scores from their phones between matches.

## Features

**Tournament setup**
- Roster management with gender, skill level (AA / A / BB / B), and setter flag per player
- Configurable courts, minimum team size, and matches per player
- Optional entry fee and director cost for prize-pool math
- Opt-in 7-player teams (off by default — an extra round of byes is usually preferred)
- Reserve a specific player for a bye in the final round

**Team generation** — see [How the draw works](#how-the-draw-works)
- Skill and gender balancing on a gender-weighted rating scale
- Net-strength balancing, so two teams with equal totals can't have lopsided front rows
- Female setter distribution across teams
- Teammate-rotation tracking, so players see new teammates each round
- Bye teams for odd player counts, with byes spread fairly across the roster
- Court assignment spread across rounds, so nobody spends the whole day on the same court

**Running the day**
- Round-by-round view with courts, matchups, and per-match balance readouts
- One-page printable schedule — a round × court grid for the wall, plus a player × round lookup so everyone can find their own name
- Two games per match; game 2 is optional
- Live leaderboard, ranked separately for men and women
- Score entry is public by design — no login needed on a player's phone
- Tap any player's name for a popup of their whole day — court, team, teammates, and result for every round
- Final standings with automatic payout calculation
- Tournament history for past events

**Admin**
- JWT login for tournament directors
- Super admin role for user management
- Entry fee, director cost, and payouts are stripped from API responses for anonymous visitors — the
  numbers never reach a player's browser, they aren't just hidden in the UI

## Tech stack

| Layer | Stack |
| --- | --- |
| Frontend | React 18, React Router 6, Axios (port 3000 in dev) |
| Backend | Node.js 16+, Express 4 (port 5000) |
| Database | PostgreSQL |
| Auth | JWT, bcryptjs |
| Production | Express serves the React build; Nginx reverse proxy |

## Quick start

**Prerequisites:** Node.js 16+, PostgreSQL, npm.

```bash
# 1. Create the database
createdb volleyball_tournament

# 2. Backend
cd backend
npm install
cp .env.template .env       # then edit .env — see Configuration below
npm run init-db             # creates the schema + default super admin
npm run dev                 # http://localhost:5000

# 3. Frontend (in a second terminal)
cd frontend
npm install
npm start                   # http://localhost:3000, proxies /api to :5000
```

Log in with the `SUPER_ADMIN_USERNAME` / `SUPER_ADMIN_PASSWORD` you set in `.env`.

### Configuration

`backend/.env`, copied from `backend/.env.template`:

| Variable | Purpose |
| --- | --- |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | PostgreSQL connection |
| `JWT_SECRET` | Signing key for auth tokens — change this in production |
| `PORT` | Backend port (default 5000) |
| `NODE_ENV` | Set to `production` to have Express serve `frontend/build` |
| `SUPER_ADMIN_USERNAME`, `SUPER_ADMIN_PASSWORD` | Super admin created on first `init-db` |

`npm run init-db` is safe to re-run. On a fresh database it applies `database/schema.sql`; on an
existing one it detects what's missing and runs only the needed migrations, so it doubles as the
upgrade step after pulling changes.

## How a tournament runs

1. **Setup** — the director creates the tournament and enters the roster. Status: `setup`.
2. **Start** — `POST /:id/start` runs the generator for the whole day at once: every round's teams,
   matchups, and courts are written to the database up front. Status: `in_progress`.
3. **Play** — players open the tournament link on their phones and enter scores as matches finish.
   Player totals and the leaderboard update as scores land.
4. **Complete** — the director closes the tournament. Status: `completed`, and the results page
   shows final standings and payouts.

If a draw looks wrong before play starts, `POST /:id/regenerate` throws it away and redraws.

**Scoring:** each match is two games (game 2 optional), scores 0–50. A player's total is the sum of
the points their teams scored; point differential is the tiebreak. Standings are ranked separately
within each gender.

**Payouts:** the pool is `entry_fee × players − director_cost`. First place takes 30%, second 15%,
third 5%, rounded down to the nearest $5 — paid out in both the men's and women's divisions.

## How the draw works

`backend/utils/teamGenerator.js` is the heart of the project. It generates every round in one pass so
it can optimize across the whole day rather than one round at a time.

**Skill ratings are gender-weighted.** A men's-height net means a male and female player of the same
nominal level don't contribute equally to a team's strength, so gender is baked directly into the
rating scale instead of being balanced as a separate count:

| | AA | A | BB | B |
| --- | --- | --- | --- | --- |
| Male | 5.0 | 3.8 | 2.6 | 1.7 |
| Female | 3.0 | 2.2 | 1.5 | 1.0 |

Setters get a further 15% bonus on top of their base rating.

**Net strength is balanced separately.** Two teams can carry identical total ratings while one has
AA+A at the net and the other has B+B, with the women's side making up the total. Tracking male skill
on its own is what makes that imbalance visible, so it's scored as its own metric.

**Setter distribution targets female setters.** On a men's net the female setter is the scarce,
schedule-driving role, so that's what gets spread across teams and protected when byes are assigned.

**Teammate rotation.** The generator tracks who has already played with whom and penalizes repeats,
which is the whole point of the Mad Hatter format. It also tracks which strong players have carried B
players, so the same person isn't stuck propping up a weak team all day.

**Byes and odd counts.** When the roster doesn't divide evenly, extra players become a bye team for
that round, spread so no one sits out more than their share. A specific player can be reserved for
the final-round bye (for someone who has to leave early). Rosters that don't fit cleanly — 37 players
being the classic case — get dedicated handling, and 7-player teams can be enabled to avoid an extra
round of byes.

**Court assignment.** Courts aren't equal at most facilities — one is always the bad one. Rather than
letting court numbers fall out of team numbering (which parks the same players on the same court all
day), courts are assigned across the whole schedule with a squared repeat penalty, then refined until
no round improves. Round 1 comes out purely random, since nobody has a history yet. This only changes
the sign above the match, never who plays whom.

Generation logs a readable trace to the backend console — team composition, balance metrics, and a
`=== Court Assignment ===` block summarizing court spread. That trace is the fastest way to see why
the generator made a given choice.

## API

Tournament viewing and score entry are intentionally public; everything else needs a bearer token.

| Method | Endpoint | Auth |
| --- | --- | --- |
| `POST` | `/api/auth/login` | — |
| `GET` | `/api/auth/verify` | required |
| `POST` | `/api/auth/change-password` | required (own account) |
| `GET` | `/api/tournaments` | optional (`can_manage` per row) |
| `GET` | `/api/tournaments/:id` | optional (financials omitted when anonymous) |
| `GET` | `/api/tournaments/:id/results` | optional (payouts omitted when anonymous) |
| `PUT` | `/api/tournaments/:id/matches/:matchId/scores` | — (players score their own matches) |
| `GET` | `/api/tournaments/:id/score-events` | manager |
| `GET` | `/api/tournaments/history` | required |
| `POST` | `/api/tournaments` | required |
| `PUT` | `/api/tournaments/:id` | manager |
| `DELETE` | `/api/tournaments/:id` | manager |
| `GET` | `/api/tournaments/:id/roster-sources` | manager |
| `POST` | `/api/tournaments/:id/players` | manager |
| `POST` | `/api/tournaments/:id/players/copy` | manager (of both tournaments) |
| `POST` | `/api/tournaments/:id/players/:playerId/withdraw` | manager |
| `PUT` | `/api/tournaments/:id/players/:playerId` | manager |
| `DELETE` | `/api/tournaments/:id/players/:playerId` | manager |
| `POST` | `/api/tournaments/:id/start` | manager |
| `POST` | `/api/tournaments/:id/regenerate` | manager |
| `POST` | `/api/tournaments/:id/complete` | manager |
| `GET`/`POST`/`DELETE` | `/api/users`, `/api/users/:id` | super admin |
| `PUT` | `/api/users/:id/password` | super admin (reset someone else's) |

### Score change log

Score entry is open by design — players enter their own results from the share link — which means an
already-final match can be silently overwritten and two people can submit the same match at once.
Every submission is therefore recorded in `match_score_events` with the values it replaced, and
directors get a **Score log** tab showing the history newest-first, with changes that replaced a
final match tinted.

What "who" can mean here is limited, and the UI says so: a signed-in director is recorded by name,
while an anonymous scorer is identified only by client IP and `device_label` — an opaque per-browser
id the scoring page sends as `X-Scorer-Id`. Everyone in a gym shares one public IP, so the device id
is what actually separates two phones; neither is authenticated, so both are a hint for tracing an
honest mistake, not proof. `app.set('trust proxy', 'loopback')` in `server.js` is what makes the
recorded IP the real client rather than nginx on localhost.

The log is written inside the same transaction as the score itself, so it can never disagree with the
scores it describes, and the match row is taken with `FOR UPDATE` so two simultaneous submissions
serialise instead of each reversing the other's point award.

### When a player drops out mid-tournament

Everyone at these events is playing, so there is no substitute to bring in. Withdrawing a player
therefore removes them from every match still unplayed and **rebalances those teams** rather than
leaving one side both a player short and weakened by exactly whoever left.

Why that matters: one player leaving a 30-player, 3-court draw is arithmetically catastrophic if you
re-solve it. Three courts need six teams of at least five, so 29 players cannot fill them — the
generator drops to two courts, gains a round, and puts five or six people on bye *every* round.
Rebalancing instead keeps the draw exactly as generated and only changes who stands on which side.

- **Nobody else's match count moves.** Players are only swapped between teams already playing the
  same round, so every remaining player keeps the slots they were scheduled for. Nobody is promoted
  off a bye either — standings are cumulative points, so an extra match is an advantage.
- **Scored matches are frozen.** Only teams whose match is still unplayed are touched. Scoring awards
  points by joining `team_players` and a re-score reverses that award, so moving a player off a
  scored team would corrupt totals.
- **Rounds, courts and who-plays-whom never change.** This is not a re-solve; the court spreading
  survives intact.
- **The floor is `min_players_per_team - 1`.** Initial generation never goes below the configured
  minimum (`canFormTeams` requires it), so a short team can only ever arise from a withdrawal. If a
  withdrawal would take a team below the floor, it is refused *before any write* and the director is
  pointed at regenerating for the reduced roster.
- **One-way.** A player who comes back cannot recover the matches their team played without them.

Withdrawn players keep the standings place their points earned and are shown with a `withdrew`
marker, but are not payout-eligible: `payout_rank` is ranked over eligible players only, so prize
money slides to the next person who played the whole tournament. They still count toward the entry
pool — they paid. `backend/utils/rosterRebalance.js` holds the algorithm.

In practice, on a 30-player draw losing its strongest player, the worst court skill gap goes from
about 4.5 down to under 1 — better balanced than many intact tournaments.

### Reusing a roster

Players belong to a single tournament (`players.tournament_id`), so **Copy Players From a Previous
Tournament** on the setup screen brings a roster forward instead of re-entering forty people. It
copies name, gender, skill level, and setter flag; points, matches played, and point differential
start fresh.

The copy is a single `INSERT ... SELECT`, so a full roster is one round trip. `DISTINCT ON` collapses
names duplicated within the source, and an anti-join drops anyone already on the target's list,
compared case-insensitively — so running it twice, or after adding a few people by hand, adds each
person exactly once and leaves the existing spelling alone. The response reports how many were added
and how many were skipped.

Only tournaments you could manage yourself are offered as sources, and the copy re-checks that on
the way in. Skill ratings are director-only, so without that rule this would be a way to lift
another director's ratings out of their event.

### Who can manage a tournament

Creating a tournament makes you its director. By default nobody else signed in can edit it, add or
remove players, generate teams, or delete it — only you and super admins. Checking **allow other
users to manage this tournament** on the setup screen opens it to every signed-in user, for an event
run by more than one person.

The sharing checkbox is owner-only even while the tournament is shared, so a co-manager cannot lock
the director out of their own event or reopen one the director closed. A co-manager's submitted value
for that field is ignored server-side, not just disabled in the form.

`allow_shared_management` defaults to FALSE, including for tournaments that already existed when the
column was added — those become manageable only by their creator. Rows with a NULL `created_by` end
up super-admin only, and `init-db` warns if it finds any.

Score entry is unaffected: `PUT /api/tournaments/:id/matches/:matchId/scores` stays open, because
players enter their own scores from the shared link. `GET /api/tournaments/:id` reports `can_manage`
and `can_toggle_sharing` for the requesting user, and the tournament list reports `can_manage` per
row, so the UI only offers buttons that will actually work. `backend/middleware/tournamentAccess.js`
holds the rules.

### Passwords

At least 9 characters, including 3 of these 4: uppercase letter, lowercase letter, number, symbol.
Passwords that contain the username, or that appear in a short list of obvious choices, are refused.
`backend/utils/passwordPolicy.js` is the authoritative copy of these rules;
`frontend/src/utils/passwordPolicy.js` mirrors them so the form can tick requirements off as you
type, and must be kept in step.

Changing or resetting a password signs that account out everywhere. Tokens carry the
`password_changed_at` they were issued against, so any token minted against the old password stops
working — the change form swaps in a replacement so the tab you are using stays signed in. Accounts
have no email address, so a forgotten password is recovered by a super admin resetting it rather than
by a mail link.

Failed logins are throttled per account (10 per 15 minutes) and so are password changes. The counters
live in the app process, so they reset on restart and are not shared if the app is ever run on more
than one box.

## Project structure

```
backend/
├── server.js                 # Express entry; serves the React build in production
├── routes/
│   ├── auth.js               # Login, token verification, password change
│   ├── tournaments.js        # Tournament CRUD, generation, scoring, results
│   └── users.js              # User management (super admin only)
├── middleware/auth.js        # authenticateToken, optionalAuth, requireSuperAdmin
├── middleware/rateLimit.js   # Per-account throttling for the password endpoints
├── middleware/tournamentAccess.js  # Who may manage a given tournament
├── utils/passwordPolicy.js   # Password rules (authoritative copy)
├── utils/rosterRebalance.js  # Re-spreads teams after a mid-tournament withdrawal
├── utils/teamGenerator.js    # The draw: balancing, rotation, byes, courts
├── scripts/initDb.js         # Schema creation + incremental migrations
└── database/
    ├── db.js                 # PostgreSQL pool
    └── schema.sql            # Table definitions

frontend/src/
├── App.js                    # Routing + axios auth defaults
└── components/
    ├── TournamentList.js     # Active tournaments
    ├── TournamentDetail.js   # Rounds, score entry, leaderboard, results
    ├── TournamentSetup.js    # Creation, settings, roster
    ├── TournamentHistory.js  # Past tournaments
    ├── UserManagement.js     # Admin user CRUD
    └── tournament/           # RoundView, MatchCard, Leaderboard, ResultsPanel, ...

nginx/volleyball-tournament.conf   # Sample reverse-proxy config
```

**Database tables:** `users`, `tournaments`, `players`, `rounds`, `teams`, `team_players`, `matches`,
`match_score_events`.
Tournaments move `setup` → `in_progress` → `completed`.

## Deployment

Express serves the compiled React app when `NODE_ENV=production`, so a single Node process can run
the whole thing behind Nginx (sample config in `nginx/`).

```bash
git pull origin main
cd backend  && npm install
cd ../frontend && npm install && npm run build
cd ../backend && npm run init-db      # applies any new migrations
# restart the node process (pm2 / systemd / however it's supervised)
```

`node_modules/`, `frontend/build/`, `package-lock.json`, and `.env` are not tracked — dependencies are
installed and the frontend is built on the server.

## License

Copyright © 2026 Jeff Rosemeyer.

Licensed under the [GNU Affero General Public License v3.0 or later](LICENSE).
You are free to use, run, modify, and share this software. If you distribute a
modified version — **including running one as a network service** — you must
release your source under the same license and keep the copyright notice
intact. That network clause is the whole reason for choosing AGPL over GPL: a
tournament app is something people host rather than ship.

The project name is not covered by that grant. A fork is welcome; calling it
"Jeff's Mad Hatter Machine" is not.
