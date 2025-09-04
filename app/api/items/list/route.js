// app/api/items/list/route.js
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '../../../../lib/supabaseServer'

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient()
    
    // Get all items with prices from branch_item_prices (distinct items only)
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
    
    // Transform data to expected format and ensure unique items
    const itemsMap = new Map()
    ;(itemsWithPrices || []).forEach(row => {
      const itemId = row.items.item_id
      if (!itemsMap.has(itemId)) {
        itemsMap.set(itemId, {
          id: itemId,
          name: row.items.name,
          sku: row.items.sku,
          unit: row.items.unit,
          category: row.items.category,
          price: Number(row.price || 0)
        })
      }
    })
    const items = Array.from(itemsMap.values())
    
    return NextResponse.json({ ok: true, items })
  } catch (error) {
    console.error('Items list error:', error)
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 })
  }
}