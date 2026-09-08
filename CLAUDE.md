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
│   ├── tournaments.js        # Tournament CRUD + team generation + scoring
│   └── users.js              # User management (super admin only)
├── middleware/auth.js        # JWT verification
├── middleware/rateLimit.js   # Per-account throttling on password endpoints
├── middleware/tournamentAccess.js  # requireTournamentManager: creator/super admin/shared
├── utils/passwordPolicy.js   # Password rules (mirrored in frontend/src/utils/passwordPolicy.js)
├── utils/teamGenerator.js    # Team balancing algorithm
└── database/
    ├── db.js                 # PostgreSQL connection pool
    └── schema.sql            # Database schema
```

## Database Schema

Key tables: `users`, `tournaments`, `players`, `rounds`, `teams`, `team_players`, `matches`

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
- Passwords: min 9 chars, 3 of 4 character classes. Enforced by `backend/utils/passwordPolicy.js`;
  `frontend/src/utils/passwordPolicy.js` mirrors it for live form feedback and must stay in sync
- Tokens carry a `pwc` claim holding the `users.password_changed_at` they were signed against, so
  changing or resetting a password retires every token issued against the old one
- Frontend proxy config in `frontend/package.json` routes `/api` to backend
- Production: Express serves React build, Nginx config in `nginx/`
- Players have: name, gender (male/female), skill_level (AA/A/BB/B), is_setter flag
