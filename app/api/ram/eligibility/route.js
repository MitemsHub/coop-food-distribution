import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabaseServer'
import { validateMemberId } from '@/lib/validation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CATEGORY_PRICES = {
  Junior: 400000,
  Senior: 500000,
  Executive: 600000,
  Undefined: 0,
}

function normalizeGrade(grade) {
  return String(grade || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function fallbackRamCategoryFromGrade(grade) {
  const g = normalizeGrade(grade)
  const executive = new Set([
    'deputy governor',
    'director',
    'deputy director',
    'assistant director',
  ])
  const senior = new Set([
    'principal manager',
    'senior manager',
    'manager',
    'deputy manager',
    'assistant manager',
    'senior supervisor 1',
    'senior supervisor 2',
  ])
  const junior = new Set([
    'supervisor',
    'senior clerk',
    'treasury assistant',
    'clerk',
    'treasury assistant 1',
    'drivers',
    'pensioner',
    'retiree',
    'coop staff',
  ])

  if (executive.has(g)) return 'Executive'
  if (senior.has(g)) return 'Senior'
  if (junior.has(g)) return 'Junior'
  return 'Undefined'
}

async function getRamCategory(supabase, memberGrade) {
  const gradeKey = normalizeGrade(memberGrade)
  if (!gradeKey) return 'Undefined'

  const { data, error } = await supabase
    .from('grade_limits')
    .select('category')
    .ilike('grade', memberGrade)
    .maybeSingle()

  if (error) return fallbackRamCategoryFromGrade(memberGrade)

  const cat = String(data?.category || '').trim()
  if (cat === 'Executive' || cat === 'Senior' || cat === 'Junior') return cat
  return fallbackRamCategoryFromGrade(memberGrade)
}

function sumAmt(rows) {
  return (rows || []).reduce((s, r) => s + Number(r.total_amount || 0), 0)
}

function sumField(rows, field) {
  const f = String(field || '').trim()
  if (!f) return 0
  return (rows || []).reduce((s, r) => s + Number(r?.[f] || 0), 0)
}

function invertTotalToPrincipal(total, interestRate) {
  const t = Math.max(0, Math.trunc(Number(total || 0)))
  const r = Number(interestRate || 0)
  if (!Number.isFinite(r) || r <= 0) return t
  const guess = Math.max(0, Math.trunc(t / (1 + r)))
  for (let p = Math.max(0, guess - 5); p <= guess + 5; p += 1) {
    const computed = p + Math.round(p * r)
    if (computed === t) return p
  }
  return guess
}

function sumFoodLoanPrincipal(rows) {
  return (rows || []).reduce((s, r) => s + invertTotalToPrincipal(r?.total_amount, 0.13), 0)
}

function isMissingTable(error, tableName) {
  const code = String(error?.code || '')
  if (code === '42P01') return true
  const msg = `${error?.message || ''} ${error?.details || ''}`.toLowerCase()
  const t = String(tableName || '').toLowerCase()
  if (!msg.includes(t)) return false
  return msg.includes('does not exist') || msg.includes('could not find the table')
}

function computeMaxAffordableQty({ unitPrice, maxCap, eligibleAmount, includeInterest }) {
  const price = Number(unitPrice || 0)
  const eligible = Number(eligibleAmount || 0)
  const cap = Math.max(0, Math.trunc(Number(maxCap || 0)))
  if (!Number.isFinite(price) || price <= 0) return 0
  if (!Number.isFinite(eligible) || eligible <= 0) return 0

  let best = 0
  for (let q = 1; q <= cap; q += 1) {
    const principal = price * q
    const interest = includeInterest ? Math.round(principal * 0.06) : 0
    const total = principal + interest
    if (total <= eligible) best = q
  }
  return best
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const memberIdRaw = (searchParams.get('member_id') || searchParams.get('id') || '').trim()
    const memberIdRes = validateMemberId(memberIdRaw)
    if (!memberIdRes.isValid) {
      return NextResponse.json({ ok: false, error: memberIdRes.error }, { status: 400 })
    }

    const memberId = memberIdRes.sanitized.toUpperCase()
    const supabase = createClient()

    const { data: member, error: mErr } = await supabase
      .from('members')
      .select('member_id,full_name,savings,loans,global_limit,grade')
      .eq('member_id', memberId)
      .single()
    if (mErr || !member) {
      return NextResponse.json({ ok: false, error: 'Member not found' }, { status: 404 })
    }

    const statuses = ['Pending', 'Approved']
    const [foodLoanExp, foodSavExp, ramLoanExp, ramSavExp] = await Promise.all([
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
      supabase
        .from('ram_orders')
        .select('principal_amount')
        .eq('member_id', memberId)
        .eq('payment_option', 'Loan')
        .in('status', statuses),
      supabase
        .from('ram_orders')
        .select('principal_amount')
        .eq('member_id', memberId)
        .eq('payment_option', 'Savings')
        .in('status', statuses),
    ])

    if (foodLoanExp.error) return NextResponse.json({ ok: false, error: foodLoanExp.error.message }, { status: 500 })
    if (foodSavExp.error) return NextResponse.json({ ok: false, error: foodSavExp.error.message }, { status: 500 })

    const ramOrdersTableMissing =
      isMissingTable(ramLoanExp.error, 'ram_orders') || isMissingTable(ramSavExp.error, 'ram_orders')

    if (!ramOrdersTableMissing) {
      if (ramLoanExp.error) return NextResponse.json({ ok: false, error: ramLoanExp.error.message }, { status: 500 })
      if (ramSavExp.error) return NextResponse.json({ ok: false, error: ramSavExp.error.message }, { status: 500 })
    }

    const loanExposure = sumFoodLoanPrincipal(foodLoanExp.data) + (ramOrdersTableMissing ? 0 : sumField(ramLoanExp.data, 'principal_amount'))
    const savingsExposure = sumAmt(foodSavExp.data) + (ramOrdersTableMissing ? 0 : sumField(ramSavExp.data, 'principal_amount'))

    const savings = Number(member.savings || 0)
    const loans = Number(member.loans || 0)
    const globalLimit = Number(member.global_limit || 0)

    const outstandingLoansTotal = loans + loanExposure

    const savingsBase = 0.5 * savings
    const savingsEligible = outstandingLoansTotal > 0 ? 0 : Math.max(0, savingsBase - savingsExposure)

    const ADDITIONAL_FACILITY = 300000
    const LOAN_CAP = 1000000
    const rawLoanLimit = savings * 5
    const effectiveLimit = Math.min(rawLoanLimit, globalLimit)
    const baseRemaining = effectiveLimit - outstandingLoansTotal
    const exceededLoanLimit = baseRemaining <= 0
    const baseEligible = Math.max(0, baseRemaining)
    const capRemaining = Math.max(0, LOAN_CAP - loanExposure)
    const facilityRemaining = Math.max(0, ADDITIONAL_FACILITY - loanExposure)
    const loanEligible = Math.min(baseEligible + facilityRemaining, capRemaining)

    const ramCategory = await getRamCategory(supabase, member.grade)
    const unitPrice = CATEGORY_PRICES[ramCategory] ?? CATEGORY_PRICES.Undefined
    let activeRamCycleId = null
    let usedLoanQtyThisCycle = 0
    if (!ramOrdersTableMissing) {
      const { data: activeRamCycle, error: arcErr } = await supabase
        .from('ram_cycles')
        .select('id')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .maybeSingle()

      if (arcErr && !isMissingTable(arcErr, 'ram_cycles')) {
        return NextResponse.json({ ok: false, error: arcErr.message }, { status: 500 })
      }
      if (activeRamCycle?.id) activeRamCycleId = activeRamCycle.id

      let q = supabase
        .from('ram_orders')
        .select('qty')
        .eq('member_id', memberId)
        .eq('payment_option', 'Loan')
        .in('status', statuses)
      if (activeRamCycleId) q = q.eq('ram_cycle_id', activeRamCycleId)

      const { data: loanQtyRows, error: loanQtyErr } = await q
      if (loanQtyErr) return NextResponse.json({ ok: false, error: loanQtyErr.message }, { status: 500 })
      usedLoanQtyThisCycle = sumField(loanQtyRows, 'qty')
    }
    const remainingLoanQtyThisCycle = Math.max(0, 2 - usedLoanQtyThisCycle)

    let maxRamsAllowedForLoan = 0
    if (remainingLoanQtyThisCycle > 0 && loanEligible > 0) {
      if (loanEligible < unitPrice) {
        maxRamsAllowedForLoan = 1
      } else {
        const cap = Math.min(2, remainingLoanQtyThisCycle)
        maxRamsAllowedForLoan = computeMaxAffordableQty({
          unitPrice,
          maxCap: cap,
          eligibleAmount: loanEligible,
          includeInterest: false,
        })
      }
      maxRamsAllowedForLoan = Math.min(maxRamsAllowedForLoan, remainingLoanQtyThisCycle)
    }
    const maxCapSavings = unitPrice > 0 ? Math.min(1000, Math.max(0, Math.trunc(savingsEligible / unitPrice))) : 0
    const maxRamsAllowedForSavings = computeMaxAffordableQty({
      unitPrice,
      maxCap: maxCapSavings,
      eligibleAmount: savingsEligible,
      includeInterest: false,
    })
    const maxRamsAllowedForLoanOrSavings = Math.max(maxRamsAllowedForLoan, maxRamsAllowedForSavings)

    return NextResponse.json({
      ok: true,
      member: {
        member_id: member.member_id,
        full_name: member.full_name,
        grade: member.grade || '',
        ram_category: ramCategory,
      },
      pricing: {
        unit_price: unitPrice,
      },
      eligibility: {
        savingsEligible,
        loanEligible,
        exceededLoanLimit,
        outstandingLoansTotal,
        savingsExposure,
        loanExposure,
        maxRamsAllowedForLoanOrSavings,
        maxRamsAllowedForLoan,
        maxRamsAllowedForSavings,
        usedLoanQtyThisCycle,
        remainingLoanQtyThisCycle,
        activeRamCycleId,
        ramOrdersTableMissing,
      },
      rules: {
        loan_interest_rate: 0.06,
        cash_unlimited: true,
      },
    })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message || 'Unknown error' }, { status: 500 })
  }
}
