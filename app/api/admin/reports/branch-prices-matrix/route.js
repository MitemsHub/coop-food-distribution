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
          bip.price::numeric AS price
        FROM branches b
        JOIN branch_item_prices bip ON bip.branch_id = b.id
        JOIN items i ON i.item_id = bip.item_id
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
      // Fallback to Supabase client when direct DB fails for any reason

      // Fallback to Supabase client (service role)
      const supabase = createClient()
      const { data: rows, error: sErr } = await supabase
        .from('branch_item_prices')
        .select('price, branches:branch_id(code, name), items:item_id(item_id, sku, name, category)')
      if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 })

      const normalized = (rows || []).map(r => ({
        branch_code: r.branches?.code,
        branch_name: r.branches?.name,
        item_id: r.items?.item_id,
        sku: r.items?.sku,
        item_name: r.items?.name,
        item_category: r.items?.category,
        price: r.price
      }))

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