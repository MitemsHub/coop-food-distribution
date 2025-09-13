import { NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabaseServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req) {
  try {
    const supabase = createClient()
    const { branchCode, sku, qty, note } = await req.json()
    const adjQty = Number(qty)
    if (!branchCode || !sku || !adjQty) {
      return NextResponse.json({ ok:false, error:'branchCode, sku, qty required' }, { status:400 })
    }

    const [{ data: br }, { data: it }] = await Promise.all([
      supabase.from('branches').select('id,code').eq('code', branchCode).single(),
      supabase.from('items').select('item_id,sku').eq('sku', sku).single()
    ])
    if (!br) return NextResponse.json({ ok:false, error:'Branch not found' }, { status:404 })
    if (!it) return NextResponse.json({ ok:false, error:'Item not found' }, { status:404 })

    const { data: bip, error: e4 } = await supabase
      .from('branch_item_prices')
      .select('id, initial_stock')
      .eq('branch_id', br.id)
      .eq('item_id', it.item_id)
      .single()
    if (e4 || !bip) return NextResponse.json({ ok:false, error:'Price configuration not found for this item and branch' }, { status:404 })

    // Update the stock level in branch_item_prices
    const newStock = Math.max(0, (bip.initial_stock || 0) + adjQty)
    const { error: updateErr } = await supabase
      .from('branch_item_prices')
      .update({ initial_stock: newStock })
      .eq('id', bip.id)
    if (updateErr) return NextResponse.json({ ok:false, error: updateErr.message }, { status:500 })

    // Record the inventory movement for audit trail
    // Note: Making cycle_id optional since it may not always be available
    const movementData = {
      item_id: it.item_id,
      branch_id: br.id,
      movement_type: 'Adjustment',
      quantity: adjQty, // positive to add, negative to subtract
      reference_type: 'adjustment',
      notes: note || 'Admin adjustment'
    }
    
    // cycle_id is now optional and not included in movements
    
    const { error: insErr } = await supabase
      .from('inventory_movements')
      .insert(movementData)
    if (insErr) return NextResponse.json({ ok:false, error: insErr.message }, { status:500 })

    return NextResponse.json({ 
      ok: true, 
      previousStock: bip.initial_stock || 0,
      adjustment: adjQty,
      newStock: newStock
    })
  } catch (e) {
    return NextResponse.json({ ok:false, error:e.message }, { status:500 })
  }
}