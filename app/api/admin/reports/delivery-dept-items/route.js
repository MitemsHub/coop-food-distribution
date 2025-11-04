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
      // Fallback to Supabase view when direct DB is unavailable (e.g., local dev env)
      const { data, error } = await supabase
        .from('v_inventory_status_by_department')
        .select('branch_code, branch_name, department_id, department_name, item_name, price, total_demand')
        .match({ ...(branchCode ? { branch_code: branchCode } : {}), ...(departmentId ? { department_id: Number(departmentId) } : {}) })

      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

      // Enrich with markup via lookups: branch_code -> id, item_name -> item_id
      const branchCodes = [...new Set((data || []).map(r => r.branch_code).filter(Boolean))]
      const itemNames = [...new Set((data || []).map(r => r.item_name).filter(Boolean))]

      const { data: branchesData, error: branchesErr } = await supabase
        .from('branches')
        .select('id, code')
        .in('code', branchCodes)
      if (branchesErr) return NextResponse.json({ ok: false, error: branchesErr.message }, { status: 500 })
      const branchIdByCode = new Map((branchesData || []).map(b => [b.code, b.id]))

      const { data: itemsData, error: itemsErr } = await supabase
        .from('items')
        .select('item_id, name')
        .in('name', itemNames)
      if (itemsErr) return NextResponse.json({ ok: false, error: itemsErr.message }, { status: 500 })
      const itemIdByName = new Map((itemsData || []).map(i => [i.name, i.item_id]))

      const branchIds = [...new Set(branchCodes.map(c => branchIdByCode.get(c)).filter(Boolean))]
      const itemIds = [...new Set((itemsData || []).map(i => i.item_id))]

      const { data: markupsData, error: markupsErr } = await supabase
        .from('branch_item_markups')
        .select('branch_id, item_id, amount, active')
        .in('branch_id', branchIds)
        .in('item_id', itemIds)
      if (markupsErr) return NextResponse.json({ ok: false, error: markupsErr.message }, { status: 500 })
      const markupMap = new Map((markupsData || []).filter(m => !!m.active).map(m => [`${m.branch_id}:${m.item_id}`, Number(m.amount)]))

      const rows = (data || []).map(r => {
        const branchId = branchIdByCode.get(r.branch_code)
        const itemId = itemIdByName.get(r.item_name)
        const key = branchId && itemId ? `${branchId}:${itemId}` : null
        const markup = key ? (markupMap.get(key) || 0) : 0
        const priceWithMarkup = Number(r.price || 0) + Number(markup)
        return {
          items: r.item_name,
          price: priceWithMarkup,
          quantity: Number(r.total_demand || 0),
          amount: priceWithMarkup * Number(r.total_demand || 0),
          branch_code: r.branch_code,
          branch_name: r.branch_name,
          department_id: r.department_id,
          department_name: r.department_name,
          original_price: Number(r.price || 0),
          markup: Number(markup)
        }
      })
      return NextResponse.json({ ok: true, rows })
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}