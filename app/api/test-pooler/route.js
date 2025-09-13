// app/api/test-pooler/route.js
// Test direct PostgreSQL connection using transaction pooler

import { NextResponse } from 'next/server'
import { queryDirect, testConnection } from '@/lib/directDb'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET - Test direct database connection via transaction pooler
export async function GET(request) {
  try {
    console.log('Testing direct database connection...')
    
    // Test basic connection and get port info
    const connectionTest = await testConnection()
    
    if (!connectionTest.success) {
      return NextResponse.json({
        ok: false,
        error: 'Connection failed',
        details: connectionTest.error,
        message: connectionTest.message
      }, { status: 500 })
    }

    // Run additional test queries
    const testResults = {
      timestamp: new Date().toISOString(),
      connection: connectionTest,
      tests: {}
    }

    // Test 1: Check current database info
    try {
      const dbInfo = await queryDirect(`
        SELECT 
          current_database() as database_name,
          current_user as current_user,
          inet_server_port() as server_port,
          version() as version
      `)
      
      testResults.tests.databaseInfo = {
        success: true,
        data: dbInfo.rows[0]
      }
    } catch (error) {
      testResults.tests.databaseInfo = {
        success: false,
        error: error.message
      }
    }

    // Test 2: Check connection count
    try {
      const connectionCount = await queryDirect(`
        SELECT 
          count(*) as active_connections,
          max(backend_start) as oldest_connection
        FROM pg_stat_activity 
        WHERE state = 'active'
      `)
      
      testResults.tests.connectionCount = {
        success: true,
        data: connectionCount.rows[0]
      }
    } catch (error) {
      testResults.tests.connectionCount = {
        success: false,
        error: error.message
      }
    }

    // Test 3: Simple table query (if tables exist)
    try {
      const tableTest = await queryDirect(`
        SELECT COUNT(*) as member_count 
        FROM members 
        LIMIT 1
      `)
      
      testResults.tests.tableQuery = {
        success: true,
        data: tableTest.rows[0]
      }
    } catch (error) {
      testResults.tests.tableQuery = {
        success: false,
        error: error.message,
        note: 'Table may not exist - this is optional'
      }
    }

    // Overall assessment - check if we're using the pooler by examining the connection string
    const dbUrl = process.env.SUPABASE_DB_URL || ''
    const isUsingPooler = dbUrl.includes('pooler.supabase.com:6543')
    const poolerHost = dbUrl.includes('pooler.supabase.com')
    
    const allTestsPassed = Object.values(testResults.tests)
      .filter(test => test.hasOwnProperty('success'))
      .every(test => test.success)

    testResults.overall = {
      success: allTestsPassed,
      port: connectionTest.port, // This will be 5432 (internal PostgreSQL port)
      poolerActive: isUsingPooler,
      connectionString: dbUrl.substring(0, 80) + '...', // Show part of connection string
      message: isUsingPooler 
        ? '✅ Successfully connected via transaction pooler (pooler.supabase.com:6543)'
        : poolerHost 
          ? '✅ Connected via pooler host but check port configuration'
          : '⚠️ Not using transaction pooler - connected directly to database'
    }

    console.log('Direct database test completed:', testResults.overall.message)

    return NextResponse.json({
      ok: true,
      ...testResults
    })

  } catch (error) {
    console.error('Direct database test error:', error)
    return NextResponse.json({
      ok: false,
      error: 'Test failed',
      details: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}