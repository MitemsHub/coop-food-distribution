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

    // Validate lines format
    const validatedLines = lines.map(l => {
      const qty = Number(l.qty || 0)
      if (!l.sku || qty <= 0) {
        throw new Error('Invalid line: SKU and positive quantity required')
      }
      return { sku: l.sku, qty }
    })

    // Helper: manual fallback update when RPC fails
    const manualUpdate = async () => {
      // Resolve item IDs for SKUs
      const skus = validatedLines.map(l => l.sku)
      const { data: items, error: itemsErr } = await supabase
        .from('items')
        .select('item_id, sku')
        .in('sku', skus)
      if (itemsErr) throw new Error(itemsErr.message)
      const skuToItem = new Map(items.map(i => [i.sku, i.item_id]))

      // Validate all SKUs were found
      const missing = validatedLines.filter(l => !skuToItem.get(l.sku)).map(l => l.sku)
      if (missing.length) throw new Error('Items not found: ' + missing.join(', '))

      // Fetch branch prices for these items
      const itemIds = validatedLines.map(l => skuToItem.get(l.sku))
      const { data: prices, error: pricesErr } = await supabase
        .from('branch_item_prices')
        .select('id, item_id, price')
        .eq('branch_id', order.delivery_branch_id)
        .in('item_id', itemIds)
      if (pricesErr) throw new Error(pricesErr.message)
      const itemToPrice = new Map(prices.map(p => [p.item_id, { id: p.id, price: Number(p.price) }]))

      // Build order_lines payload and compute total
      let total = 0
      const linesPayload = validatedLines.map(l => {
        const itemId = skuToItem.get(l.sku)
        const pr = itemToPrice.get(itemId)
        if (!pr) throw new Error('No price found for item: ' + l.sku)
        const qty = Number(l.qty)
        const amount = pr.price * qty
        total += amount
        return {
          order_id: orderId,
          item_id: itemId,
          branch_item_price_id: pr.id,
          unit_price: pr.price,
          qty,
          amount
        }
      })

      // Replace existing lines
      const { error: delErr } = await supabase
        .from('order_lines')
        .delete()
        .eq('order_id', orderId)
      if (delErr) throw new Error(delErr.message)

      const { error: insErr } = await supabase
        .from('order_lines')
        .insert(linesPayload)
      if (insErr) throw new Error(insErr.message)

      // Update order total explicitly (avoid ambiguity)
      const { error: updErr } = await supabase
        .from('orders')
        .update({ total_amount: total })
        .eq('order_id', orderId)
      if (updErr) throw new Error(updErr.message)

      return { ok: true, total, lines_updated: linesPayload.length }
    }

    // Try optimized batch RPC first
    const { data, error } = await supabase.rpc('update_order_lines_batch', {
      p_order_id: orderId,
      p_lines: validatedLines, // Postgres expects a JSON array
      p_delivery_branch_id: order.delivery_branch_id
    })

    // If RPC succeeded, return result
    if (!error && data && data.success) {
      return NextResponse.json({ 
        ok: true, 
        total: data.total_amount,
        lines_updated: data.lines_count
      })
    }

    // Fall back to manual implementation on any error or unsuccessful RPC
    try {
      const result = await manualUpdate()
      return NextResponse.json(result)
    } catch (fallbackErr) {
      const msg = error?.message || data?.error || fallbackErr.message || 'Update failed'
      console.error('Update lines fallback error:', msg)
      return NextResponse.json({ ok: false, error: msg }, { status: 400 })
    }
  } catch (e) {
    console.error('Update lines error:', e)
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}