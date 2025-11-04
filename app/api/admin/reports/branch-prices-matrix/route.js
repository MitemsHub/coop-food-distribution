// app/api/admin/reports/branch-prices-matrix/route.js
import { NextResponse } from 'next/server'
import { validateSession } from '@/lib/validation'
import { queryDirect } from '@/lib/directDb'
import { createClient } from '@/lib/supabaseServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isDirectDbUnavailable(error) {
  // Fallback on any direct DB connection issue (env missing or connection failures)
  const msg = String(error?.message || '')
  return (
    msg.includes('SUPABASE_DB_URL') ||
    msg.includes('Connection terminated due to connection timeout') ||
    msg.includes('getaddrinfo ENOTFOUND') ||
    msg.includes('connect ECONN') ||
    msg.includes('self signed certificate')
  )
}

export async function GET(request) {
  try {
    const session = await validateSession(request, 'admin')
    if (!session.valid) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Try direct DB first for performance; fallback to Supabase client
    try {
      const result = await queryDirect(`
        SELECT 
          b.code AS branch_code,
          b.name AS branch_name,
          i.item_id,
          i.sku,
          i.name AS item_name,
          i.category AS item_category,
          bip.price::numeric AS price,
          COALESCE(bim.amount, 0)::numeric AS markup
        FROM branches b
        JOIN branch_item_prices bip ON bip.branch_id = b.id
        JOIN items i ON i.item_id = bip.item_id
        LEFT JOIN branch_item_markups bim ON bim.branch_id = b.id AND bim.item_id = i.item_id AND bim.active = TRUE
        WHERE bip.price IS NOT NULL
        ORDER BY b.name, i.name
      `)

      const rows = result.rows || []
      const branchesMap = new Map()
      const itemsMap = new Map()
      for (const r of rows) {
        branchesMap.set(r.branch_code, { code: r.branch_code, name: r.branch_name })
        itemsMap.set(r.item_id, { item_id: r.item_id, sku: r.sku, name: r.item_name, category: r.item_category })
      }

      return NextResponse.json({
        ok: true,
        branches: Array.from(branchesMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
        items: Array.from(itemsMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
        prices: rows
      })
    } catch (error) {
      // Fallback to Supabase client when direct DB fails
      const supabase = createClient()

      // Fetch base branch-item prices
      const { data: bipData, error: bipErr } = await supabase
        .from('branch_item_prices')
        .select('branch_id, item_id, price')
      if (bipErr) return NextResponse.json({ ok: false, error: bipErr.message }, { status: 500 })

      const branchIds = [...new Set((bipData || []).map(r => r.branch_id).filter(Boolean))]
      const itemIds = [...new Set((bipData || []).map(r => r.item_id).filter(Boolean))]

      // Fetch supporting branch and item metadata
      const [{ data: branchesData, error: branchesErr }, { data: itemsData, error: itemsErr }] = await Promise.all([
        supabase.from('branches').select('id, code, name').in('id', branchIds),
        supabase.from('items').select('item_id, sku, name, category').in('item_id', itemIds)
      ])
      if (branchesErr) return NextResponse.json({ ok: false, error: branchesErr.message }, { status: 500 })
      if (itemsErr) return NextResponse.json({ ok: false, error: itemsErr.message }, { status: 500 })

      const branchById = new Map((branchesData || []).map(b => [b.id, { code: b.code, name: b.name }]))
      const itemById = new Map((itemsData || []).map(i => [i.item_id, { item_id: i.item_id, sku: i.sku, name: i.name, category: i.category }]))

      // Fetch markups separately (active only)
      const { data: markupsData, error: markupsErr } = await supabase
        .from('branch_item_markups')
        .select('branch_id, item_id, amount, active')
        .in('branch_id', branchIds)
        .in('item_id', itemIds)
      if (markupsErr) return NextResponse.json({ ok: false, error: markupsErr.message }, { status: 500 })
      const markupMap = new Map((markupsData || []).filter(m => !!m.active).map(m => [`${m.branch_id}:${m.item_id}`, Number(m.amount)]))

      const normalized = (bipData || []).map(r => {
        const b = branchById.get(r.branch_id) || {}
        const it = itemById.get(r.item_id) || {}
        const key = `${r.branch_id}:${r.item_id}`
        return {
          branch_code: b.code,
          branch_name: b.name,
          item_id: it.item_id,
          sku: it.sku,
          item_name: it.name,
          item_category: it.category,
          price: Number(r.price || 0),
          markup: Number(markupMap.get(key) || 0)
        }
      })

      const branchesMap = new Map()
      const itemsMap = new Map()
      for (const r of normalized) {
        if (r.branch_code) branchesMap.set(r.branch_code, { code: r.branch_code, name: r.branch_name })
        if (r.item_id) itemsMap.set(r.item_id, { item_id: r.item_id, sku: r.sku, name: r.item_name, category: r.item_category })
      }

      return NextResponse.json({
        ok: true,
        branches: Array.from(branchesMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
        items: Array.from(itemsMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
        prices: normalized
      })
    }
  } catch (error) {
    console.error('GET /api/admin/reports/branch-prices-matrix error:', error)
    return NextResponse.json({ ok: false, error: error?.message || 'Failed to load prices matrix' }, { status: 500 })
  }
}