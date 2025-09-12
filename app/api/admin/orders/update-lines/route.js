import { NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabaseServer'

export async function POST(req) {
  try {
    const supabase = createClient()
    const { orderId, lines } = await req.json()
    if (!orderId || !Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json({ ok: false, error: 'orderId and lines are required' }, { status: 400 })
    }

    // Load order (must be Pending)
    const { data: order, error: oErr } = await supabase
      .from('orders')
      .select('order_id, status, delivery_branch_id, payment_option, member_id')
      .eq('order_id', orderId)
      .single()
    if (oErr || !order) return NextResponse.json({ ok: false, error: 'Order not found' }, { status: 404 })
    if (order.status !== 'Pending') {
      return NextResponse.json({ ok: false, error: 'Only Pending orders can be edited' }, { status: 400 })
    }

    // Price lines from DB (server-side)
    let total = 0
    const priced = []
    for (const l of lines) {
      const sku = l.sku
      const qty = Number(l.qty || 0)
      if (!sku || qty <= 0) return NextResponse.json({ ok: false, error: 'Invalid line' }, { status: 400 })

      const { data: item, error: iErr } = await supabase.from('items').select('item_id, sku').eq('sku', sku).single()
      if (iErr || !item) return NextResponse.json({ ok: false, error: `Item not found: ${sku}` }, { status: 400 })

      const { data: priceRow, error: pErr } = await supabase
        .from('branch_item_prices')
        .select('id, price')
        .eq('branch_id', order.delivery_branch_id)
        .eq('item_id', item.item_id)
        .single()
      if (pErr || !priceRow) return NextResponse.json({ ok: false, error: `No price for ${sku} in this branch` }, { status: 400 })

      const amount = Number(priceRow.price) * qty
      total += amount
      priced.push({
        order_id: orderId,
        item_id: item.item_id,
        branch_item_price_id: priceRow.id,
        unit_price: Number(priceRow.price),
        qty,
        amount,
      })
    }

    // Replace lines (delete then insert)
    const { error: delErr } = await supabase.from('order_lines').delete().eq('order_id', orderId)
    if (delErr) return NextResponse.json({ ok: false, error: delErr.message }, { status: 400 })

    const { error: insErr } = await supabase.from('order_lines').insert(priced)
    if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 400 })

    // Update order total
    const { error: upErr } = await supabase.from('orders').update({ total_amount: total }).eq('order_id', orderId)
    if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 400 })

    return NextResponse.json({ ok: true, total })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}