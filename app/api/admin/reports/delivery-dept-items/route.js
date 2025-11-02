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
          i.name AS item_name,
          COALESCE(bip.price, 0)::numeric AS price,
          COALESCE(SUM(ol.qty), 0)::numeric AS total_demand
        FROM orders o
        JOIN order_lines ol ON ol.order_id = o.order_id
        JOIN branches b ON o.delivery_branch_id = b.id
        JOIN departments d ON o.department_id = d.id
        JOIN items i ON i.item_id = ol.item_id
        LEFT JOIN branch_item_prices bip ON bip.branch_id = b.id AND bip.item_id = i.item_id
        ${whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : ''}
        GROUP BY b.code, b.name, d.id, d.name, i.name, bip.price
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
        department_name: r.department_name
      }))
      return NextResponse.json({ ok: true, rows })
    } catch (directErr) {
      // Fallback to Supabase view when direct DB is unavailable (e.g., local dev env)
      const { data, error } = await supabase
        .from('v_inventory_status_by_department')
        .select('branch_code, branch_name, department_id, department_name, item_name, price, total_demand')
        .match({ ...(branchCode ? { branch_code: branchCode } : {}), ...(departmentId ? { department_id: Number(departmentId) } : {}) })

      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
      const rows = (data || []).map(r => ({
        items: r.item_name,
        price: Number(r.price || 0),
        quantity: Number(r.total_demand || 0),
        amount: Number(r.price || 0) * Number(r.total_demand || 0),
        branch_code: r.branch_code,
        branch_name: r.branch_name,
        department_id: r.department_id,
        department_name: r.department_name
      }))
      return NextResponse.json({ ok: true, rows })
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}