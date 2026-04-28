// app/api/admin/orders/list/route.js
import { NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabaseServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function hasColumn(supabase, table, column) {
  const { error } = await supabase.from(table).select(column).limit(1)
  return !error
}

async function resolveCycleId(supabase, searchParams, ordersHasCycle) {
  if (!ordersHasCycle) return null
  const raw = searchParams.get('cycle_id')
  if (raw != null && raw !== '') {
    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) throw new Error('Invalid cycle_id')
    return parsed
  }
  const { data, error } = await supabase.from('cycles').select('id').eq('is_active', true).maybeSingle()
  if (error) throw new Error(error.message)
  return data?.id ?? null
}

export async function GET(req) {
  try {
    const supabase = createClient()
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || 'Pending'
    const branchCode = (searchParams.get('branch') || '').trim().toUpperCase()
    const payment = searchParams.get('payment') || ''
    const term = searchParams.get('term') || ''
    const limit = Number(searchParams.get('limit') || 50)
    const cursor = searchParams.get('cursor') // order_id
    const dir = (searchParams.get('dir') || 'next').toLowerCase() // next|prev
    const ordersHasCycle = await hasColumn(supabase, 'orders', 'cycle_id')
    const cycleId = await resolveCycleId(supabase, searchParams, ordersHasCycle)
    if (ordersHasCycle && !cycleId) {
      return NextResponse.json({ ok: false, error: 'No active cycle found' }, { status: 400 })
    }

    // resolve delivery branch id if provided
    let deliveryBranchId = null
    if (branchCode) {
      const { data: br } = await supabase.from('branches').select('id').eq('code', branchCode).single()
      deliveryBranchId = br?.id || null
    }

    const selectCols = `
      order_id, created_at, posted_at, status, payment_option, total_amount,
      member_id, member_name_snapshot, member_category_snapshot,
      delivery:delivery_branch_id(code,name),
      member_branch:branch_id(code,name),
      departments:department_id(name),
      order_lines(id, qty, unit_price, amount, items:item_id(sku,name))
    `

    let q = supabase
      .from('orders')
      .select(selectCols)
      .eq('status', status)
      .order('order_id', { ascending: false })

    if (ordersHasCycle) q = q.eq('cycle_id', cycleId)
    if (deliveryBranchId) q = q.eq('delivery_branch_id', deliveryBranchId)
    if (payment) q = q.eq('payment_option', payment)
    if (term) q = q.or('member_id.ilike.%' + term + '%,member_name_snapshot.ilike.%' + term + '%')
    if (cursor) {
      // descending by order_id: "next" page means < cursor
      q = dir === 'next' ? q.lt('order_id', Number(cursor)) : q.gt('order_id', Number(cursor))
    }

    const { data: pageRaw, error } = await q.limit(limit + 1)
    if (error) throw new Error(error.message)

    let nextCursor = null
    let orders = pageRaw || []
    if (orders.length > limit) {
      nextCursor = orders[limit - 1]?.order_id
      orders = orders.slice(0, limit)
    }

    // Summary: count + sum(total_amount) for current filter (no cursor)
    let count = 0
    let totalAmount = 0
    {
      let qs = supabase.from('orders').select('total_amount', { count: 'exact' }).eq('status', status)
      if (ordersHasCycle) qs = qs.eq('cycle_id', cycleId)
      if (deliveryBranchId) qs = qs.eq('delivery_branch_id', deliveryBranchId)
      if (payment) qs = qs.eq('payment_option', payment)
      if (term) qs = qs.or('member_id.ilike.%' + term + '%,member_name_snapshot.ilike.%' + term + '%')
      const { data: all, error: sErr, count: c } = await qs
      if (!sErr) {
        count = c || 0
        totalAmount = (all || []).reduce((s, r) => s + Number(r.total_amount || 0), 0)
      }
    }

    return NextResponse.json({ ok: true, orders, nextCursor, summary: { count, totalAmount } })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
