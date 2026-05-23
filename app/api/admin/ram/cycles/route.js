import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabaseServer'
import { validateSession, sanitizeString, validateNumber } from '@/lib/validation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function validateCycleCode(code) {
  const sanitized = sanitizeString(code || '', { maxLength: 50, encodeHtml: false })
  if (!sanitized) return { ok: false, value: '', error: 'Cycle code is required' }
  if (!/^[A-Za-z0-9 _-]+$/.test(sanitized)) return { ok: false, value: sanitized, error: 'Cycle code contains invalid characters' }
  return { ok: true, value: sanitized }
}

function validateCycleName(name) {
  const sanitized = sanitizeString(name || '', { maxLength: 255, encodeHtml: false })
  if (!sanitized) return { ok: false, value: '', error: 'Cycle name is required' }
  return { ok: true, value: sanitized }
}

async function getActiveRamCycleId(supabase) {
  const { data, error } = await supabase
    .from('ram_cycles')
    .select('id')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data?.id || null
}

function isMissingColumn(error) {
  const msg = String(error?.message || '').toLowerCase()
  return msg.includes('column') && msg.includes('does not exist')
}

async function hasColumn(supabase, table, column) {
  const { error } = await supabase.from(table).select(column).limit(1)
  if (!error) return true
  if (isMissingColumn(error)) return false
  throw error
}

export async function GET(request) {
  const session = await validateSession(request, 'admin')
  if (!session.valid) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const supabase = createClient()
  let cycles = []
  let error = null
  const withPolicy = await supabase
    .from('ram_cycles')
    .select(
      'id, code, name, is_active, starts_at, ends_at, created_at, loan_qty_cap_pensioner, loan_qty_cap_other, loan_grace_qty, price_junior, price_senior, price_executive, price_undefined, eligible_loan_qty_pensioner, eligible_loan_qty_retiree, eligible_loan_qty_active, grace_loan_qty_pensioner, grace_loan_qty_retiree, grace_loan_qty_active'
    )
    .order('id', { ascending: false })
  if (withPolicy.error && isMissingColumn(withPolicy.error)) {
    const fallback = await supabase
      .from('ram_cycles')
      .select('id, code, name, is_active, starts_at, ends_at, created_at')
      .order('id', { ascending: false })
    cycles = fallback.data || []
    error = fallback.error
  } else {
    cycles = withPolicy.data || []
    error = withPolicy.error
  }

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  const active = (cycles || []).find(c => c.is_active)
  return NextResponse.json({ ok: true, cycles: cycles || [], active_cycle_id: active?.id || null })
}

export async function POST(request) {
  const session = await validateSession(request, 'admin')
  if (!session.valid) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const supabase = createClient()
  const body = await request.json().catch(() => ({}))

  const codeRes = validateCycleCode(body.code)
  const nameRes = validateCycleName(body.name)
  if (!codeRes.ok) return NextResponse.json({ ok: false, error: codeRes.error }, { status: 400 })
  if (!nameRes.ok) return NextResponse.json({ ok: false, error: nameRes.error }, { status: 400 })

  const makeActive = !!body.make_active
  if (makeActive) {
    const { error: offErr } = await supabase.from('ram_cycles').update({ is_active: false }).neq('id', 0)
    if (offErr) return NextResponse.json({ ok: false, error: offErr.message }, { status: 500 })
  }

  const insertPayload = { code: codeRes.value, name: nameRes.value, is_active: makeActive }
  if (body.starts_at) insertPayload.starts_at = body.starts_at
  if (body.ends_at) insertPayload.ends_at = body.ends_at

  const cyclesHasSettings = await hasColumn(supabase, 'ram_cycles', 'eligible_loan_qty_active').catch(() => false)
  if (cyclesHasSettings) {
    insertPayload.loan_qty_cap_pensioner = 0
    insertPayload.loan_qty_cap_other = 0
    insertPayload.loan_grace_qty = 0
    insertPayload.price_junior = 0
    insertPayload.price_senior = 0
    insertPayload.price_executive = 0
    insertPayload.price_undefined = 0
    insertPayload.eligible_loan_qty_pensioner = 0
    insertPayload.eligible_loan_qty_retiree = 0
    insertPayload.eligible_loan_qty_active = 0
    insertPayload.grace_loan_qty_pensioner = 0
    insertPayload.grace_loan_qty_retiree = 0
    insertPayload.grace_loan_qty_active = 0
  }

  const { data, error } = await supabase
    .from('ram_cycles')
    .insert(insertPayload)
    .select(
      'id, code, name, is_active, starts_at, ends_at, created_at, loan_qty_cap_pensioner, loan_qty_cap_other, loan_grace_qty, price_junior, price_senior, price_executive, price_undefined, eligible_loan_qty_pensioner, eligible_loan_qty_retiree, eligible_loan_qty_active, grace_loan_qty_pensioner, grace_loan_qty_retiree, grace_loan_qty_active'
    )
    .single()

  if (error) {
    if (isMissingColumn(error)) {
      const existing = await supabase
        .from('ram_cycles')
        .select('id, code, name, is_active, starts_at, ends_at, created_at')
        .eq('code', codeRes.value)
        .maybeSingle()
      if (existing.error) return NextResponse.json({ ok: false, error: existing.error.message }, { status: 500 })
      if (existing.data?.id) {
        return NextResponse.json({
          ok: true,
          cycle: existing.data,
          active_cycle_id: makeActive ? existing.data?.id : await getActiveRamCycleId(supabase),
        })
      }

      const fallbackIns = await supabase
        .from('ram_cycles')
        .insert(insertPayload)
        .select('id, code, name, is_active, starts_at, ends_at, created_at')
        .single()
      if (fallbackIns.error) return NextResponse.json({ ok: false, error: fallbackIns.error.message }, { status: 500 })
      return NextResponse.json({
        ok: true,
        cycle: fallbackIns.data,
        active_cycle_id: makeActive ? fallbackIns.data?.id : await getActiveRamCycleId(supabase),
      })
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, cycle: data, active_cycle_id: makeActive ? data?.id : await getActiveRamCycleId(supabase) })
}

export async function PATCH(request) {
  const session = await validateSession(request, 'admin')
  if (!session.valid) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const supabase = createClient()
  const body = await request.json().catch(() => ({}))

  const id = body.id != null ? Number(body.id) : null
  const codeRes = body.code ? validateCycleCode(body.code) : null
  if (!id && !codeRes) return NextResponse.json({ ok: false, error: 'Cycle id or code is required' }, { status: 400 })
  if (codeRes && !codeRes.ok) return NextResponse.json({ ok: false, error: codeRes.error }, { status: 400 })

  const targetQuery = supabase.from('ram_cycles').select('id').limit(1)
  let targetRes = null
  if (id) targetRes = await targetQuery.eq('id', id).maybeSingle()
  else targetRes = await targetQuery.eq('code', codeRes.value).maybeSingle()
  if (targetRes.error) return NextResponse.json({ ok: false, error: targetRes.error.message }, { status: 500 })
  if (!targetRes.data?.id) return NextResponse.json({ ok: false, error: 'Cycle not found' }, { status: 404 })

  const cycleId = targetRes.data.id
  const { error: offErr } = await supabase.from('ram_cycles').update({ is_active: false }).neq('id', 0)
  if (offErr) return NextResponse.json({ ok: false, error: offErr.message }, { status: 500 })

  const { error: onErr } = await supabase.from('ram_cycles').update({ is_active: true }).eq('id', cycleId)
  if (onErr) return NextResponse.json({ ok: false, error: onErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, active_cycle_id: cycleId })
}

export async function PUT(request) {
  const session = await validateSession(request, 'admin')
  if (!session.valid) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const idRes = validateNumber(body.id, { min: 1, integer: true })
  if (!idRes.isValid) return NextResponse.json({ ok: false, error: 'Invalid cycle id' }, { status: 400 })

  const supabase = createClient()
  const currentRes = await supabase
    .from('ram_cycles')
    .select(
      'id, code, name, is_active, starts_at, ends_at, created_at, loan_qty_cap_pensioner, loan_qty_cap_other, loan_grace_qty, price_junior, price_senior, price_executive, price_undefined, eligible_loan_qty_pensioner, eligible_loan_qty_retiree, eligible_loan_qty_active, grace_loan_qty_pensioner, grace_loan_qty_retiree, grace_loan_qty_active'
    )
    .eq('id', idRes.value)
    .maybeSingle()

  if (currentRes.error) {
    if (isMissingColumn(currentRes.error)) {
      return NextResponse.json(
        { ok: false, error: 'Cycle settings columns are missing in your database. Run migrations/add-ram-cycle-policy-settings.sql in Supabase.' },
        { status: 500 }
      )
    }
    return NextResponse.json({ ok: false, error: currentRes.error.message }, { status: 500 })
  }
  if (!currentRes.data?.id) return NextResponse.json({ ok: false, error: 'Cycle not found' }, { status: 404 })

  const updates = {}
  const next = { ...currentRes.data }

  const intField = (key, label, max = 100) => {
    if (body[key] === undefined) return null
    const res = validateNumber(body[key], { min: 0, max, integer: true })
    if (!res.isValid) return { error: `Invalid ${label}` }
    next[key] = res.value
    updates[key] = res.value
    return null
  }

  const moneyField = (key, label) => {
    if (body[key] === undefined) return null
    const res = validateNumber(body[key], { min: 0, max: 1000000000, integer: true })
    if (!res.isValid) return { error: `Invalid ${label}` }
    next[key] = res.value
    updates[key] = res.value
    return null
  }

  const e1 = intField('loan_qty_cap_pensioner', 'pensioner loan cap')
  if (e1?.error) return NextResponse.json({ ok: false, error: e1.error }, { status: 400 })
  const e2 = intField('loan_qty_cap_other', 'loan cap')
  if (e2?.error) return NextResponse.json({ ok: false, error: e2.error }, { status: 400 })
  const e3 = intField('loan_grace_qty', 'grace quantity')
  if (e3?.error) return NextResponse.json({ ok: false, error: e3.error }, { status: 400 })

  const e4 = moneyField('price_junior', 'Junior price')
  if (e4?.error) return NextResponse.json({ ok: false, error: e4.error }, { status: 400 })
  const e5 = moneyField('price_senior', 'Senior price')
  if (e5?.error) return NextResponse.json({ ok: false, error: e5.error }, { status: 400 })
  const e6 = moneyField('price_executive', 'Executive price')
  if (e6?.error) return NextResponse.json({ ok: false, error: e6.error }, { status: 400 })
  const e7 = moneyField('price_undefined', 'Undefined price')
  if (e7?.error) return NextResponse.json({ ok: false, error: e7.error }, { status: 400 })

  const e8 = intField('eligible_loan_qty_pensioner', 'eligible Pensioner max qty')
  if (e8?.error) return NextResponse.json({ ok: false, error: e8.error }, { status: 400 })
  const e9 = intField('eligible_loan_qty_retiree', 'eligible Retiree max qty')
  if (e9?.error) return NextResponse.json({ ok: false, error: e9.error }, { status: 400 })
  const e10 = intField('eligible_loan_qty_active', 'eligible Active max qty')
  if (e10?.error) return NextResponse.json({ ok: false, error: e10.error }, { status: 400 })

  const e11 = intField('grace_loan_qty_pensioner', 'non-eligible Pensioner max qty')
  if (e11?.error) return NextResponse.json({ ok: false, error: e11.error }, { status: 400 })
  const e12 = intField('grace_loan_qty_retiree', 'non-eligible Retiree max qty')
  if (e12?.error) return NextResponse.json({ ok: false, error: e12.error }, { status: 400 })
  const e13 = intField('grace_loan_qty_active', 'non-eligible Active max qty')
  if (e13?.error) return NextResponse.json({ ok: false, error: e13.error }, { status: 400 })

  if (!Object.keys(updates).length) return NextResponse.json({ ok: false, error: 'No updates provided' }, { status: 400 })

  const eligP = Math.max(0, Math.trunc(Number(next.eligible_loan_qty_pensioner ?? 1)))
  const eligR = Math.max(0, Math.trunc(Number(next.eligible_loan_qty_retiree ?? 2)))
  const eligA = Math.max(0, Math.trunc(Number(next.eligible_loan_qty_active ?? 2)))
  const graceP = Math.max(0, Math.trunc(Number(next.grace_loan_qty_pensioner ?? 1)))
  const graceR = Math.max(0, Math.trunc(Number(next.grace_loan_qty_retiree ?? 0)))
  const graceA = Math.max(0, Math.trunc(Number(next.grace_loan_qty_active ?? 1)))

  if (graceP > eligP) return NextResponse.json({ ok: false, error: `Non-eligible Pensioner max qty cannot exceed ${eligP}` }, { status: 400 })
  if (graceR > eligR) return NextResponse.json({ ok: false, error: `Non-eligible Retiree max qty cannot exceed ${eligR}` }, { status: 400 })
  if (graceA > eligA) return NextResponse.json({ ok: false, error: `Non-eligible Active max qty cannot exceed ${eligA}` }, { status: 400 })

  const legacyP = Math.max(0, Math.trunc(Number(next.loan_qty_cap_pensioner ?? 1)))
  const legacyO = Math.max(0, Math.trunc(Number(next.loan_qty_cap_other ?? 2)))
  const legacyG = Math.max(0, Math.trunc(Number(next.loan_grace_qty ?? 1)))
  if (legacyG > Math.min(legacyP, legacyO)) {
    return NextResponse.json({ ok: false, error: `Grace quantity cannot exceed ${Math.min(legacyP, legacyO)}` }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('ram_cycles')
    .update(updates)
    .eq('id', idRes.value)
    .select(
      'id, code, name, is_active, starts_at, ends_at, created_at, loan_qty_cap_pensioner, loan_qty_cap_other, loan_grace_qty, price_junior, price_senior, price_executive, price_undefined, eligible_loan_qty_pensioner, eligible_loan_qty_retiree, eligible_loan_qty_active, grace_loan_qty_pensioner, grace_loan_qty_retiree, grace_loan_qty_active'
    )
    .single()

  if (error) {
    if (isMissingColumn(error)) {
      return NextResponse.json(
        { ok: false, error: 'Cycle settings columns are missing in your database. Run migrations/add-ram-cycle-policy-settings.sql in Supabase.' },
        { status: 500 }
      )
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, cycle: data })
}
