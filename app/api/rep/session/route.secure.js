// app/api/rep/session/route.secure.js
// Secure version of rep session API with proper validation and rate limiting
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { 
  validateBranchCode,
  sanitizeString,
  checkRateLimit,
  getClientIP
} from '@/lib/validation'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(url, serviceKey)

// Rate limiting configuration
const RATE_LIMIT_ATTEMPTS = 5 // Max attempts per window
const RATE_LIMIT_WINDOW = 15 * 60 * 1000 // 15 minutes
const LOCKOUT_ATTEMPTS = 10 // Max attempts before longer lockout
const LOCKOUT_DURATION = 60 * 60 * 1000 // 1 hour lockout

// Standardized error response
function errorResponse(message, status = 400, code = null) {
  return NextResponse.json({ 
    ok: false, 
    error: message,
    code,
    timestamp: new Date().toISOString()
  }, { status })
}

// Standardized success response
function successResponse(data, status = 200) {
  return NextResponse.json({ 
    ok: true, 
    ...data,
    timestamp: new Date().toISOString()
  }, { status })
}

// Generate secure session token
function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex')
}

export async function GET() {
  return successResponse({ message: 'Rep session API is operational' })
}

export async function POST(req) {
  const startTime = Date.now()
  
  try {
    // Get client IP for rate limiting
    const clientIP = getClientIP(req)
    const rateLimitKey = `rep_session:${clientIP}`
    const lockoutKey = `rep_session_lockout:${clientIP}`
    
    // Check for lockout
    if (!checkRateLimit(lockoutKey, LOCKOUT_ATTEMPTS, LOCKOUT_DURATION)) {
      console.warn(`Rep session lockout triggered for IP: ${clientIP}`);
      return errorResponse(
        'Too many failed attempts. Account temporarily locked.',
        429,
        'ACCOUNT_LOCKED'
      )
    }
    
    // Check rate limiting
    if (!checkRateLimit(rateLimitKey, RATE_LIMIT_ATTEMPTS, RATE_LIMIT_WINDOW)) {
      console.warn(`Rep session rate limit exceeded for IP: ${clientIP}`);
      return errorResponse(
        'Too many attempts. Please try again later.',
        429,
        'RATE_LIMIT_EXCEEDED'
      )
    }

    // Parse and validate request body
    let body
    try {
      body = await req.json()
    } catch (e) {
      return errorResponse('Invalid JSON in request body', 400, 'INVALID_JSON')
    }

    const { branchCode } = body || {}
    
    // Validate branch code format
    const branchValidation = validateBranchCode(branchCode)
    if (!branchValidation.isValid) {
      return errorResponse(`Invalid branch code: ${branchValidation.error}`, 400, 'INVALID_BRANCH_CODE')
    }

    // Add minimum processing time to prevent timing attacks
    const minProcessingTime = 100 // milliseconds
    
    try {
      // Verify branch exists in database
      const { data: branch, error: branchError } = await supabase
        .from('branches')
        .select('id, code, name, active')
        .eq('code', branchValidation.sanitized)
        .single()
        .abortSignal(AbortSignal.timeout(5000)) // 5 second timeout

      // Ensure minimum processing time
      const processingTime = Date.now() - startTime
      if (processingTime < minProcessingTime) {
        await new Promise(resolve => setTimeout(resolve, minProcessingTime - processingTime))
      }

      if (branchError || !branch) {
        console.warn(`Failed rep authentication attempt for branch code: ${branchValidation.sanitized} from IP: ${clientIP}`);
        return errorResponse('Invalid branch code', 401, 'INVALID_CREDENTIALS')
      }

      // Check if branch is active
      if (!branch.active) {
        console.warn(`Authentication attempt for inactive branch: ${branchValidation.sanitized} from IP: ${clientIP}`);
        return errorResponse('Branch is not active', 403, 'BRANCH_INACTIVE')
      }

      // Generate secure session token
      const sessionToken = generateSessionToken()
      
      // Log successful authentication (without sensitive data)
      console.log(`Successful rep authentication for branch: ${branch.code} from IP: ${clientIP} at ${new Date().toISOString()}`);
      
      // Create secure response
      const response = successResponse({
        message: 'Authentication successful',
        userType: 'rep',
        branchCode: branch.code,
        branchName: branch.name,
        branchId: branch.id,
        sessionToken,
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString() // 8 hours
      })
      
      // Set secure session cookie
      response.cookies.set('rep_session', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 8 * 60 * 60, // 8 hours in seconds
        path: '/rep'
      })
      
      return response

    } catch (dbError) {
      console.error('Database error during rep authentication:', dbError)
      
      // Ensure minimum processing time even on error
      const processingTime = Date.now() - startTime
      if (processingTime < minProcessingTime) {
        await new Promise(resolve => setTimeout(resolve, minProcessingTime - processingTime))
      }
      
      return errorResponse('Authentication failed', 500, 'DATABASE_ERROR')
    }

  } catch (error) {
    console.error('Rep session authentication error:', error)
    return errorResponse('Internal server error', 500, 'INTERNAL_ERROR')
  }
}

// DELETE method to handle logout
export async function DELETE(req) {
  try {
    const clientIP = getClientIP(req)
    console.log(`Rep logout from IP: ${clientIP} at ${new Date().toISOString()}`);
    
    const response = successResponse({ message: 'Logged out successfully' })
    
    // Clear session cookie
    response.cookies.set('rep_session', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0,
      path: '/rep'
    })
    
    return response
    
  } catch (error) {
    console.error('Rep logout error:', error)
    return errorResponse('Internal server error', 500, 'INTERNAL_ERROR')
  }
}

// Middleware configuration for Next.js
export const config = {
  matcher: '/api/rep/session'
}