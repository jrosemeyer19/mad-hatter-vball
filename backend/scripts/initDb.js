const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const pool = require('../database/db');
require('dotenv').config();

async function initializeDatabase() {
  try {
    console.log('Initializing database...');
    
    // Read and execute schema
    const schemaSQL = fs.readFileSync(path.join(__dirname, '../database/schema.sql'), 'utf8');
    await pool.query(schemaSQL);
    console.log('Database schema created successfully');

    // Create super admin user
    const hashedPassword = await bcrypt.hash(process.env.SUPER_ADMIN_PASSWORD, 10);
    
    await pool.query(`
      INSERT INTO users (username, password_hash, is_super_admin) 
      VALUES ($1, $2, true)
      ON CONFLICT (username) DO NOTHING
    `, [process.env.SUPER_ADMIN_USERNAME, hashedPassword]);
    
    console.log(`Super admin user '${process.env.SUPER_ADMIN_USERNAME}' created/verified`);
    console.log('Database initialization complete!');
    
  } catch (error) {
    console.error('Error initializing database:', error);
  } finally {
    await pool.end();
  }
}

initializeDatabase();
