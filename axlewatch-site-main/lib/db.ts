// Neon Postgres database connection
import { neon } from '@neondatabase/serverless';

// Get database URL from environment
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.warn('DATABASE_URL not set - database operations will fail in production');
}

// Create SQL client
export const sql = DATABASE_URL ? neon(DATABASE_URL) : null;

// Initialize database tables
export async function initDatabase() {
  if (!sql) {
    console.log('No database connection - skipping table initialization');
    return;
  }

  try {
    // Create users table
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at BIGINT NOT NULL,
        receivers TEXT[] DEFAULT '{}'
      )
    `;

    // Create sessions table
    await sql`
      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at BIGINT NOT NULL
      )
    `;

    // Create index on email for faster lookups
    await sql`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)
    `;

    // Create index on user_id for faster session lookups
    await sql`
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)
    `;

    console.log('Database tables initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database:', error);
  }
}
