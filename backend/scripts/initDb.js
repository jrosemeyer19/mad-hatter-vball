const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const pool = require('../database/db');
const { validatePassword, RULES_TEXT } = require('../utils/passwordPolicy');
require('dotenv').config();

async function checkTableExists(tableName) {
  try {
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      )
    `, [tableName]);
    return result.rows[0].exists;
  } catch (error) {
    console.error(`Error checking if table ${tableName} exists:`, error);
    return false;
  }
}

async function checkColumnExists(tableName, columnName) {
  try {
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = $1 
        AND column_name = $2
      )
    `, [tableName, columnName]);
    return result.rows[0].exists;
  } catch (error) {
    console.error(`Error checking if column ${tableName}.${columnName} exists:`, error);
    return false;
  }
}

async function runMigrations() {
  console.log('Checking for required database migrations...');
  
  try {
    // Check if teams table exists and has the bye team column
    const teamsExists = await checkTableExists('teams');
    if (teamsExists) {
      const byeColumnExists = await checkColumnExists('teams', 'is_bye_team');
      
      if (!byeColumnExists) {
        console.log('Adding bye team support to existing database...');
        
        // Add is_bye_team column
        await pool.query(`
          ALTER TABLE teams 
          ADD COLUMN is_bye_team BOOLEAN DEFAULT FALSE
        `);
        console.log('✓ Added is_bye_team column');
        
        // Make court column nullable
        await pool.query(`
          ALTER TABLE teams 
          ALTER COLUMN court DROP NOT NULL
        `);
        console.log('✓ Made court column nullable');
        
        // Add index
        await pool.query(`
          CREATE INDEX IF NOT EXISTS idx_teams_bye_team ON teams(is_bye_team)
        `);
        console.log('✓ Added index on is_bye_team');
        
        // Add comments
        await pool.query(`
          COMMENT ON COLUMN teams.is_bye_team IS 'Indicates if this team represents players on bye (not playing this round)'
        `);
        await pool.query(`
          COMMENT ON COLUMN teams.court IS 'Court number for playing teams, NULL for bye teams'
        `);
        console.log('✓ Added column comments');
        
        console.log('Bye team migration completed successfully!');
      } else {
        console.log('✓ Bye team support already exists');
      }
    }

    // Check for point differential column
    const playersExists = await checkTableExists('players');
    if (playersExists) {
      const differentialColumnExists = await checkColumnExists('players', 'point_differential');
      
      if (!differentialColumnExists) {
        console.log('Adding point differential support to existing database...');
        
        // Add point_differential column
        await pool.query(`
          ALTER TABLE players 
          ADD COLUMN point_differential INTEGER DEFAULT 0
        `);
        console.log('✓ Added point_differential column');
        
        // Add index for performance
        await pool.query(`
          CREATE INDEX IF NOT EXISTS idx_players_point_differential ON players(point_differential)
        `);
        console.log('✓ Added index on point_differential');
        
        // Add comment
        await pool.query(`
          COMMENT ON COLUMN players.point_differential IS 'Running total of point differential for the player (points scored minus points allowed)'
        `);
        console.log('✓ Added column comment');
        
        console.log('Point differential migration completed successfully!');
      } else {
        console.log('✓ Point differential support already exists');
      }
    }

    // Check for the mid-tournament withdrawal flag
    if (await checkTableExists('players')) {
      const withdrawnExists = await checkColumnExists('players', 'is_withdrawn');

      if (!withdrawnExists) {
        console.log('Adding player withdrawal support to existing database...');

        await pool.query(`
          ALTER TABLE players
          ADD COLUMN is_withdrawn BOOLEAN DEFAULT FALSE
        `);
        console.log('✓ Added is_withdrawn column');

        await pool.query(`
          COMMENT ON COLUMN players.is_withdrawn IS 'Set when a player leaves partway through a tournament. They keep earned points and stay in the standings but are not payout-eligible, and are removed from the teams of any match still unplayed.'
        `);
        console.log('✓ Added column comment');

        console.log('Player withdrawal migration completed successfully!');
      } else {
        console.log('✓ Player withdrawal support already exists');
      }
    }

    // Check for the password change timestamp
    const usersExists = await checkTableExists('users');
    if (usersExists) {
      const passwordChangedExists = await checkColumnExists('users', 'password_changed_at');

      if (!passwordChangedExists) {
        console.log('Adding password change tracking to existing database...');

        // Added without a default on purpose. A DEFAULT would backfill every
        // existing row with "now" and sign everyone out at deploy time; NULL
        // instead reads as "never changed" and retires no tokens.
        await pool.query(`
          ALTER TABLE users
          ADD COLUMN password_changed_at TIMESTAMP
        `);
        console.log('✓ Added password_changed_at column');

        await pool.query(`
          COMMENT ON COLUMN users.password_changed_at IS 'When the password was last changed. JWTs issued before this are rejected, so a password change signs the user out of other devices. NULL means never changed.'
        `);
        console.log('✓ Added column comment');

        console.log('Password change tracking migration completed successfully!');
      } else {
        console.log('✓ Password change tracking already exists');
      }
    }

    // Check for the 7-player team opt-in
    const tournamentsExists = await checkTableExists('tournaments');
    if (tournamentsExists) {
      const sevenColumnExists = await checkColumnExists('tournaments', 'allow_seven_player_teams');

      if (!sevenColumnExists) {
        console.log('Adding 7-player team option to existing database...');

        // Defaults to FALSE so existing tournaments keep preferring byes
        await pool.query(`
          ALTER TABLE tournaments
          ADD COLUMN allow_seven_player_teams BOOLEAN DEFAULT FALSE
        `);
        console.log('✓ Added allow_seven_player_teams column');

        await pool.query(`
          COMMENT ON COLUMN tournaments.allow_seven_player_teams IS 'When true, the generator may build one or more 7-player teams to avoid an extra round of byes. Off by default.'
        `);
        console.log('✓ Added column comment');

        console.log('7-player team option migration completed successfully!');
      } else {
        console.log('✓ 7-player team option already exists');
      }

      // Check for the shared-management opt-in
      const sharedColumnExists = await checkColumnExists('tournaments', 'allow_shared_management');

      if (!sharedColumnExists) {
        console.log('Adding shared management option to existing database...');

        // FALSE for existing rows too: every tournament already in the
        // database becomes manageable only by whoever created it (plus super
        // admins), which is the point of the option.
        await pool.query(`
          ALTER TABLE tournaments
          ADD COLUMN allow_shared_management BOOLEAN DEFAULT FALSE
        `);
        console.log('✓ Added allow_shared_management column');

        await pool.query(`
          COMMENT ON COLUMN tournaments.allow_shared_management IS 'When true, any signed-in user may manage this tournament. Off by default, leaving it to its creator and super admins.'
        `);
        console.log('✓ Added column comment');

        // Rows with no creator would otherwise be manageable by super admins
        // only, with no way to hand them to anyone else.
        const orphaned = await pool.query('SELECT COUNT(*) FROM tournaments WHERE created_by IS NULL');
        if (Number(orphaned.rows[0].count) > 0) {
          console.log(`⚠  ${orphaned.rows[0].count} tournament(s) have no created_by and are now super-admin only`);
        }

        console.log('Shared management migration completed successfully!');
      } else {
        console.log('✓ Shared management option already exists');
      }
    }

  } catch (error) {
    console.error('Error during migration:', error);
    throw error;
  }
}

async function initializeDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('Initializing database...');
    
    // Check if database is already initialized
    const tablesExist = await checkTableExists('users');
    
    if (!tablesExist) {
      console.log('Creating database schema...');
      
      // Read and execute schema
      const schemaSQL = fs.readFileSync(path.join(__dirname, '../database/schema.sql'), 'utf8');
      await client.query(schemaSQL);
      console.log('✓ Database schema created successfully');
    } else {
      console.log('✓ Database schema already exists');
      
      // Run any necessary migrations
      await runMigrations();
    }

    // Create super admin user if environment variables are set
    if (process.env.SUPER_ADMIN_USERNAME && process.env.SUPER_ADMIN_PASSWORD) {
      const username = process.env.SUPER_ADMIN_USERNAME;

      // Checked before hashing so an existing install is never blocked by a
      // weak password left in .env — there is nothing to create in that case.
      const existing = await client.query('SELECT id FROM users WHERE username = $1', [username]);

      if (existing.rows.length > 0) {
        console.log(`✓ Super admin user '${username}' already exists`);
      } else {
        // The first account created is also the most privileged one, so it is
        // held to the same rules the app enforces everywhere else.
        const problems = validatePassword(process.env.SUPER_ADMIN_PASSWORD, { username });

        if (problems.length > 0) {
          console.error(`✗ SUPER_ADMIN_PASSWORD is not acceptable: ${problems[0]}`);
          console.error(`  ${RULES_TEXT}`);
          console.error('  Update SUPER_ADMIN_PASSWORD in your .env and run this again.');
          process.exit(1);
        }

        const hashedPassword = await bcrypt.hash(process.env.SUPER_ADMIN_PASSWORD, 10);

        await client.query(`
          INSERT INTO users (username, password_hash, is_super_admin) 
          VALUES ($1, $2, true)
          ON CONFLICT (username) DO NOTHING
        `, [username, hashedPassword]);

        console.log(`✓ Super admin user '${username}' created`);
        console.log('  Log in and change this password from the account menu.');
      }
    } else {
      console.log('⚠  No super admin credentials in environment variables');
      console.log('Set SUPER_ADMIN_USERNAME and SUPER_ADMIN_PASSWORD in your .env file');
    }
    
    console.log('Database initialization complete!');
    
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  initializeDatabase();
}

module.exports = { initializeDatabase, runMigrations };