import { createClient } from '../../../../../lib/supabaseServer'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const supabase = createClient()
    const { searchParams } = new URL(request.url)
    const itemFilter = (searchParams.get('item') || '').trim()
    const pageParam = Number(searchParams.get('page') || 1)
    const pageSizeParam = Number(searchParams.get('pageSize') || 25)

    // Try primary view first
    const { data: viewRows, error: viewError } = await supabase
      .from('v_inventory_status')
      .select('*')
      .order('item_name', { ascending: true })

    if (viewError || !viewRows || viewRows.length === 0) {
      // Fallback aggregation from base tables to avoid hard failures or empty views
      const [ordersRes, linesRes, itemsRes] = await Promise.all([
        supabase.from('orders').select('order_id, status').in('status', ['Pending', 'Posted', 'Delivered']),
        supabase.from('order_lines').select('order_id, item_id, qty'),
        supabase.from('items').select('item_id, sku, name')
      ])

      if (ordersRes.error || linesRes.error || itemsRes.error) {
        const msg = ordersRes.error?.message || linesRes.error?.message || itemsRes.error?.message || 'Fallback aggregation failed'
        return NextResponse.json({ ok: false, error: msg, data: [] }, { status: 200 })
      }

      const orderStatusMap = new Map(ordersRes.data.map(o => [o.order_id, o.status]))
      const itemMeta = new Map(itemsRes.data.map(i => [i.item_id, i]))

      const aggByItem = new Map()
      for (const line of (linesRes.data || [])) {
        const status = orderStatusMap.get(line.order_id)
        if (!status) continue
        const key = line.item_id
        const entry = aggByItem.get(key) || { item_id: key, pending_qty: 0, posted_qty: 0, delivered_qty: 0 }
        if (status === 'Pending') entry.pending_qty += Number(line.qty || 0)
        else if (status === 'Posted') entry.posted_qty += Number(line.qty || 0)
        else if (status === 'Delivered') entry.delivered_qty += Number(line.qty || 0)
        aggByItem.set(key, entry)
      }

      let rows = Array.from(aggByItem.values()).map(r => {
        const meta = itemMeta.get(r.item_id) || {}
        const allocated = (r.pending_qty || 0) + (r.posted_qty || 0)
        return {
          item_id: r.item_id,
          item_name: meta.name || meta.sku || `Item ${r.item_id}`,
          sku: meta.sku || null,
          total_demand: allocated,
          allocated_qty: allocated,
          pending_delivery_qty: r.posted_qty || 0,
          delivered_qty: r.delivered_qty || 0,
        }
      })

      if (itemFilter) {
        const q = itemFilter.toLowerCase()
        rows = rows.filter(r => (r.item_name || '').toLowerCase().includes(q) || (r.sku || '').toLowerCase().includes(q))
      }

      const start = (pageParam - 1) * pageSizeParam
      const end = start + pageSizeParam
      const paged = rows.slice(start, end)

      return NextResponse.json({ ok: true, data: paged, total: rows.length })
    }

    // View returned rows
    let rows = viewRows
    if (itemFilter) {
      const q = itemFilter.toLowerCase()
      rows = rows.filter(r => (r.item_name || '').toLowerCase().includes(q) || (r.sku || '').toLowerCase().includes(q))
    }

    const start = (pageParam - 1) * pageSizeParam
    const end = start + pageSizeParam
    const paged = rows.slice(start, end)

    return NextResponse.json({ ok: true, data: paged, total: rows.length })
  } catch (error) {
    console.error('API error (items inventory):', error)
    return NextResponse.json({ ok: false, error: error.message || 'Internal server error', data: [] })
  }
}

export async function OPTIONS() {
  return NextResponse.json({ ok: true })
}