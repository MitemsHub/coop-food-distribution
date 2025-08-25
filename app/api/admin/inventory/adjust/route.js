import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const admin = createClient(url, key)

export async function POST(req) {
  try {
    const { branchCode, sku, qty, note } = await req.json()
    const adjQty = Number(qty)
    if (!branchCode || !sku || !adjQty) {
      return NextResponse.json({ ok:false, error:'branchCode, sku, qty required' }, { status:400 })
    }

    const [{ data: br }, { data: it }, { data: cyc }] = await Promise.all([
      admin.from('branches').select('id,code').eq('code', branchCode).single(),
      admin.from('items').select('item_id,sku').eq('sku', sku).single(),
      admin.from('cycles').select('id').eq('is_active', true).single()
    ])
    if (!br) return NextResponse.json({ ok:false, error:'Branch not found' }, { status:404 })
    if (!it) return NextResponse.json({ ok:false, error:'Item not found' }, { status:404 })
    if (!cyc) return NextResponse.json({ ok:false, error:'No active cycle' }, { status:400 })

    const { data: bip, error: e4 } = await admin
      .from('branch_item_prices')
      .select('id')
      .eq('branch_id', br.id)
      .eq('item_id', it.item_id)
      .eq('cycle_id', cyc.id)
      .single()
    if (e4 || !bip) return NextResponse.json({ ok:false, error:'Price row not found for active cycle' }, { status:404 })

    const { error: insErr } = await admin
      .from('inventory_movements')
      .insert({
        branch_item_price_id: bip.id,
        movement_type: 'Adjustment',
        qty: adjQty, // positive to add, negative to subtract
        order_id: null,
        created_by: 'admin@coop', // optionally set from session later
        cycle_id: cyc.id
      })
    if (insErr) return NextResponse.json({ ok:false, error: insErr.message }, { status:500 })

    return NextResponse.json({ ok:true })
  } catch (e) {
    return NextResponse.json({ ok:false, error:e.message }, { status:500 })
  }
}