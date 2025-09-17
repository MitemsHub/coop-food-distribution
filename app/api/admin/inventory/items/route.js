import { createClient } from '../../../../../lib/supabaseServer'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET endpoint for fetching inventory by items (holistic view)
export async function GET(request) {
  const supabase = createClient()
  
  try {
    const { searchParams } = new URL(request.url)
    const itemFilter = searchParams.get('item')
    
    let query = supabase
      .from('v_inventory_status')
      .select(`
        sku,
        item_name,
        allocated_qty,
        delivered_qty,
        pending_delivery_qty,
        total_demand,
        remaining_after_posted,
        remaining_after_delivered
      `)
    
    // Apply item filter if provided
    if (itemFilter && itemFilter !== 'All Items') {
      query = query.eq('item_name', itemFilter)
    }
    
    const { data, error } = await query.order('item_name')
    
    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }
    
    // Aggregate data by item (sum across all branches)
    const itemMap = new Map()
    
    data.forEach(row => {
      const key = `${row.sku}-${row.item_name}`
      
      if (itemMap.has(key)) {
        const existing = itemMap.get(key)
        existing.total_demand += (row.total_demand || 0)
        existing.delivered_qty += (row.delivered_qty || 0)
        existing.allocated_qty += (row.allocated_qty || 0)
        existing.pending_delivery_qty += (row.pending_delivery_qty || 0)

        existing.remaining_after_posted += (row.remaining_after_posted || 0)
        existing.remaining_after_delivered += (row.remaining_after_delivered || 0)
      } else {
        itemMap.set(key, {
          sku: row.sku,
          item_name: row.item_name,
          total_demand: row.total_demand || 0,
          delivered_qty: row.delivered_qty || 0,
          allocated_qty: row.allocated_qty || 0,
          pending_delivery_qty: row.pending_delivery_qty || 0,

          remaining_after_posted: row.remaining_after_posted || 0,
          remaining_after_delivered: row.remaining_after_delivered || 0
        })
      }
    })
    
    const aggregatedData = Array.from(itemMap.values())
    
    return NextResponse.json({ 
      ok: true, 
      data: aggregatedData,
      count: aggregatedData.length
    })
    
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 })
  }
}

// OPTIONS endpoint for CORS
export async function OPTIONS() {
  return NextResponse.json({ ok: true })
}