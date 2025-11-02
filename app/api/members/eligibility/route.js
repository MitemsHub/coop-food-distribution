// app/api/members/eligibility/route.js
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, serviceKey)

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const memberId = (searchParams.get('member_id') || searchParams.get('id') || '').trim()
    if (!memberId) {
      return NextResponse.json({ ok: false, error: 'member_id or id required' }, { status: 400 })
    }

    // 1) Member snapshot (core balances)
    const { data: m, error: mErr } = await supabase
      .from('members')
      .select('member_id,savings,loans,global_limit')
      .eq('member_id', memberId)
      .single()
    if (mErr || !m) {
      return NextResponse.json({ ok: false, error: 'Member not found' }, { status: 404 })
    }

    // 2) Exposure = sum of order totals for Pending + Posted + Delivered
    const statuses = ['Pending', 'Posted', 'Delivered']
    const [loanExp, savExp] = await Promise.all([
      supabase
        .from('orders')
        .select('total_amount')
        .eq('member_id', memberId)
        .eq('payment_option', 'Loan')
        .in('status', statuses),
      supabase
        .from('orders')
        .select('total_amount')
        .eq('member_id', memberId)
        .eq('payment_option', 'Savings')
        .in('status', statuses),
    ])
    if (loanExp.error) return NextResponse.json({ ok: false, error: loanExp.error.message }, { status: 500 })
    if (savExp.error) return NextResponse.json({ ok: false, error: savExp.error.message }, { status: 500 })

    const sumAmt = (rows) => (rows || []).reduce((s, r) => s + Number(r.total_amount || 0), 0)
    const loanExposurePrincipal = sumAmt(loanExp.data)
    const savingsExposure = sumAmt(savExp.data)

    // 3) Compute limits (exposure-aware)
    const savings = Number(m.savings || 0)
    const loans = Number(m.loans || 0)
    const globalLimit = Number(m.global_limit || 0)

    // Calculate interest on loan exposure for better remaining loan calculation
    const INTEREST_RATE = 0.13
    const loanInterest = Math.round(loanExposurePrincipal * INTEREST_RATE)
    const loanExposure = loanExposurePrincipal + loanInterest // Total exposure including interest

    const outstandingLoansTotal = loans + loanExposure
    
    // Savings follows original rule (50% of savings) and does NOT include facility
    const savingsBase = 0.5 * savings
    const savingsEligible = outstandingLoansTotal > 0 ? 0 : Math.max(0, savingsBase - savingsExposure)

    // Loan eligibility: base eligibility plus N300,000 facility, capped at N1,000,000
    const additionalFacility = 300000 // N300,000 facility
    const LOAN_CAP = 1000000 // N1,000,000 cap (total cap)
    const rawLoanLimit = savings * 5
    const effectiveLimit = Math.min(rawLoanLimit, globalLimit)
    const baseEligible = Math.max(0, effectiveLimit - outstandingLoansTotal)
    const capRemaining = Math.max(0, LOAN_CAP - loanExposure)
    const loanEligible = Math.min(baseEligible + additionalFacility, capRemaining)

    return NextResponse.json({
      ok: true,
      eligibility: {
        savingsEligible,
        loanEligible,
        outstandingLoansTotal,
        savingsExposure,
        loanExposure, // Total exposure including interest
        loanExposurePrincipal, // Principal amount only
        loanInterest // Interest amount
      },
      memberSnapshot: {
        savings,
        loans,
        globalLimit,
      },
    })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message || 'Unknown error' }, { status: 500 })
  }
}
