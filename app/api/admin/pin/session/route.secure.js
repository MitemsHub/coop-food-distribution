// app/api/admin/pin/session/route.secure.js
// Secure version of admin PIN session API with proper validation and rate limiting
import { NextResponse } from 'next/server'
import { 
  sanitizeString,
  checkRateLimit,
  getClientIP
} from '@/lib/validation'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

// Secure PIN comparison with timing attack protection
function secureCompare(provided, expected) {
  if (!provided || !expected) return false
  
  // Normalize lengths to prevent timing attacks
  const maxLength = Math.max(provided.length, expected.length)
  const normalizedProvided = provided.padEnd(maxLength, '\0')
  const normalizedExpected = expected.padEnd(maxLength, '\0')
  
  return crypto.timingSafeEqual(
    Buffer.from(normalizedProvided, 'utf8'),
    Buffer.from(normalizedExpected, 'utf8')
  )
}

// Generate secure session token
function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex')
}

// Validate PIN format
function validatePin(pin) {
  if (!pin || typeof pin !== 'string') {
    return { isValid: false, error: 'PIN is required' }
  }
  
  const sanitized = sanitizeString(pin, { maxLength: 50, allowedChars: /^[a-zA-Z0-9!@#$%^&*()_+\-=\[\]{}|;:,.<>?]+$/ })
  if (!sanitized) {
    return { isValid: false, error: 'PIN contains invalid characters' }
  }
  
  if (sanitized.length < 4) {
    return { isValid: false, error: 'PIN must be at least 4 characters' }
  }
  
  return { isValid: true, sanitized }
}

export async function GET() {
  return successResponse({ message: 'Admin PIN session API is operational' })
}

export async function POST(req) {
  const startTime = Date.now()
  
  try {
    // Get client IP for rate limiting
    const clientIP = getClientIP(req)
    const rateLimitKey = `admin_pin:${clientIP}`
    const lockoutKey = `admin_pin_lockout:${clientIP}`
    
    // Check for lockout
    if (!checkRateLimit(lockoutKey, LOCKOUT_ATTEMPTS, LOCKOUT_DURATION)) {
      console.warn(`Admin PIN lockout triggered for IP: ${clientIP}`);
      return errorResponse(
        'Too many failed attempts. Account temporarily locked.',
        429,
        'ACCOUNT_LOCKED'
      )
    }
    
    // Check rate limiting
    if (!checkRateLimit(rateLimitKey, RATE_LIMIT_ATTEMPTS, RATE_LIMIT_WINDOW)) {
      console.warn(`Admin PIN rate limit exceeded for IP: ${clientIP}`);
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

    const { pin } = body || {}
    
    // Validate PIN format
    const pinValidation = validatePin(pin)
    if (!pinValidation.isValid) {
      return errorResponse(pinValidation.error, 400, 'INVALID_PIN_FORMAT')
    }

    // Get expected PIN from environment
    const expectedPin = process.env.ADMIN_PASSCODE
    if (!expectedPin) {
      console.error('ADMIN_PASSCODE environment variable not set')
      return errorResponse('Server configuration error', 500, 'CONFIG_ERROR')
    }

    // Add minimum processing time to prevent timing attacks
    const minProcessingTime = 100 // milliseconds
    const processingTime = Date.now() - startTime
    if (processingTime < minProcessingTime) {
      await new Promise(resolve => setTimeout(resolve, minProcessingTime - processingTime))
    }

    // Secure PIN comparison
    const isValidPin = secureCompare(pinValidation.sanitized, expectedPin)
    
    if (!isValidPin) {
      console.warn(`Failed admin PIN attempt from IP: ${clientIP}`);
      return errorResponse('Invalid PIN', 401, 'INVALID_CREDENTIALS')
    }

    // Generate secure session token
    const sessionToken = generateSessionToken()
    
    // Log successful authentication (without sensitive data)
    console.log(`Successful admin authentication from IP: ${clientIP} at ${new Date().toISOString()}`);
    
    // Create secure response
    const response = successResponse({
      message: 'Authentication successful',
      userType: 'admin',
      sessionToken,
      expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString() // 8 hours
    })
    
    // Set secure session cookie
    response.cookies.set('admin_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 8 * 60 * 60, // 8 hours in seconds
      path: '/admin'
    })
    
    return response

  } catch (error) {
    console.error('Admin PIN authentication error:', error)
    return errorResponse('Internal server error', 500, 'INTERNAL_ERROR')
  }
}

// DELETE method to handle logout
export async function DELETE(req) {
  try {
    const clientIP = getClientIP(req)
    console.log(`Admin logout from IP: ${clientIP} at ${new Date().toISOString()}`);
    
    const response = successResponse({ message: 'Logged out successfully' })
    
    // Clear session cookie
    response.cookies.set('admin_session', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0,
      path: '/admin'
    })
    
    return response
    
  } catch (error) {
    console.error('Admin logout error:', error)
    return errorResponse('Internal server error', 500, 'INTERNAL_ERROR')
  }
}

// Middleware configuration for Next.js
export const config = {
  matcher: '/api/admin/pin/session'
}