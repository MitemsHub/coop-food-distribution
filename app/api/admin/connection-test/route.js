// app/api/admin/connection-test/route.js
// Test Supabase connection and transaction pool functionality

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateSession } from '@/lib/validation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET - Test Supabase connection and transaction pool
export async function GET(request) {
  try {
    // Validate admin session
    const sessionResult = await validateSession(request, 'admin')
    if (!sessionResult.valid) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' }, 
        { status: 401 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const dbUrl = process.env.SUPABASE_DB_URL

    // Check environment variables
    const envCheck = {
      supabaseUrl: !!supabaseUrl,
      serviceKey: !!serviceKey,
      dbUrl: !!dbUrl
    }

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({
        ok: false,
        error: 'Missing Supabase environment variables',
        env: envCheck
      }, { status: 500 })
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      db: {
        schema: 'public'
      }
    })

    const testResults = {
      timestamp: new Date().toISOString(),
      environment: envCheck,
      tests: {}
    }

    // Test 1: Basic connection
    try {
      const { data, error } = await supabase
        .from('members')
        .select('count')
        .limit(1)
      
      testResults.tests.basicConnection = {
        success: !error,
        error: error?.message,
        hasData: !!data
      }
    } catch (err) {
      testResults.tests.basicConnection = {
        success: false,
        error: err.message
      }
    }

    // Test 2: Transaction capability
    try {
      const { data, error } = await supabase.rpc('get_member_count')
      
      testResults.tests.rpcFunction = {
        success: !error,
        error: error?.message,
        result: data
      }
    } catch (err) {
      testResults.tests.rpcFunction = {
        success: false,
        error: err.message,
        note: 'RPC function may not exist - this is optional'
      }
    }

    // Test 3: Multiple concurrent queries (connection pool test)
    try {
      const startTime = Date.now()
      
      const promises = [
        supabase.from('members').select('count').limit(1),
        supabase.from('items').select('count').limit(1),
        supabase.from('orders').select('count').limit(1),
        supabase.from('branches').select('count').limit(1),
        supabase.from('departments').select('count').limit(1)
      ]

      const results = await Promise.all(promises)
      const endTime = Date.now()
      
      const allSuccessful = results.every(result => !result.error)
      
      testResults.tests.connectionPool = {
        success: allSuccessful,
        duration: `${endTime - startTime}ms`,
        concurrentQueries: promises.length,
        results: results.map(r => ({ success: !r.error, error: r.error?.message }))
      }
    } catch (err) {
      testResults.tests.connectionPool = {
        success: false,
        error: err.message
      }
    }

    // Test 4: Database URL connection (if available)
    if (dbUrl) {
      testResults.tests.directDbConnection = {
        configured: true,
        url: dbUrl.replace(/:[^:@]*@/, ':***@'), // Hide password
        note: 'Direct database URL is configured'
      }
    } else {
      testResults.tests.directDbConnection = {
        configured: false,
        note: 'Direct database URL not configured'
      }
    }

    // Overall health check
    const allTestsPassed = Object.values(testResults.tests)
      .filter(test => test.hasOwnProperty('success'))
      .every(test => test.success)

    testResults.overall = {
      healthy: allTestsPassed,
      summary: allTestsPassed ? 'All connection tests passed' : 'Some connection tests failed'
    }

    console.log('Supabase connection test completed:', testResults.overall.summary)

    return NextResponse.json({
      ok: true,
      ...testResults
    })
  } catch (error) {
    console.error('Connection test error:', error)
    return NextResponse.json({
      ok: false,
      error: 'Connection test failed',
      details: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}