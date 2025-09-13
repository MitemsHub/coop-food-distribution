// lib/directDb.js
// Direct PostgreSQL connection using transaction pooler
import { Pool } from 'pg'

let pool = null

// Initialize connection pool
function getPool() {
  if (!pool) {
    const dbUrl = process.env.SUPABASE_DB_URL
    
    if (!dbUrl) {
      throw new Error('SUPABASE_DB_URL environment variable is not set')
    }
    
    pool = new Pool({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false },
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
    })

    // Handle pool errors
    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err)
    })
  }
  return pool
}

// Execute a query using the direct database connection
export async function queryDirect(text, params = []) {
  const client = await getPool().connect()
  try {
    const result = await client.query(text, params)
    return result
  } catch (error) {
    console.error('Direct database query error:', error)
    throw error
  } finally {
    client.release()
  }
}

// Test the connection and return port information
export async function testConnection() {
  try {
    const result = await queryDirect('SELECT inet_server_port() as port, version() as version')
    return {
      success: true,
      port: result.rows[0].port,
      version: result.rows[0].version,
      message: `Connected to PostgreSQL on port ${result.rows[0].port}`
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: 'Failed to connect to direct database'
    }
  }
}

// Close the pool (useful for cleanup)
export async function closePool() {
  if (pool) {
    await pool.end()
    pool = null
  }
}