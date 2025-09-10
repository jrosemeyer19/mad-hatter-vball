-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_super_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tournaments table
CREATE TABLE tournaments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    date DATE NOT NULL,
    location VARCHAR(100) NOT NULL,
    courts_available INTEGER DEFAULT 3,
    min_players_per_team INTEGER DEFAULT 5,
    matches_per_player INTEGER DEFAULT 4,
    entry_fee DECIMAL(10,2) DEFAULT 0,
    director_cost DECIMAL(10,2) DEFAULT 0,
    has_power_match BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'setup', -- 'setup', 'in_progress', 'completed'
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Players table
CREATE TABLE players (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER REFERENCES tournaments(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    gender VARCHAR(10) NOT NULL, -- 'male', 'female'
    skill_level VARCHAR(2) NOT NULL, -- 'A', 'BB', 'B'
    is_setter BOOLEAN DEFAULT FALSE,
    total_points INTEGER DEFAULT 0,
    matches_played INTEGER DEFAULT 0
);

-- Rounds table
CREATE TABLE rounds (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER REFERENCES tournaments(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL,
    is_power_round BOOLEAN DEFAULT FALSE
);

-- Teams table
CREATE TABLE teams (
    id SERIAL PRIMARY KEY,
    round_id INTEGER REFERENCES rounds(id) ON DELETE CASCADE,
    team_number INTEGER NOT NULL,
    court INTEGER NOT NULL
);

-- Team players junction table
CREATE TABLE team_players (
    id SERIAL PRIMARY KEY,
    team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    player_id INTEGER REFERENCES players(id) ON DELETE CASCADE
);

-- Matches table
CREATE TABLE matches (
    id SERIAL PRIMARY KEY,
    round_id INTEGER REFERENCES rounds(id) ON DELETE CASCADE,
    team1_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    team2_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    court INTEGER NOT NULL,
    team1_game1_score INTEGER,
    team1_game2_score INTEGER,
    team2_game1_score INTEGER,
    team2_game2_score INTEGER,
    is_completed BOOLEAN DEFAULT FALSE
);

-- Create indexes for performance
CREATE INDEX idx_tournaments_status ON tournaments(status);
CREATE INDEX idx_players_tournament ON players(tournament_id);
CREATE INDEX idx_rounds_tournament ON rounds(tournament_id);
CREATE INDEX idx_teams_round ON teams(round_id);
CREATE INDEX idx_matches_round ON matches(round_id);
