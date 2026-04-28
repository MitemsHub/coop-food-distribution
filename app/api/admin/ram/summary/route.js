import { NextResponse } from 'next/server'
import { validateSession } from '@/lib/validation'
import { createClient } from '@/lib/supabaseServer'

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
  if (active?.id) return { cycleId: active.id, activeCycleId: active.id }

  const { data: latest, error: lErr } = await supabase
    .from('ram_cycles')
    .select('id')
    .order('created_at', { ascending: false })
    .maybeSingle()
  if (lErr) {
    if (!isMissingTable(lErr, 'ram_cycles')) throw lErr
    return { cycleId: null, activeCycleId: null }
  }
  return { cycleId: latest?.id || null, activeCycleId: null }
}

function addAgg(map, key, row) {
  if (!map.has(key)) {
    map.set(key, { key, orders: 0, qty: 0, amount: 0, loan_interest: 0 })
  }
  const agg = map.get(key)
  agg.orders += 1
  agg.qty += Number(row.qty || 0)
  agg.amount += Number(row.total_amount || 0)
  agg.loan_interest += Number(row.loan_interest ?? row.interest_amount ?? 0)
}

function addLocationAgg(map, key, row) {
  if (!map.has(key)) {
    map.set(key, { key, orders: 0, pending_orders: 0, approved_orders: 0, qty: 0, amount: 0, loan_interest: 0 })
  }
  const agg = map.get(key)
  const status = String(row.status || '')
  agg.orders += 1
  if (status === 'Pending') agg.pending_orders += 1
  if (status === 'Approved') agg.approved_orders += 1
  agg.qty += Number(row.qty || 0)
  agg.amount += Number(row.total_amount || 0)
  agg.loan_interest += Number(row.loan_interest ?? row.interest_amount ?? 0)
}

export async function GET(req) {
  try {
    const session = await validateSession(req, 'admin')
    if (!session.valid) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const supabase = createClient()
    const { searchParams } = new URL(req.url)
    const cycleParam = searchParams.get('ram_cycle_id') || searchParams.get('cycle_id')
    const ordersHasCycle = await hasColumn(supabase, 'ram_orders', 'ram_cycle_id')
    const { cycleId, activeCycleId } = await resolveRamCycleId({ supabase, cycleParam, ordersHasCycle })

    let baseQ = supabase
      .from('ram_orders')
      .select('id,status,payment_option,member_category,member_grade,qty,total_amount,interest_amount,ram_delivery_location_id,created_at,ram_cycle_id')
      .order('created_at', { ascending: false })
      .limit(2000)
    if (ordersHasCycle && cycleId != null) baseQ = baseQ.eq('ram_cycle_id', cycleId)

    const { data: orders, error } = await baseQ

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

    const rows = orders || []
    const locationIds = Array.from(
      new Set(
        rows
          .map((o) => Number(o.ram_delivery_location_id))
          .filter((n) => Number.isFinite(n) && n > 0)
      )
    )

    const { data: locations, error: locErr } = locationIds.length
      ? await supabase
          .from('ram_delivery_locations')
          .select('id,delivery_location,name,is_active')
          .in('id', locationIds)
      : { data: [], error: null }

    if (locErr) return NextResponse.json({ ok: false, error: locErr.message }, { status: 500 })

    const locationsById = new Map((locations || []).map((l) => [Number(l.id), l]))

    const byStatus = new Map()
    const byPayment = new Map()
    const byCategory = new Map()
    const byGrade = new Map()
    const byLocation = new Map()

    let totalOrders = 0
    let totalQty = 0
    let totalAmount = 0
    let totalLoanInterest = 0

    for (const row of rows) {
      totalOrders += 1
      totalQty += Number(row.qty || 0)
      totalAmount += Number(row.total_amount || 0)
      totalLoanInterest += Number(row.loan_interest ?? row.interest_amount ?? 0)

      addAgg(byStatus, String(row.status || 'Unknown'), row)
      addAgg(byPayment, String(row.payment_option || 'Unknown'), row)
      addAgg(byCategory, String(row.member_category || 'Unknown'), row)
      addAgg(byGrade, String(row.member_grade || 'Unknown'), row)

      const loc = locationsById.get(Number(row.ram_delivery_location_id))
      const locKey = loc?.delivery_location || 'Unknown'
      addLocationAgg(byLocation, String(locKey), row)
    }

    const toSorted = (m) => Array.from(m.values()).sort((a, b) => b.orders - a.orders)

    return NextResponse.json({
      ok: true,
      totals: { orders: totalOrders, qty: totalQty, amount: totalAmount, loan_interest: totalLoanInterest },
      byStatus: toSorted(byStatus),
      byPayment: toSorted(byPayment),
      byCategory: toSorted(byCategory),
      byGrade: toSorted(byGrade),
      byLocation: toSorted(byLocation),
      meta: {
        active_ram_cycle_id: activeCycleId,
        used_ram_cycle_id: ordersHasCycle ? cycleId : null,
        locations: (locations || []).map((l) => ({
          id: l.id,
          delivery_location: l.delivery_location || '',
          name: l.name || '',
          is_active: !!l.is_active,
        })),
      },
    })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message || 'Internal server error' }, { status: 500 })
  }
}
