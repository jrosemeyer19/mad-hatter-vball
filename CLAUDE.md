# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack volleyball tournament management system with team generation and scoring.

- **Backend**: Node.js + Express + PostgreSQL (port 5000)
- **Frontend**: React 18 with React Router (port 3000, proxies to backend)

## Common Commands

### Backend (from `/backend`)
```bash
npm install          # Install dependencies
npm run dev          # Development with nodemon
npm start            # Production
npm run init-db      # Initialize database schema + default admin
```

### Frontend (from `/frontend`)
```bash
npm install          # Install dependencies
npm start            # Dev server (proxies API to :5000)
npm run build        # Production build
npm test             # Run tests
```

### Environment Setup
Copy `backend/.env.template` to `backend/.env` and configure PostgreSQL connection and JWT_SECRET.

## Architecture

```
frontend/src/
├── App.js                    # Routing
├── components/
│   ├── TournamentDetail.js   # Main tournament view + scoring + leaderboard
│   ├── TournamentSetup.js    # Tournament creation/editing + player management
│   ├── TournamentList.js     # Tournament listings
│   └── UserManagement.js     # Admin user CRUD

backend/
├── server.js                 # Express app entry
├── routes/
│   ├── auth.js               # POST /api/auth/login, GET /api/auth/verify, POST /api/auth/change-password
│   ├── tournaments.js        # Tournament CRUD + team generation + scoring + roster copy
│   └── users.js              # User management (super admin only)
├── middleware/auth.js        # JWT verification
├── middleware/rateLimit.js   # Per-account throttling on password endpoints
├── middleware/tournamentAccess.js  # requireTournamentManager: creator/super admin/shared
├── utils/passwordPolicy.js   # Password rules (mirrored in frontend/src/utils/passwordPolicy.js)
├── utils/rosterRebalance.js  # Post-withdrawal rebalancing (does NOT call the generator)
├── utils/standings.js        # Shared standings query + payout split
├── utils/teamGenerator.js    # Team balancing algorithm
└── database/
    ├── db.js                 # PostgreSQL connection pool
    └── schema.sql            # Database schema
```

## Database Schema

Key tables: `users`, `tournaments`, `players`, `rounds`, `teams`, `team_players`, `matches`,
`match_score_events`

Tournaments have status: `setup` → `in_progress` → `completed`

## Team Generation Algorithm

The `backend/utils/teamGenerator.js` is the most complex part of the codebase (~97KB). It handles:

- Skill level balancing (AA, A, BB, B levels)
- Gender distribution with configurable weighting
- Setter distribution across teams
- Teammate rotation tracking across rounds (players shouldn't repeat teammates)
- Special handling for 37-player tournaments
- Bye team support for odd player counts

Recent commits have focused heavily on improving team balance fairness.

## Key Implementation Details

- JWT authentication with super admin role for user management
- Tournament management is restricted to the creator (`tournaments.created_by`) and super admins.
  `tournaments.allow_shared_management` (default FALSE) opens it to any signed-in user; only the
  creator or a super admin may change that flag. Guard is `requireTournamentManager`, applied to the
  8 management routes; score entry stays public and reads stay `optionalAuth`
- A running tournament polls `GET /api/tournaments/:id` every 20s (`POLL_INTERVAL_MS` in
  `TournamentDetail.js`). Polling pauses on any unsubmitted score input (not just `editingMatch` —
  fresh matches render fields inline without setting it), skips hidden tabs, refreshes on
  visibilitychange, discards out-of-order responses via a `fetchSeq` ref, and fails silently for
  background fetches. Only `in_progress` polls
- `utils/standings.js` owns the standings query and payout split; both `POST /:id/complete` and
  `GET /:id/results` use it. They previously had separate copies and drifted
- Scoring is refused on a `completed` tournament unless the requester can manage it
- Route params are validated numeric via `router.param`, so a bad id is a 400 rather than a
  Postgres type error surfacing as a 500
- Validation and status checks run BEFORE `client.query('BEGIN')` in every transactional route. An
  early `return` after BEGIN releases the client to the pool with the transaction still open
- Every score submission is logged to `match_score_events` with the values it replaced, inside the
  same transaction as the score. `GET /api/tournaments/:id/score-events` is manager-only and backs a
  director-only "Score log" tab. Scoring needs no account, so identity is a signed-in director's
  username, else client IP plus an unauthenticated per-browser `X-Scorer-Id`. The match row is taken
  `FOR UPDATE` so concurrent submissions serialise
- Mid-tournament withdrawal (`POST /api/tournaments/:id/players/:playerId/withdraw`) drops a player
  from unplayed matches and rebalances those teams via `utils/rosterRebalance.js`. Swaps only, so no
  other player's match count changes; scored matches are frozen; floor is `min_players_per_team - 1`
  and is refused before any write. One-way. Withdrawn players stay ranked but are payout-ineligible
- Rosters are per-tournament; `POST /api/tournaments/:id/players/copy` brings one forward from
  another tournament the user manages. Dedupes case-insensitively against the target, so it is safe
  to re-run. Sources are restricted to manageable tournaments because skill ratings are director-only
- Passwords: min 9 chars, 3 of 4 character classes. Enforced by `backend/utils/passwordPolicy.js`;
  `frontend/src/utils/passwordPolicy.js` mirrors it for live form feedback and must stay in sync
- Tokens carry a `pwc` claim holding the `users.password_changed_at` they were signed against, so
  changing or resetting a password retires every token issued against the old one
- Frontend proxy config in `frontend/package.json` routes `/api` to backend
- Production: Express serves React build, Nginx config in `nginx/`
- Players have: name, gender (male/female), skill_level (AA/A/BB/B), is_setter flag
