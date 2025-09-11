const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const pool = require('../database/db');
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
        
        console.log('Migration completed successfully!');
      } else {
        console.log('✓ Bye team support already exists');
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
      const hashedPassword = await bcrypt.hash(process.env.SUPER_ADMIN_PASSWORD, 10);
      
      const result = await client.query(`
        INSERT INTO users (username, password_hash, is_super_admin) 
        VALUES ($1, $2, true)
        ON CONFLICT (username) DO NOTHING
        RETURNING id
      `, [process.env.SUPER_ADMIN_USERNAME, hashedPassword]);
      
      if (result.rows.length > 0) {
        console.log(`✓ Super admin user '${process.env.SUPER_ADMIN_USERNAME}' created`);
      } else {
        console.log(`✓ Super admin user '${process.env.SUPER_ADMIN_USERNAME}' already exists`);
      }
    } else {
      console.log('⚠ No super admin credentials in environment variables');
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
