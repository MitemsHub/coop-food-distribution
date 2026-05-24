import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabaseServer'
import { verify } from '@/lib/signing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

async function resolveRamCycleId({ supabase, cycleParam, ordersHasCycle }) {
  if (!ordersHasCycle) return { cycleId: null, activeCycleId: null }
  const raw = String(cycleParam ?? '').trim()
  if (raw.toLowerCase() === 'all') return { cycleId: null, activeCycleId: null }

  if (raw) {
    if (/^\d+$/.test(raw)) return { cycleId: Math.trunc(Number(raw)), activeCycleId: null }
    return { cycleId: raw, activeCycleId: null }
  }

  const { data: active, error: aErr } = await supabase
    .from('ram_cycles')
    .select('id')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .maybeSingle()

  if (aErr) {
    if (!isMissingTable(aErr, 'ram_cycles')) throw aErr
    return { cycleId: null, activeCycleId: null }
  }
  if (active?.id) return { cycleId: null, activeCycleId: active.id }

  const { data: latest, error: lErr } = await supabase
    .from('ram_cycles')
    .select('id')
    .order('created_at', { ascending: false })
    .maybeSingle()
  if (lErr) {
    if (!isMissingTable(lErr, 'ram_cycles')) throw lErr
    return { cycleId: null, activeCycleId: null }
  }
  return { cycleId: null, activeCycleId: latest?.id || null }
}

function asInt(value, fallback) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

function getLoanInterest(order) {
  return Number(order?.loan_interest ?? order?.interest_amount ?? 0)
}

export async function GET(req) {
  try {
    const supabase = createClient()
    const token = req.cookies.get('rep_token')?.value
    const claim = token && verify(token)
    if (!claim || claim.role !== 'rep') return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
    if (claim.module && claim.module !== 'ram') return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
    const rawIds = Array.isArray(claim.ram_delivery_location_ids) ? claim.ram_delivery_location_ids : []
    const ids = (rawIds.length ? rawIds : [claim.ram_delivery_location_id])
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n) && n > 0)
    if (!ids.length) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const statusRaw = (searchParams.get('status') || '').trim()
    const payment = (searchParams.get('payment') || '').trim()
    const memberId = (searchParams.get('member_id') || '').trim().toUpperCase()
    const term = (searchParams.get('term') || '').trim()
    const deliveryLocationId = asInt(searchParams.get('delivery_location_id'), null)
    const from = (searchParams.get('from') || '').trim()
    const to = (searchParams.get('to') || '').trim()
    const ramCycleParam = (searchParams.get('ram_cycle_id') || searchParams.get('cycle_id') || '').trim()
    const limit = Math.min(Math.max(asInt(searchParams.get('limit'), 300), 1), 1000)

    const allowedPayment = new Set(['Cash', 'Loan', 'Savings'])
    const allowedStatus = new Set(['Approved', 'Delivered'])
    const status = allowedStatus.has(statusRaw) ? statusRaw : 'Approved'

    const ordersHasCycle = await hasColumn(supabase, 'ram_orders', 'ram_cycle_id')
    const { cycleId, activeCycleId } = await resolveRamCycleId({
      supabase,
      cycleParam: ramCycleParam,
      ordersHasCycle
    })
    const effectiveCycleId = ordersHasCycle ? (cycleId != null ? cycleId : activeCycleId) : null
    const cyclesHasLoanRate = await hasColumn(supabase, 'ram_cycles', 'loan_interest_rate_pct')
    const cyclesHasVendorRate = await hasColumn(supabase, 'ram_cycles', 'vendor_deduction_rate_pct')

    let query = supabase
      .from('ram_orders')
      .select('*')
      .eq('status', status)
      .in('ram_delivery_location_id', ids)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (payment && allowedPayment.has(payment)) query = query.eq('payment_option', payment)
    if (memberId) query = query.eq('member_id', memberId)
    if (Number.isFinite(deliveryLocationId) && deliveryLocationId > 0) {
      if (ids.includes(deliveryLocationId)) query = query.eq('ram_delivery_location_id', deliveryLocationId)
      else return NextResponse.json({ ok: true, orders: [] })
    }
    if (from) query = query.gte('created_at', from)
    if (to) query = query.lte('created_at', `${to}T23:59:59`)
    if (ordersHasCycle && effectiveCycleId != null) query = query.eq('ram_cycle_id', effectiveCycleId)

    const { data: orders, error } = await query
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

    let filtered = orders || []

    const cycleIds = ordersHasCycle
      ? Array.from(
          new Set(
            filtered
              .map((o) => Number(o?.ram_cycle_id))
              .filter((n) => Number.isFinite(n) && n > 0)
          )
        )
      : []

    const cycleRates = new Map()
    if ((cyclesHasLoanRate || cyclesHasVendorRate) && cycleIds.length > 0) {
      const select = `id${cyclesHasLoanRate ? ', loan_interest_rate_pct' : ''}${cyclesHasVendorRate ? ', vendor_deduction_rate_pct' : ''}`
      const { data: rows, error: rErr } = await supabase.from('ram_cycles').select(select).in('id', cycleIds)
      if (!rErr && Array.isArray(rows)) {
        for (const r of rows) {
          cycleRates.set(Number(r.id), {
            loan_interest_rate_pct: Math.max(0, Number(r.loan_interest_rate_pct || 0)),
            vendor_deduction_rate_pct: Math.max(0, Number(r.vendor_deduction_rate_pct || 0)),
          })
        }
      }
    }

    const memberIds = Array.from(new Set(filtered.map((o) => String(o.member_id || '').trim()).filter(Boolean)))
    const locationIds = Array.from(
      new Set(filtered.map((o) => Number(o.ram_delivery_location_id)).filter((n) => Number.isFinite(n) && n > 0))
    )

    const [membersRes, locationsRes] = await Promise.all([
      memberIds.length
        ? supabase.from('members').select('member_id,full_name,phone,branches:branch_id(code,name)').in('member_id', memberIds)
        : Promise.resolve({ data: [], error: null }),
      locationIds.length
        ? supabase.from('ram_delivery_locations').select('id,delivery_location,name,phone,address,is_active').in('id', locationIds)
        : Promise.resolve({ data: [], error: null }),
    ])

    if (membersRes.error) return NextResponse.json({ ok: false, error: membersRes.error.message }, { status: 500 })
    if (locationsRes.error) return NextResponse.json({ ok: false, error: locationsRes.error.message }, { status: 500 })

    const membersById = new Map((membersRes.data || []).map((m) => [String(m.member_id), m]))
    const locationsById = new Map((locationsRes.data || []).map((l) => [Number(l.id), l]))

    const enriched = filtered.map((o) => {
      const m = membersById.get(String(o.member_id)) || null
      const locationId = Number(o.ram_delivery_location_id)
      const loc = Number.isFinite(locationId) ? locationsById.get(locationId) || null : null
      const cycleIdNum = ordersHasCycle ? Number(o?.ram_cycle_id) : null
      const r = Number.isFinite(cycleIdNum) ? cycleRates.get(cycleIdNum) || null : null
      const loanRatePct = cyclesHasLoanRate ? Number(r?.loan_interest_rate_pct || 0) : 6
      const vendorRatePct = cyclesHasVendorRate ? Number(r?.vendor_deduction_rate_pct || 0) : 6
      const principal = Number(o?.principal_amount || 0)
      const vendorFee = Math.round(principal * (Math.max(0, vendorRatePct) / 100))
      return {
        ...o,
        ram_delivery_location_id: Number.isFinite(locationId) ? locationId : null,
        loan_interest: getLoanInterest(o),
        loan_interest_rate_pct: Math.max(0, loanRatePct),
        vendor_deduction_rate_pct: Math.max(0, vendorRatePct),
        payment_vendor: Math.max(0, principal - vendorFee),
        member: m
          ? {
              member_id: m.member_id,
              full_name: m.full_name,
              phone: m.phone || '',
              branch: m.branches?.code ? { code: m.branches.code, name: m.branches.name || '' } : null,
            }
          : null,
        delivery_location: loc
          ? {
              id: loc.id,
              delivery_location: loc.delivery_location || '',
              name: loc.name || '',
              phone: loc.phone || '',
              address: loc.address || '',
              is_active: loc.is_active,
            }
          : null,
      }
    })

    let finalOrders = enriched
    if (term) {
      const t = term.toLowerCase()
      finalOrders = enriched.filter((o) => {
        const idTxt = String(o.id || '').toLowerCase()
        const mid = String(o.member_id || '').toLowerCase()
        const name = String(o.member?.full_name || '').toLowerCase()
        return idTxt.includes(t) || mid.includes(t) || name.includes(t)
      })
    }

    return NextResponse.json({ ok: true, orders: finalOrders })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message || 'Internal server error', orders: [] }, { status: 500 })
  }
}
