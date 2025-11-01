// app/api/members/eligibility/route.secure.js
// Secure version of member eligibility API with proper validation and error handling
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { 
  validateMemberId,
  checkRateLimit,
  getClientIP
} from '@/lib/validation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(url, serviceKey)

// Rate limiting configuration
const RATE_LIMIT_REQUESTS = 30 // Max requests per window
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute

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

// Safe number conversion with validation
function safeNumber(value, defaultValue = 0, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const num = Number(value)
  if (isNaN(num) || num < min || num > max) {
    return defaultValue
  }
  return num
}

// Calculate member eligibility with proper error handling
async function calculateEligibility(memberId) {
  try {
    // Fetch member data with timeout
    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('member_id, full_name, savings, loans, global_limit, category, branch_id')
      .eq('member_id', memberId)
      .single()
      .abortSignal(AbortSignal.timeout(5000))

    if (memberError || !member) {
      return { error: 'Member not found', code: 'MEMBER_NOT_FOUND' }
    }

    // Validate member data
    const memberSavings = safeNumber(member.savings, 0, 0, 10000000)
    const memberLoans = safeNumber(member.loans, 0, 0, 10000000)
    const globalLimit = safeNumber(member.global_limit, 0, 0, 10000000)

    // Calculate exposure with proper error handling
    const statuses = ['Pending', 'Posted', 'Delivered']
    
    const [loanResult, savingsResult] = await Promise.all([
      supabase
        .from('orders')
        .select('total_amount')
        .eq('member_id', memberId)
        .eq('payment_option', 'Loan')
        .in('status', statuses)
        .abortSignal(AbortSignal.timeout(5000)),
      supabase
        .from('orders')
        .select('total_amount')
        .eq('member_id', memberId)
        .eq('payment_option', 'Savings')
        .in('status', statuses)
        .abortSignal(AbortSignal.timeout(5000))
    ])

    if (loanResult.error) {
      console.error('Shopping exposure query failed:', loanResult.error)
        return { error: 'Failed to calculate shopping exposure', code: 'DATABASE_ERROR' }
    }

    if (savingsResult.error) {
      console.error('Savings exposure query failed:', savingsResult.error)
      return { error: 'Failed to calculate savings exposure', code: 'DATABASE_ERROR' }
    }

    // Safe calculation of exposures
    const sumAmt = (rows) => {
      if (!Array.isArray(rows)) return 0
      return rows.reduce((sum, row) => {
        const amount = safeNumber(row.total_amount, 0, 0, 10000000)
        return sum + amount
      }, 0)
    }

    const loanExposure = sumAmt(loanResult.data)
    const savingsExposure = sumAmt(savingsResult.data)

    // Calculate eligibility with bounds checking
    const outstandingLoansTotal = memberLoans + loanExposure
    const savingsBase = memberSavings * 0.5
    const additionalFacility = 300000 // N300,000 additional facility
    
    // Savings eligibility: add N300,000 facility even with outstanding loans
    const savingsEligible = outstandingLoansTotal > 0 
      ? additionalFacility // Even with outstanding loans, provide N300,000
      : Math.max(0, savingsBase - savingsExposure) + additionalFacility
    
    // Loan eligibility calculation with additional facility
    const rawLoanLimit = (memberSavings * 5) - outstandingLoansTotal
    const baseEligible = Math.min(
      Math.max(rawLoanLimit, 0),
      globalLimit
    )
    
    // Add additional facility and cap at N1,000,000
    const LOAN_CAP = 1000000 // N1,000,000 cap
    const loanEligible = Math.min(baseEligible + additionalFacility, LOAN_CAP)

    // Validate calculated values
    const finalSavingsEligible = safeNumber(savingsEligible, 0, 0, 10000000)
    const finalLoanEligible = safeNumber(loanEligible, 0, 0, 10000000)

    return {
      member: {
        member_id: member.member_id,
        full_name: member.full_name,
        category: member.category,
        branch_id: member.branch_id
      },
      financial: {
        savings: memberSavings,
        loans: memberLoans,
        global_limit: globalLimit
      },
      exposure: {
        loan_exposure: loanExposure,
        savings_exposure: savingsExposure,
        outstanding_loans_total: outstandingLoansTotal
      },
      eligibility: {
        savings_eligible: finalSavingsEligible,
        loan_eligible: finalLoanEligible
      }
    }

  } catch (error) {
    console.error('Eligibility calculation error:', error)
    return { error: 'Failed to calculate eligibility', code: 'CALCULATION_ERROR' }
  }
}

export async function GET(req) {
  try {
    // Rate limiting
    const clientIP = getClientIP(req)
    if (!checkRateLimit(`eligibility:${clientIP}`, RATE_LIMIT_REQUESTS, RATE_LIMIT_WINDOW)) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    // Extract member ID from URL parameters
    const { searchParams } = new URL(req.url)
    const memberId = searchParams.get('member_id')

    // Validate member ID
    const memberValidation = validateMemberId(memberId)
    if (!memberValidation.isValid) {
      return errorResponse(`Invalid member ID: ${memberValidation.error}`, 400, 'INVALID_MEMBER_ID')
    }

    // Calculate eligibility
    const result = await calculateEligibility(memberValidation.sanitized)
    
    if (result.error) {
      const status = result.code === 'MEMBER_NOT_FOUND' ? 404 : 500
      return errorResponse(result.error, status, result.code)
    }

    return successResponse(result)

  } catch (error) {
    console.error('Member eligibility API error:', error)
    return errorResponse('Internal server error', 500, 'INTERNAL_ERROR')
  }
}

export async function POST(req) {
  try {
    // Rate limiting
    const clientIP = getClientIP(req)
    if (!checkRateLimit(`eligibility:${clientIP}`, RATE_LIMIT_REQUESTS, RATE_LIMIT_WINDOW)) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    // Parse and validate request body
    let body
    try {
      body = await req.json()
    } catch (e) {
      return errorResponse('Invalid JSON in request body', 400, 'INVALID_JSON')
    }

    const { member_id } = body || {}

    // Validate member ID
    const memberValidation = validateMemberId(member_id)
    if (!memberValidation.isValid) {
      return errorResponse(`Invalid member ID: ${memberValidation.error}`, 400, 'INVALID_MEMBER_ID')
    }

    // Calculate eligibility
    const result = await calculateEligibility(memberValidation.sanitized)
    
    if (result.error) {
      const status = result.code === 'MEMBER_NOT_FOUND' ? 404 : 500
      return errorResponse(result.error, status, result.code)
    }

    return successResponse(result)

  } catch (error) {
    console.error('Member eligibility API error:', error)
    return errorResponse('Internal server error', 500, 'INTERNAL_ERROR')
  }
}

// Middleware configuration for Next.js
export const config = {
  matcher: '/api/members/eligibility'
}