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
│   ├── auth.js               # POST /api/auth/login, GET /api/auth/verify
│   ├── tournaments.js        # Tournament CRUD + team generation + scoring
│   └── users.js              # User management (super admin only)
├── middleware/auth.js        # JWT verification
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

- Skill level balancing (A, BB, B levels)
- Gender distribution with configurable weighting
- Setter distribution across teams
- Teammate rotation tracking across rounds (players shouldn't repeat teammates)
- Special handling for 37-player tournaments
- Bye team support for odd player counts

Recent commits have focused heavily on improving team balance fairness.

## Key Implementation Details

- JWT authentication with super admin role for user management
- Frontend proxy config in `frontend/package.json` routes `/api` to backend
- Production: Express serves React build, Nginx config in `nginx/`
- Players have: name, gender (male/female), skill_level (A/BB/B), is_setter flag
