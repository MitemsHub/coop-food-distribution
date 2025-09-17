// app/api/items/prices/route.js
import { NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabaseServer'

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
    
    // Get branch ID from code
    const { data: branch, error: branchError } = await supabase
      .from('branches')
      .select('id')
      .eq('code', branchCode)
      .single()
    
    if (branchError || !branch) {
      return NextResponse.json({ ok: false, error: 'Branch not found' }, { status: 404 })
    }
    
    // Get items with prices for this branch
    // Get items with prices and demand data from inventory view
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
      .order('item_name')
    
    if (error) {
      console.error('Error fetching items with prices:', error)
      return NextResponse.json({ ok: false, error: 'Failed to fetch items' }, { status: 500 })
    }
    
    // Transform data to expected format for demand tracking
    const items = (itemsWithPrices || []).map(row => ({
      id: row.item_id,
      name: row.item_name,
      sku: row.sku,
      unit: row.unit,
      category: row.category,
      price: Number(row.price || 0),
      demand: {
        total: Number(row.total_demand || 0),
        pending: Number(row.pending_demand || 0),
        confirmed: Number(row.confirmed_demand || 0),
        delivered: Number(row.delivered_demand || 0)
      }
    }))
    
    return NextResponse.json({ ok: true, items })
  } catch (error) {
    console.error('Items prices error:', error)
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 })
  }
}