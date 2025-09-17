// middleware.js
// Comprehensive security middleware for the Coop Food Distribution System
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Rate limiting store (in production, use Redis or similar)
const rateLimitStore = new Map()

// Security headers configuration
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co;"
}

// Rate limiting function
function checkRateLimit(key, maxRequests, windowMs) {
  const now = Date.now()
  const windowStart = now - windowMs
  
  if (!rateLimitStore.has(key)) {
    rateLimitStore.set(key, [])
  }
  
  const requests = rateLimitStore.get(key)
  
  // Remove old requests outside the window
  const validRequests = requests.filter(timestamp => timestamp > windowStart)
  
  if (validRequests.length >= maxRequests) {
    return false
  }
  
  validRequests.push(now)
  rateLimitStore.set(key, validRequests)
  
  return true
}

// Get client IP address
function getClientIP(request) {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  const remoteAddr = request.headers.get('x-vercel-forwarded-for')
  
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  
  return realIP || remoteAddr || 'unknown'
}

// Validate session token
async function validateSession(request, sessionType) {
  try {
    const cookieName = `${sessionType}_token`
    const sessionCookie = request.cookies.get(cookieName)
    const sessionToken = sessionCookie?.value
    
    if (!sessionToken) {
      return { isValid: false, reason: 'No session token' }
    }
    
    // Import the verify function to validate JWT tokens (Edge Runtime compatible)
    const { verify } = await import('./lib/signingEdge.js')
    const claim = await verify(sessionToken)
    
    if (!claim || claim.role !== sessionType) {
      return { isValid: false, reason: 'Invalid token or role' }
    }
    
    return { isValid: true, sessionToken, claim }
  } catch (error) {
    console.error('Session validation error:', error)
    return { isValid: false, reason: 'Validation error' }
  }
}

// Main middleware function
export async function middleware(request) {
  const { pathname } = request.nextUrl
  const clientIP = getClientIP(request)
  
  // Create response with security headers
  const response = NextResponse.next()
  
  // Add security headers to all responses
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
  
  // Global rate limiting (adjust limits as needed)
  const globalRateLimit = checkRateLimit(`global:${clientIP}`, 100, 60000) // 100 requests per minute
  if (!globalRateLimit) {
    console.warn(`Global rate limit exceeded for IP: ${clientIP}`);
    return new NextResponse('Too Many Requests', { 
      status: 429,
      headers: {
        'Retry-After': '60',
        ...securityHeaders
      }
    })
  }
  
  // API route protection
  if (pathname.startsWith('/api/')) {
    // More strict rate limiting for API routes
    const apiRateLimit = checkRateLimit(`api:${clientIP}`, 50, 60000) // 50 API requests per minute
    if (!apiRateLimit) {
      console.warn(`API rate limit exceeded for IP: ${clientIP}`);
      return new NextResponse('Too Many API Requests', { 
        status: 429,
        headers: {
          'Retry-After': '60',
          ...securityHeaders
        }
      })
    }
    
    // Admin API protection
    if (pathname.startsWith('/api/admin/')) {
      // Reasonable rate limiting for admin APIs
      const adminRateLimit = checkRateLimit(`admin:${clientIP}`, 60, 60000) // 60 admin requests per minute
      if (!adminRateLimit) {
        console.warn(`Admin API rate limit exceeded for IP: ${clientIP}`);
        return new NextResponse('Too Many Admin Requests', { 
          status: 429,
          headers: {
            'Retry-After': '60',
            ...securityHeaders
          }
        })
      }
      
      // Skip session validation for login endpoints
      if (!pathname.includes('/session')) {
        const sessionValidation = await validateSession(request, 'admin')
        if (!sessionValidation.isValid) {
          console.warn(`Unauthorized admin API access from IP: ${clientIP}`);
          return new NextResponse('Unauthorized', { 
            status: 401,
            headers: securityHeaders
          })
        }
      }
    }
    
    // Rep API protection
    if (pathname.startsWith('/api/rep/')) {
      const repRateLimit = checkRateLimit(`rep:${clientIP}`, 30, 60000) // 30 rep requests per minute
      if (!repRateLimit) {
        console.warn(`Rep API rate limit exceeded for IP: ${clientIP}`);
        return new NextResponse('Too Many Rep Requests', { 
          status: 429,
          headers: {
            'Retry-After': '60',
            ...securityHeaders
          }
        })
      }
      
      // Skip session validation for login endpoints
      if (!pathname.includes('/session')) {
        const sessionValidation = await validateSession(request, 'rep')
        if (!sessionValidation.isValid) {
          console.warn(`Unauthorized rep API access from IP: ${clientIP}`);
          return new NextResponse('Unauthorized', { 
            status: 401,
            headers: securityHeaders
          })
        }
      }
    }
  }
  
  // Page route protection
  if (pathname.startsWith('/admin/')) {
    // Skip session validation for login page
    if (!pathname.includes('/pin')) {
      const sessionValidation = await validateSession(request, 'admin')
      if (!sessionValidation.isValid) {
        const loginUrl = new URL('/admin/pin', request.url)
        return NextResponse.redirect(loginUrl)
      }
    }
  }
  
  if (pathname.startsWith('/rep/')) {
    // Skip session validation for login page
    if (!pathname.includes('/login')) {
      const sessionValidation = await validateSession(request, 'rep')
      if (!sessionValidation.isValid) {
        const loginUrl = new URL('/rep/login', request.url)
        return NextResponse.redirect(loginUrl)
      }
    }
  }
  
  // Log security events
  if (pathname.startsWith('/admin/') || pathname.startsWith('/api/admin/')) {
    console.log(`Admin access: ${pathname} from IP: ${clientIP} at ${new Date().toISOString()}`);
  }
  
  return response
}

// Configure which routes the middleware should run on
export const config = {
  matcher: [
    // Match all API routes
    '/api/:path*',
    // Match admin routes
    '/admin/:path*',
    // Match rep routes
    '/rep/:path*',
    // Match shop routes (for member protection)
    '/shop/:path*'
  ]
}