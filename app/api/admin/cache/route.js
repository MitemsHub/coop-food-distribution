// app/api/admin/cache/route.js
// Cache management API for admin users

import { NextResponse } from 'next/server'
import { validateSession } from '@/lib/validation'
import { 
  getCacheStats, 
  clearAllCache, 
  clearExpiredCache, 
  invalidateCache 
} from '@/lib/cache'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET - Get cache statistics
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

    const stats = getCacheStats()
    
    return NextResponse.json({
      ok: true,
      cache: {
        ...stats,
        uptime: process.uptime(),
        nodeVersion: process.version
      }
    })
  } catch (error) {
    console.error('Cache stats error:', error)
    return NextResponse.json(
      { ok: false, error: 'Failed to get cache stats' }, 
      { status: 500 }
    )
  }
}

// POST - Cache management operations
export async function POST(request) {
  try {
    // Validate admin session
    const sessionResult = await validateSession(request, 'admin')
    if (!sessionResult.valid) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' }, 
        { status: 401 }
      )
    }

    const { action, pattern } = await request.json()

    let result = {}
    
    switch (action) {
      case 'clear_all':
        result.cleared = clearAllCache()
        result.message = `Cleared all cache entries (${result.cleared} items)`
        break
        
      case 'clear_expired':
        result.cleared = clearExpiredCache()
        result.message = `Cleared ${result.cleared} expired cache entries`
        break
        
      case 'invalidate_pattern':
        if (!pattern) {
          return NextResponse.json(
            { ok: false, error: 'Pattern required for invalidate_pattern action' }, 
            { status: 400 }
          )
        }
        result.cleared = invalidateCache(pattern)
        result.message = `Invalidated ${result.cleared} cache entries matching pattern: ${pattern}`
        break
        
      default:
        return NextResponse.json(
          { ok: false, error: 'Invalid action. Use: clear_all, clear_expired, or invalidate_pattern' }, 
          { status: 400 }
        )
    }

    // Log the cache operation
    console.log(`Cache operation by admin: ${action}${pattern ? ` (pattern: ${pattern})` : ''} - ${result.message}`)

    return NextResponse.json({
      ok: true,
      action,
      pattern,
      result
    })
  } catch (error) {
    console.error('Cache management error:', error)
    return NextResponse.json(
      { ok: false, error: 'Cache operation failed' }, 
      { status: 500 }
    )
  }
}

// DELETE - Clear all cache (alternative to POST)
export async function DELETE(request) {
  try {
    // Validate admin session
    const sessionResult = await validateSession(request, 'admin')
    if (!sessionResult.valid) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' }, 
        { status: 401 }
      )
    }

    const cleared = clearAllCache()
    
    console.log(`Cache cleared by admin via DELETE: ${cleared} items`)
    
    return NextResponse.json({
      ok: true,
      message: `Cleared all cache entries (${cleared} items)`,
      cleared
    })
  } catch (error) {
    console.error('Cache clear error:', error)
    return NextResponse.json(
      { ok: false, error: 'Failed to clear cache' }, 
      { status: 500 }
    )
  }
}