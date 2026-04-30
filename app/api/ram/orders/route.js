import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabaseServer'
import {
  validateMemberId,
  validateNumber,
  validatePaymentOption,
} from '@/lib/validation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const LOAN_INTEREST_RATE = 0.06

const CATEGORY_PRICES = {
  Junior: 400000,
  Senior: 500000,
  Executive: 600000,
  Undefined: 0,
}

function isValidRamCategory(category) {
  return category === 'Executive' || category === 'Senior' || category === 'Junior'
}

function normalizeGrade(grade) {
  return String(grade || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function isRetireeGrade(grade) {
  const g = normalizeGrade(grade)
  if (!g) return false
  return g.includes('retiree')
}

function isPensionerGrade(grade) {
  const g = normalizeGrade(grade)
  if (!g) return false
  return g.includes('pensioner')
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

async function hasColumn(supabase, table, column) {
  const { error } = await supabase.from(table).select(column).limit(1)
  return !error
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
    const interest = includeInterest ? Math.round(principal * LOAN_INTEREST_RATE) : 0
    const total = principal + interest
    if (total <= eligible) best = q
  }
  return best
}

async function calculateEligibilityForRam(supabase, memberId, memberSnapshot, unitPrice) {
  const foodStatuses = ['Pending', 'Posted', 'Delivered']
  const ramStatuses = ['Pending', 'Approved']
  const [foodLoanExp, foodSavExp, ramLoanExp, ramSavExp] = await Promise.all([
    supabase
      .from('orders')
      .select('total_amount')
      .eq('member_id', memberId)
      .eq('payment_option', 'Loan')
      .in('status', foodStatuses),
    supabase
      .from('orders')
      .select('total_amount')
      .eq('member_id', memberId)
      .eq('payment_option', 'Savings')
      .in('status', foodStatuses),
    supabase
      .from('ram_orders')
      .select('principal_amount')
      .eq('member_id', memberId)
      .eq('payment_option', 'Loan')
      .in('status', ramStatuses),
    supabase
      .from('ram_orders')
      .select('principal_amount')
      .eq('member_id', memberId)
      .eq('payment_option', 'Savings')
      .in('status', ramStatuses),
  ])

  if (foodLoanExp.error) throw new Error(foodLoanExp.error.message)
  if (foodSavExp.error) throw new Error(foodSavExp.error.message)

  const ramOrdersTableMissing =
    isMissingTable(ramLoanExp.error, 'ram_orders') || isMissingTable(ramSavExp.error, 'ram_orders')

  if (!ramOrdersTableMissing) {
    if (ramLoanExp.error) throw new Error(ramLoanExp.error.message)
    if (ramSavExp.error) throw new Error(ramSavExp.error.message)
  }

  const loanExposure = sumFoodLoanPrincipal(foodLoanExp.data) + (ramOrdersTableMissing ? 0 : sumField(ramLoanExp.data, 'principal_amount'))
  const savingsExposure = sumAmt(foodSavExp.data) + (ramOrdersTableMissing ? 0 : sumField(ramSavExp.data, 'principal_amount'))

  const savings = Number(memberSnapshot.savings || 0)
  const loans = Number(memberSnapshot.loans || 0)
  const globalLimit = Number(memberSnapshot.global_limit || 0)

  const outstandingLoansTotal = loans + loanExposure

  const savingsBase = 0.5 * savings
  const savingsEligible = outstandingLoansTotal > 0 ? 0 : Math.max(0, savingsBase - savingsExposure)

  const isRetiree = isRetireeGrade(memberSnapshot.grade)
  const isPensioner = isPensionerGrade(memberSnapshot.grade)
  let exceededLoanLimit = false
  let loanEligible = 0
  if (isRetiree) {
    loanEligible = Math.max(0, savings - outstandingLoansTotal)
    exceededLoanLimit = loanEligible <= 0
  } else if (isPensioner) {
    loanEligible = Math.max(0, savings * 5 - outstandingLoansTotal)
    exceededLoanLimit = loanEligible <= 0
  } else {
    const ADDITIONAL_FACILITY = 300000
    const LOAN_CAP = 1000000
    const rawLoanLimit = savings * 5
    const effectiveLimit = Math.min(rawLoanLimit, globalLimit)
    const baseRemaining = effectiveLimit - outstandingLoansTotal
    exceededLoanLimit = baseRemaining <= 0
    const baseEligible = Math.max(0, baseRemaining)
    const capRemaining = Math.max(0, LOAN_CAP - loanExposure)
    const facilityRemaining = Math.max(0, ADDITIONAL_FACILITY - loanExposure)
    loanEligible = Math.min(baseEligible + facilityRemaining, capRemaining)
  }

  let activeRamCycleId = null
  let usedLoanQtyThisCycle = 0
  if (!ramOrdersTableMissing) {
    const { data: activeRamCycle, error: arcErr } = await supabase
      .from('ram_cycles')
      .select('id')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .maybeSingle()

    if (arcErr && !isMissingTable(arcErr, 'ram_cycles')) throw new Error(arcErr.message)
    if (activeRamCycle?.id) activeRamCycleId = activeRamCycle.id

    let q = supabase
      .from('ram_orders')
      .select('qty')
      .eq('member_id', memberId)
      .eq('payment_option', 'Loan')
      .in('status', ramStatuses)
    if (activeRamCycleId) q = q.eq('ram_cycle_id', activeRamCycleId)

    const { data: loanQtyRows, error: loanQtyErr } = await q
    if (loanQtyErr) throw new Error(loanQtyErr.message)
    usedLoanQtyThisCycle = sumField(loanQtyRows, 'qty')
  }
  const loanQtyCap = isPensioner ? 1 : 2
  const remainingLoanQtyThisCycle = Math.max(0, loanQtyCap - usedLoanQtyThisCycle)

  let maxRamsAllowedForLoan = 0
  if (remainingLoanQtyThisCycle > 0 && loanEligible > 0) {
    if (loanEligible < unitPrice) {
      maxRamsAllowedForLoan = isRetiree || isPensioner ? 0 : 1
    } else {
      const cap = Math.min(loanQtyCap, remainingLoanQtyThisCycle)
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

  return {
    savingsEligible,
    loanEligible,
    exceededLoanLimit,
    outstandingLoansTotal,
    maxRamsAllowedForLoanOrSavings,
    maxRamsAllowedForLoan,
    maxRamsAllowedForSavings,
    usedLoanQtyThisCycle,
    remainingLoanQtyThisCycle,
    activeRamCycleId,
    ramOrdersTableMissing,
    isRetiree,
    isPensioner,
  }
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}))

    const memberIdRes = validateMemberId(String(body.member_id || ''))
    if (!memberIdRes.isValid) {
      return NextResponse.json({ ok: false, error: memberIdRes.error }, { status: 400 })
    }

    const paymentRes = validatePaymentOption(String(body.payment_option || ''))
    if (!paymentRes.isValid) {
      return NextResponse.json({ ok: false, error: paymentRes.error }, { status: 400 })
    }

    const qtyRes = validateNumber(body.qty, { min: 1, max: 1000, integer: true })
    if (!qtyRes.isValid) {
      return NextResponse.json({ ok: false, error: qtyRes.error }, { status: 400 })
    }

    const deliveryLocationIdRes = validateNumber(body.delivery_location_id, { min: 1, integer: true })
    if (!deliveryLocationIdRes.isValid) {
      return NextResponse.json({ ok: false, error: 'Delivery location is required' }, { status: 400 })
    }

    const memberId = memberIdRes.sanitized.toUpperCase()
    const paymentOption = paymentRes.sanitized
    const qty = qtyRes.value
    const deliveryLocationId = deliveryLocationIdRes.value
    const requestedCategoryRaw = String(body.ram_category || '').trim()
    const requestedCategory = requestedCategoryRaw ? (isValidRamCategory(requestedCategoryRaw) ? requestedCategoryRaw : null) : ''
    if (requestedCategory === null) {
      return NextResponse.json({ ok: false, error: 'Invalid ram category' }, { status: 400 })
    }

    const supabase = createClient()

    const { data: member, error: mErr } = await supabase
      .from('members')
      .select('member_id,full_name,savings,loans,global_limit,grade')
      .eq('member_id', memberId)
      .single()
    if (mErr || !member) {
      return NextResponse.json({ ok: false, error: 'Member not found' }, { status: 404 })
    }

    const derivedRamCategory = await getRamCategory(supabase, member.grade)
    const canOverrideCategory = (paymentOption === 'Cash' || paymentOption === 'Savings') && !!requestedCategory
    const ramCategory = canOverrideCategory ? requestedCategory : derivedRamCategory
    const unitPrice = CATEGORY_PRICES[ramCategory] ?? CATEGORY_PRICES.Undefined
    if (unitPrice <= 0) {
      return NextResponse.json({ ok: false, error: 'Member is not eligible for ram pricing' }, { status: 400 })
    }

    const eligibility = await calculateEligibilityForRam(supabase, memberId, member, unitPrice)
    const maxAllowed =
      paymentOption === 'Savings' ? eligibility.maxRamsAllowedForSavings : eligibility.maxRamsAllowedForLoan

    const principalAmount = unitPrice * qty

    if (paymentOption === 'Savings') {
      if (eligibility.savingsEligible <= 0) {
        return NextResponse.json({ ok: false, error: 'Savings option not available for this member' }, { status: 400 })
      }
      if (qty > maxAllowed) {
        return NextResponse.json(
          { ok: false, error: `Maximum allowed is ${maxAllowed} ram(s) for Savings` },
          { status: 400 }
        )
      }
    }

    if (paymentOption === 'Loan') {
      if (eligibility.isPensioner && qty > 1) {
        return NextResponse.json({ ok: false, error: 'Maximum allowed is 1 ram(s) for Loan' }, { status: 400 })
      }
      if (eligibility.isRetiree && principalAmount > eligibility.loanEligible) {
        const shortfall = Math.max(0, principalAmount - Number(eligibility.loanEligible || 0))
        return NextResponse.json(
          { ok: false, error: `Your purchase will exceed your loan limit by ₦${Number(shortfall).toLocaleString()}. Increase savings by ₦${Number(shortfall).toLocaleString()} to qualify.` },
          { status: 400 }
        )
      }
      if (qty > maxAllowed) {
        return NextResponse.json(
          { ok: false, error: `Maximum allowed is ${maxAllowed} ram(s) for Loan` },
          { status: 400 }
        )
      }
    }

    const interestAmount = paymentOption === 'Loan' ? Math.round(principalAmount * LOAN_INTEREST_RATE) : 0
    const totalAmount = principalAmount + interestAmount

    if (paymentOption === 'Savings' && totalAmount > eligibility.savingsEligible) {
      return NextResponse.json({ ok: false, error: 'Insufficient savings eligibility for this purchase' }, { status: 400 })
    }
    if (paymentOption === 'Loan' && principalAmount > eligibility.loanEligible) {
      const allowFallbackOne =
        !eligibility.isRetiree &&
        !eligibility.isPensioner &&
        qty === 1 &&
        eligibility.loanEligible > 0 &&
        eligibility.loanEligible < unitPrice
      if (!allowFallbackOne) {
        return NextResponse.json({ ok: false, error: 'Insufficient loan eligibility for this purchase' }, { status: 400 })
      }
    }

    const { data: deliveryLocation, error: locErr } = await supabase
      .from('ram_delivery_locations')
      .select('id,is_active')
      .eq('id', deliveryLocationId)
      .eq('is_active', true)
      .single()
    if (locErr) {
      const tableMissing = isMissingTable(locErr, 'ram_delivery_locations')
      if (tableMissing) {
        return NextResponse.json(
          { ok: false, error: 'Ram delivery locations are not created yet. Run the ram sales migration in Supabase.' },
          { status: 500 }
        )
      }
      return NextResponse.json({ ok: false, error: locErr.message }, { status: 500 })
    }
    if (!deliveryLocation) {
      return NextResponse.json({ ok: false, error: 'Delivery location not found' }, { status: 404 })
    }

    if (eligibility.ramOrdersTableMissing) {
      return NextResponse.json(
        { ok: false, error: 'Ram Sales database tables are not created yet. Run the ram sales migration in Supabase.' },
        { status: 500 }
      )
    }

    const ordersHasCycle = await hasColumn(supabase, 'ram_orders', 'ram_cycle_id')
    let ramCycleId = ordersHasCycle ? eligibility.activeRamCycleId : null
    if (ordersHasCycle && ramCycleId == null) {
      const { data: latest, error: lErr } = await supabase
        .from('ram_cycles')
        .select('id')
        .order('created_at', { ascending: false })
        .maybeSingle()
      if (!lErr && latest?.id) ramCycleId = latest.id
    }

    const { data: inserted, error: insErr } = await supabase
      .from('ram_orders')
      .insert({
        member_id: memberId,
        payment_option: paymentOption,
        status: 'Pending',
        member_grade: member.grade || '',
        member_category: ramCategory,
        unit_price: unitPrice,
        qty,
        principal_amount: principalAmount,
        interest_amount: interestAmount,
        total_amount: totalAmount,
        ram_delivery_location_id: deliveryLocation.id,
        ...(ordersHasCycle && ramCycleId != null ? { ram_cycle_id: ramCycleId } : {})
      })
      .select('id,total_amount,payment_option,qty,member_category,created_at')
      .single()

    if (insErr || !inserted) {
      return NextResponse.json({ ok: false, error: insErr?.message || 'Failed to create order' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, order: inserted })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message || 'Unknown error' }, { status: 500 })
  }
}
