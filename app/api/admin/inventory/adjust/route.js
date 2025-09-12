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

    const [{ data: br }, { data: it }, { data: cyc }] = await Promise.all([
      supabase.from('branches').select('id,code').eq('code', branchCode).single(),
      supabase.from('items').select('item_id,sku').eq('sku', sku).single(),
      supabase.from('cycles').select('id').eq('is_active', true).single()
    ])
    if (!br) return NextResponse.json({ ok:false, error:'Branch not found' }, { status:404 })
    if (!it) return NextResponse.json({ ok:false, error:'Item not found' }, { status:404 })
    if (!cyc) return NextResponse.json({ ok:false, error:'No active cycle' }, { status:400 })

    const { data: bip, error: e4 } = await supabase
      .from('branch_item_prices')
      .select('id')
      .eq('branch_id', br.id)
      .eq('item_id', it.item_id)
      .eq('cycle_id', cyc.id)
      .single()
    if (e4 || !bip) return NextResponse.json({ ok:false, error:'Price row not found for active cycle' }, { status:404 })

    const { error: insErr } = await supabase
      .from('inventory_movements')
      .insert({
        item_id: it.item_id,
        branch_id: br.id,
        cycle_id: cyc.id,
        movement_type: 'Adjustment',
        quantity: adjQty, // positive to add, negative to subtract
        reference_type: 'adjustment',
        reference_id: null,
        notes: note || 'Admin adjustment'
      })
    if (insErr) return NextResponse.json({ ok:false, error: insErr.message }, { status:500 })

    return NextResponse.json({ ok:true })
  } catch (e) {
    return NextResponse.json({ ok:false, error:e.message }, { status:500 })
  }
}