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
- Two games per match; game 2 is optional
- Live leaderboard, ranked separately for men and women
- Score entry is public by design — no login needed on a player's phone
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
| `GET` | `/api/tournaments` | — |
| `GET` | `/api/tournaments/:id` | optional (financials omitted when anonymous) |
| `GET` | `/api/tournaments/:id/results` | optional (payouts omitted when anonymous) |
| `PUT` | `/api/tournaments/:id/matches/:matchId/scores` | — (players score their own matches) |
| `GET` | `/api/tournaments/history` | required |
| `POST` | `/api/tournaments` | required |
| `PUT` | `/api/tournaments/:id` | required |
| `DELETE` | `/api/tournaments/:id` | required |
| `POST` | `/api/tournaments/:id/players` | required |
| `PUT` | `/api/tournaments/:id/players/:playerId` | required |
| `DELETE` | `/api/tournaments/:id/players/:playerId` | required |
| `POST` | `/api/tournaments/:id/start` | required |
| `POST` | `/api/tournaments/:id/regenerate` | required |
| `POST` | `/api/tournaments/:id/complete` | required |
| `GET`/`POST`/`DELETE` | `/api/users`, `/api/users/:id` | super admin |

## Project structure

```
backend/
├── server.js                 # Express entry; serves the React build in production
├── routes/
│   ├── auth.js               # Login + token verification
│   ├── tournaments.js        # Tournament CRUD, generation, scoring, results
│   └── users.js              # User management (super admin only)
├── middleware/auth.js        # authenticateToken, optionalAuth, requireSuperAdmin
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

**Database tables:** `users`, `tournaments`, `players`, `rounds`, `teams`, `team_players`, `matches`.
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
