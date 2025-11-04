// app/api/items/prices/route.js
import { NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabaseServer'
import { getCached } from '../../../../lib/cache'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req) {
  try {
    const supabase = createClient()
    const { searchParams } = new URL(req.url)
    const branchCode = searchParams.get('branch')
    
    if (!branchCode) {
      return NextResponse.json({ ok: false, error: 'Branch parameter is required' }, { status: 400 })
    }
    
    // Cache key for branch inventory prices
    const cacheKey = `items-prices:${branchCode}`

    const items = await getCached(cacheKey, async () => {
      // Resolve branch id for markup lookup
      const { data: branch, error: brErr } = await supabase
        .from('branches')
        .select('id, code')
        .eq('code', branchCode)
        .single()
      if (brErr || !branch) {
        throw new Error('Branch not found')
      }

      // Fetch items with prices and demand data from optimized inventory view
      const { data: itemsWithPrices, error } = await supabase
        .from('v_inventory_status')
        .select(`
          price,
          total_demand,
          pending_demand,
          confirmed_demand,
          delivered_demand,
          item_id,
          item_name,
          sku,
          unit,
          category
        `)
        .eq('branch_code', branchCode)
        .gt('price', 0)
        .order('item_name')
      
      if (error) {
        console.error('Error fetching items with prices:', error)
        throw new Error('Failed to fetch items')
      }

      // Load markups for this branch and map by item_id
      const { data: markups, error: muErr } = await supabase
        .from('branch_item_markups')
        .select('item_id, amount, active')
        .eq('branch_id', branch.id)
      if (muErr) {
        console.warn('Markups fetch error:', muErr.message)
      }
      const markupByItemId = new Map((markups || []).filter(m => m.active).map(m => [m.item_id, Number(m.amount || 0)]))
      
      // Transform data to expected format for demand tracking
      return (itemsWithPrices || []).map(row => {
        const base = Number(row.price || 0)
        const mk = markupByItemId.get(row.item_id) || 0
        return {
          id: row.item_id,
          name: row.item_name,
          sku: row.sku,
          unit: row.unit,
          category: row.category,
          price: base + mk,
          demand: {
            total: Number(row.total_demand || 0),
            pending: Number(row.pending_demand || 0),
            confirmed: Number(row.confirmed_demand || 0),
            delivered: Number((row.delivered_demand ?? row.delivered_qty ?? 0))
          }
        }
      })
    }, 60) // cache for 60 seconds
    
    return NextResponse.json({ ok: true, items })
  } catch (error) {
    console.error('Items prices error:', error)
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 })
  }
}