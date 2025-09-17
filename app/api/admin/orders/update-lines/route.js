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

    // Use optimized batch RPC function
    const { data, error } = await supabase.rpc('update_order_lines_batch', {
      p_order_id: orderId,
      p_lines: JSON.stringify(validatedLines),
      p_delivery_branch_id: order.delivery_branch_id
    })

    console.log('Update lines RPC result:', { orderId, linesCount: validatedLines.length, data, error })

    if (error) {
      console.error('Update lines RPC error:', error)
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
    }

    if (!data || !data.success) {
      console.error('Update lines RPC failed:', data)
      return NextResponse.json({ ok: false, error: data?.error || 'Update failed' }, { status: 400 })
    }

    return NextResponse.json({ 
      ok: true, 
      total: data.total_amount,
      lines_updated: data.lines_count
    })
  } catch (e) {
    console.error('Update lines error:', e)
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}