import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const admin = createClient(url, key)

export async function POST(req) {
  try {
    const { orderId, lines } = await req.json()
    if (!orderId || !Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json({ ok: false, error: 'orderId and lines are required' }, { status: 400 })
    }

    // Load order (must be Pending)
    const { data: order, error: oErr } = await admin
      .from('orders')
      .select('order_id, status, branch_id, payment_option, member_id')
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

      const { data: item, error: iErr } = await admin.from('items').select('item_id, sku').eq('sku', sku).single()
      if (iErr || !item) return NextResponse.json({ ok: false, error: `Item not found: ${sku}` }, { status: 400 })

      const { data: priceRow, error: pErr } = await admin
        .from('branch_item_prices')
        .select('id, price')
        .eq('branch_id', order.branch_id)
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
    const { error: delErr } = await admin.from('order_lines').delete().eq('order_id', orderId)
    if (delErr) return NextResponse.json({ ok: false, error: delErr.message }, { status: 400 })

    const { error: insErr } = await admin.from('order_lines').insert(priced)
    if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 400 })

    // Update order total
    const { error: upErr } = await admin.from('orders').update({ total_amount: total }).eq('order_id', orderId)
    if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 400 })

    return NextResponse.json({ ok: true, total })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}