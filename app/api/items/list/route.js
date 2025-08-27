// app/api/items/list/route.js
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '../../../../lib/supabaseServer'

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient()
    
    // Get all items with prices from branch_item_prices
    const { data: itemsWithPrices, error } = await supabase
      .from('branch_item_prices')
      .select(`
        price,
        items:item_id(
          item_id,
          name,
          sku,
          unit,
          category
        )
      `)
      .order('name', { foreignTable: 'items' })
    
    if (error) {
      console.error('Error fetching items:', error)
      return NextResponse.json({ ok: false, error: 'Failed to fetch items' }, { status: 500 })
    }
    
    // Transform data to expected format
    const items = (itemsWithPrices || []).map(row => ({
      id: row.items.item_id,
      name: row.items.name,
      sku: row.items.sku,
      unit: row.items.unit,
      category: row.items.category,
      price: Number(row.price || 0)
    }))
    
    return NextResponse.json({ ok: true, items })
  } catch (error) {
    console.error('Items list error:', error)
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 })
  }
}