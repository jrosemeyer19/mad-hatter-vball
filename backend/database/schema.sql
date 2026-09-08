-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_super_admin BOOLEAN DEFAULT FALSE,
    -- NULL means the password has never been changed. Any JWT issued before
    -- this timestamp is rejected, so a password change signs out other devices.
    password_changed_at TIMESTAMP,
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
    -- Off by default: an extra round with byes is preferred over a 7-player
    -- team, where someone rotates off the court every rotation.
    allow_seven_player_teams BOOLEAN DEFAULT FALSE,
    entry_fee DECIMAL(10,2) DEFAULT 0,
    director_cost DECIMAL(10,2) DEFAULT 0,
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
    skill_level VARCHAR(2) NOT NULL, -- 'AA', 'A', 'BB', 'B'
    is_setter BOOLEAN DEFAULT FALSE,
    total_points INTEGER DEFAULT 0,
    matches_played INTEGER DEFAULT 0
);

-- Rounds table
CREATE TABLE rounds (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER REFERENCES tournaments(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL
);

-- Teams table (UPDATED for bye team support)
CREATE TABLE teams (
    id SERIAL PRIMARY KEY,
    round_id INTEGER REFERENCES rounds(id) ON DELETE CASCADE,
    team_number INTEGER NOT NULL,
    court INTEGER, -- Made nullable for bye teams
    is_bye_team BOOLEAN DEFAULT FALSE -- New column for bye teams
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
CREATE INDEX idx_teams_bye_team ON teams(is_bye_team); -- New index for bye teams
CREATE INDEX idx_matches_round ON matches(round_id);

-- Add comments for documentation
COMMENT ON COLUMN teams.is_bye_team IS 'Indicates if this team represents players on bye (not playing this round)';
COMMENT ON COLUMN teams.court IS 'Court number for playing teams, NULL for bye teams';
