// app/api/admin/reports/delivery-dept-items/route.js
import { NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabaseServer'
import { validateSession } from '../../../../../lib/validation'
import { queryDirect } from '../../../../../lib/directDb'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Returns aggregated items demand by delivery branch (branch_code) and department_id
// Response shape: { ok: true, rows: [{ items, price, quantity, amount }] }
export async function GET(req) {
  try {
    const session = await validateSession(req, 'admin')
    if (!session.valid) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }
    const supabase = createClient()
    const { searchParams } = new URL(req.url)
    const branchCode = (searchParams.get('branch') || '').trim() // delivery branch_code
    const departmentId = searchParams.get('department_id')
    
    // Try direct SQL for robust aggregation; fallback to view via Supabase
    try {
      const whereClauses = ["o.status IN ('Pending','Posted','Delivered')"]
      const params = []
      if (branchCode) {
        whereClauses.push('b.code = $1')
        params.push(branchCode)
      }
      if (departmentId) {
        const idx = params.length + 1
        whereClauses.push(`d.id = $${idx}`)
        params.push(Number(departmentId))
      }

      const sql = `
        SELECT 
          b.code AS branch_code,
          b.name AS branch_name,
          d.id   AS department_id,
          d.name AS department_name,
          i.item_id AS item_id,
          i.name AS item_name,
          COALESCE(bip.price, 0)::numeric AS base_price,
          COALESCE(bim.amount, 0)::numeric AS markup,
          (COALESCE(bip.price, 0) + COALESCE(bim.amount, 0))::numeric AS price,
          COALESCE(SUM(ol.qty), 0)::numeric AS total_demand
        FROM orders o
        JOIN order_lines ol ON ol.order_id = o.order_id
        JOIN branches b ON o.delivery_branch_id = b.id
        JOIN departments d ON o.department_id = d.id
        JOIN items i ON i.item_id = ol.item_id
        LEFT JOIN branch_item_prices bip ON bip.branch_id = b.id AND bip.item_id = i.item_id
        LEFT JOIN branch_item_markups bim ON bim.branch_id = b.id AND bim.item_id = i.item_id AND bim.active = TRUE
        ${whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : ''}
        GROUP BY b.code, b.name, d.id, d.name, i.item_id, i.name, bip.price, bim.amount
        ORDER BY b.name, d.name, i.name
      `

      const result = await queryDirect(sql, params)
      const rows = (result.rows || []).map(r => ({
        items: r.item_name,
        price: Number(r.price),
        quantity: Number(r.total_demand),
        amount: Number(r.price) * Number(r.total_demand),
        branch_code: r.branch_code,
        branch_name: r.branch_name,
        department_id: r.department_id,
        department_name: r.department_name,
        original_price: Number(r.base_price),
        markup: Number(r.markup)
      }))
      return NextResponse.json({ ok: true, rows })
    } catch (directErr) {
      // Fallback: aggregate from v_master_sheet and enrich with base prices + active markups
      let q = supabase
        .from('v_master_sheet')
        .select('branch_code, branch_name, department_id, department_name, item_name, qty')
      if (branchCode) q = q.eq('branch_code', branchCode)
      if (departmentId) q = q.eq('department_id', Number(departmentId))

      const { data, error } = await q
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

      // Aggregate quantities per branch+department+item
      const agg = new Map()
      for (const r of (data || [])) {
        const key = `${r.branch_code}|${r.department_id}|${r.item_name}`
        const prev = agg.get(key)
        const qty = Number(r.qty || 0)
        agg.set(key, {
          branch_code: r.branch_code,
          branch_name: r.branch_name,
          department_id: r.department_id,
          department_name: r.department_name,
          item_name: r.item_name,
          total_qty: Number((prev?.total_qty || 0) + qty)
        })
      }

      const aggregatedRows = Array.from(agg.values())
      // If there is no matching data, avoid downstream empty-`in` queries and return gracefully
      if (!aggregatedRows.length) {
        return NextResponse.json({ ok: true, rows: [] })
      }
      const branchCodes = [...new Set(aggregatedRows.map(r => r.branch_code).filter(Boolean))]
      const itemNames = [...new Set(aggregatedRows.map(r => r.item_name).filter(Boolean))]

      const [{ data: branchesData, error: branchesErr }, { data: itemsData, error: itemsErr }] = await Promise.all([
        supabase.from('branches').select('id, code').in('code', branchCodes),
        supabase.from('items').select('item_id, name').in('name', itemNames)
      ])
      if (branchesErr) return NextResponse.json({ ok: false, error: branchesErr.message }, { status: 500 })
      if (itemsErr) return NextResponse.json({ ok: false, error: itemsErr.message }, { status: 500 })

      const branchIdByCode = new Map((branchesData || []).map(b => [b.code, b.id]))
      const itemIdByName = new Map((itemsData || []).map(i => [i.name, i.item_id]))

      const branchIds = [...new Set(branchCodes.map(c => branchIdByCode.get(c)).filter(Boolean))]
      const itemIds = [...new Set((itemsData || []).map(i => i.item_id))]

      let priceMap = new Map()
      let markupMap = new Map()
      if (branchIds.length && itemIds.length) {
        // Fetch base prices and active markups for branch+item pairs only when we have valid ids
        const [{ data: bipData, error: bipErr }, { data: markupsData, error: markupsErr }] = await Promise.all([
          supabase.from('branch_item_prices').select('branch_id, item_id, price').in('branch_id', branchIds).in('item_id', itemIds),
          supabase.from('branch_item_markups').select('branch_id, item_id, amount, active').in('branch_id', branchIds).in('item_id', itemIds)
        ])
        if (bipErr) return NextResponse.json({ ok: false, error: bipErr.message }, { status: 500 })
        if (markupsErr) return NextResponse.json({ ok: false, error: markupsErr.message }, { status: 500 })
        priceMap = new Map((bipData || []).map(p => [`${p.branch_id}:${p.item_id}`, Number(p.price || 0)]))
        markupMap = new Map((markupsData || []).filter(m => !!m.active).map(m => [`${m.branch_id}:${m.item_id}`, Number(m.amount || 0)]))
      }

      const rows = aggregatedRows.map(r => {
        const branchId = branchIdByCode.get(r.branch_code)
        const itemId = itemIdByName.get(r.item_name)
        const key = branchId && itemId ? `${branchId}:${itemId}` : ''
        const original = key ? (priceMap.get(key) || 0) : 0
        const markup = key ? (markupMap.get(key) || 0) : 0
        const price = original + markup
        const quantity = Number(r.total_qty || 0)
        return {
          items: r.item_name,
          price,
          quantity,
          amount: price * quantity,
          branch_code: r.branch_code,
          branch_name: r.branch_name,
          department_id: r.department_id,
          department_name: r.department_name,
          original_price: original,
          markup
        }
      })

      return NextResponse.json({ ok: true, rows })
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}