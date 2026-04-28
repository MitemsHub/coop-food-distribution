import { NextResponse } from 'next/server'
import { validateSession } from '@/lib/validation'
import { createClient } from '@/lib/supabaseServer'
import * as XLSX from 'xlsx/xlsx.mjs'

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
  if (String(cycleParam || '').toLowerCase() === 'all') return { cycleId: null, activeCycleId: null }

  const parsed = cycleParam != null ? Number(cycleParam) : null
  if (parsed != null && Number.isFinite(parsed)) return { cycleId: Math.trunc(parsed), activeCycleId: null }

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

function toInt(value) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

export async function GET(req) {
  try {
    const session = await validateSession(req, 'admin')
    if (!session.valid) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const supabase = createClient()
    const { searchParams } = new URL(req.url)
    const deliveryLocationId = toInt(searchParams.get('delivery_location_id'))
    const from = (searchParams.get('from') || '').trim()
    const to = (searchParams.get('to') || '').trim()
    const ramCycleParam = (searchParams.get('ram_cycle_id') || searchParams.get('cycle_id') || '').trim()

    const ordersHasCycle = await hasColumn(supabase, 'ram_orders', 'ram_cycle_id')
    const { cycleId } = await resolveRamCycleId({ supabase, cycleParam: ramCycleParam, ordersHasCycle })

    const selectCols =
      'id,created_at,status,payment_option,member_id,qty,unit_price,principal_amount,interest_amount,total_amount,ram_delivery_location_id'

    let baseQ = supabase.from('ram_orders').select(selectCols)
    if (Number.isFinite(deliveryLocationId) && deliveryLocationId > 0) {
      baseQ = baseQ.eq('ram_delivery_location_id', deliveryLocationId)
    }
    if (from) baseQ = baseQ.gte('created_at', from)
    if (to) baseQ = baseQ.lte('created_at', `${to}T23:59:59`)
    if (ordersHasCycle && cycleId != null) baseQ = baseQ.eq('ram_cycle_id', cycleId)

    const batchSize = 1000
    let start = 0
    const allOrders = []
    while (true) {
      const { data: page, error: pageErr } = await baseQ
        .order('id', { ascending: true })
        .range(start, start + batchSize - 1)
      if (pageErr) throw new Error(pageErr.message)
      if (!page || page.length === 0) break
      allOrders.push(...page)
      if (page.length < batchSize) break
      start += batchSize
    }

    const memberIds = Array.from(new Set((allOrders || []).map((o) => String(o.member_id || '').trim()).filter(Boolean)))
    const locationIds = Array.from(
      new Set((allOrders || []).map((o) => Number(o.ram_delivery_location_id)).filter((n) => Number.isFinite(n) && n > 0))
    )

    const [membersRes, locationsRes] = await Promise.all([
      memberIds.length
        ? supabase.from('members').select('member_id,full_name,branches:branch_id(code,name)').in('member_id', memberIds)
        : Promise.resolve({ data: [], error: null }),
      locationIds.length
        ? supabase.from('ram_delivery_locations').select('id,delivery_location,name,phone,address').in('id', locationIds)
        : Promise.resolve({ data: [], error: null }),
    ])

    if (membersRes.error) throw new Error(membersRes.error.message)
    if (locationsRes.error) throw new Error(locationsRes.error.message)

    const membersById = new Map((membersRes.data || []).map((m) => [String(m.member_id), m]))
    const locationsById = new Map((locationsRes.data || []).map((l) => [Number(l.id), l]))

    const rows = (allOrders || []).map((o) => {
      const m = membersById.get(String(o.member_id)) || null
      const loc = locationsById.get(Number(o.ram_delivery_location_id)) || null
      const payment = String(o.payment_option || '')
      const principal = Number(o.principal_amount || 0)
      const interest = Number(o.interest_amount || 0)
      const total = Number(o.total_amount || 0)

      return {
        OrderID: o.id,
        CreatedAt: o.created_at,
        Status: o.status,
        Payment: payment,
        MemberID: o.member_id,
        MemberName: m?.full_name || '',
        DeliveryLocation: loc?.delivery_location || '',
        VendorName: loc?.name || '',
        VendorPhone: loc?.phone || '',
        VendorAddress: loc?.address || '',
        Qty: Number(o.qty || 0),
        UnitPrice: Number(o.unit_price || 0),
        Principal: principal,
        Interest: payment === 'Loan' ? interest : 0,
        Total: total,
        Signature: '',
      }
    })

    const wb = XLSX.utils.book_new()
    const mk = (a) => XLSX.utils.json_to_sheet(a)
    XLSX.utils.book_append_sheet(wb, mk(rows), 'Master')
    XLSX.utils.book_append_sheet(wb, mk(rows.filter((r) => r.Payment === 'Cash')), 'Cash')
    XLSX.utils.book_append_sheet(wb, mk(rows.filter((r) => r.Payment === 'Loan')), 'Loan')
    XLSX.utils.book_append_sheet(wb, mk(rows.filter((r) => r.Payment === 'Savings')), 'Savings')

    const b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' })
    const filename = `Ram_Delivery_Pack_${deliveryLocationId && deliveryLocationId > 0 ? deliveryLocationId : 'ALL'}.xlsx`

    return NextResponse.json({
      ok: true,
      filename,
      data: b64,
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message || 'Internal server error' }, { status: 500 })
  }
}
