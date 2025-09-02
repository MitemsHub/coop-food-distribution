// app/api/items/prices/route.js
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const admin = createClient(supabaseUrl, serviceKey)

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const branchCode = searchParams.get('branch')
    
    if (!branchCode) {
      return NextResponse.json({ ok: false, error: 'Branch parameter is required' }, { status: 400 })
    }
    
    // Get branch ID from code
    const { data: branch, error: branchError } = await admin
      .from('branches')
      .select('id')
      .eq('code', branchCode)
      .single()
    
    if (branchError || !branch) {
      return NextResponse.json({ ok: false, error: 'Branch not found' }, { status: 404 })
    }
    
    // Get items with prices for this branch
    const { data: itemsWithPrices, error } = await admin
      .from('branch_item_prices')
      .select(`
        price,
        initial_stock,
        items:item_id(
          item_id,
          name,
          sku,
          unit,
          category
        )
      `)
      .eq('branch_id', branch.id)
      .order('name', { foreignTable: 'items' })
    
    if (error) {
      console.error('Error fetching items with prices:', error)
      return NextResponse.json({ ok: false, error: 'Failed to fetch items' }, { status: 500 })
    }
    
    // Transform data to expected format
    const items = (itemsWithPrices || []).map(row => ({
      id: row.items.item_id,
      name: row.items.name,
      sku: row.items.sku,
      unit: row.items.unit,
      category: row.items.category,
      price: Number(row.price || 0),
      stock: Number(row.initial_stock || 0)
    }))
    
    return NextResponse.json({ ok: true, items })
  } catch (error) {
    console.error('Items prices error:', error)
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 })
  }
}