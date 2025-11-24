// app/api/rep/items-pack/route.js
import { NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabaseServer'
import { verify } from '@/lib/signing'
import { queryDirect } from '../../../../lib/directDb'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req) {
  try {
    const supabase = createClient()
    const token = req.cookies.get('rep_token')?.value
    const claim = token && verify(token)
    if (!claim || claim.role !== 'rep') {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const deptName = (searchParams.get('dept') || '').trim()

    // Resolve department id if deptName provided
    let deptId = null
    if (deptName) {
      const { data, error } = await supabase.from('departments').select('id').eq('name', deptName).single()
      if (error) throw new Error(error.message)
      deptId = data?.id || null
    }

    // Get branch meta for title
    const { data: bMeta, error: bErr } = await supabase.from('branches').select('id, code, name').eq('id', claim.branch_id).single()
    if (bErr) throw new Error(bErr.message)
    const branchName = bMeta?.name || claim.branch_code
    const branchCode = bMeta?.code || claim.branch_code

    // Aggregate per item for this branch and status Posted
    const whereClauses = [ "o.status::text = 'Posted'", 'o.delivery_branch_id = $1' ]
    const params = [ Number(claim.branch_id) ]
    if (deptId) { whereClauses.push('d.id = $2'); params.push(Number(deptId)) }

    const sql = `
      SELECT 
        i.item_id AS item_id,
        i.name AS item_name,
        i.category AS item_category,
        COALESCE(MAX(bip.price), 0)::numeric AS base_price,
        COALESCE(MAX(CASE WHEN bim.active THEN bim.amount END), 0)::numeric AS markup_amount,
        COALESCE(SUM(ol.qty), 0)::numeric AS total_qty
      FROM orders o
      JOIN order_lines ol ON ol.order_id = o.order_id
      JOIN items i ON i.item_id = ol.item_id
      LEFT JOIN departments d ON d.id = COALESCE(o.department_id, i.department_id)
      LEFT JOIN branch_item_prices bip ON bip.branch_id = o.delivery_branch_id AND bip.item_id = i.item_id
      LEFT JOIN branch_item_markups bim ON bim.branch_id = o.delivery_branch_id AND bim.item_id = i.item_id
      WHERE ${whereClauses.join(' AND ')}
      GROUP BY i.item_id, i.name, i.category
      ORDER BY i.category, i.name
    `

    const result = await queryDirect(sql, params)
    const rows = (result.rows || []).map(r => ({
      items: r.item_name,
      category: r.item_category || null,
      original_price: Number(r.base_price || 0),
      markup: Number(r.markup_amount || 0),
      quantity: Number(r.total_qty || 0)
    }))

    return NextResponse.json({ ok: true, branch: { code: branchCode, name: branchName }, rows })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}