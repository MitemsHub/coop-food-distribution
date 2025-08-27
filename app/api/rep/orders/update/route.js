// app/api/rep/orders/update/route.js
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '../../../../../lib/supabaseServer'
import { validateSession } from '../../../../../lib/validation'

export async function PUT(request) {
  try {
    const { orderId, orderLines, totalAmount } = await request.json()
    
    if (!orderId || !orderLines || !Array.isArray(orderLines)) {
      return NextResponse.json({ ok: false, error: 'Invalid request data' }, { status: 400 })
    }

    if (orderLines.length === 0) {
      return NextResponse.json({ ok: false, error: 'Order must have at least one item' }, { status: 400 })
    }

    // Validate session and get user info
    const sessionResult = await validateSession(request, 'rep')
    if (!sessionResult.valid) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { branch_id } = sessionResult.claims

    const supabase = await createSupabaseServerClient()

    // Check if order exists and belongs to the rep's branch
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('order_id, status, branch_id')
      .eq('order_id', orderId)
      .eq('branch_id', branch_id)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ ok: false, error: 'Order not found or access denied' }, { status: 404 })
    }

    if (order.status !== 'Pending') {
      return NextResponse.json({ ok: false, error: 'Only pending orders can be edited' }, { status: 400 })
    }

    // Validate order lines
    for (const line of orderLines) {
      if (!line.item_id || !line.qty || line.qty <= 0 || !line.unit_price || line.unit_price < 0) {
        return NextResponse.json({ ok: false, error: 'Invalid order line data' }, { status: 400 })
      }
    }

    // Start transaction by deleting existing order lines
    const { error: deleteError } = await supabase
      .from('order_lines')
      .delete()
      .eq('order_id', orderId)

    if (deleteError) {
      console.error('Delete order lines error:', deleteError)
      return NextResponse.json({ ok: false, error: 'Failed to update order lines' }, { status: 500 })
    }

    // Insert new order lines
    const newOrderLines = orderLines.map(line => ({
      order_id: orderId,
      item_id: line.item_id,
      qty: line.qty,
      unit_price: line.unit_price,
      amount: line.qty * line.unit_price
    }))

    const { error: insertError } = await supabase
      .from('order_lines')
      .insert(newOrderLines)

    if (insertError) {
      console.error('Insert order lines error:', insertError)
      return NextResponse.json({ ok: false, error: 'Failed to insert order lines' }, { status: 500 })
    }

    // Update order total amount
    const { error: updateOrderError } = await supabase
      .from('orders')
      .update({ 
        total_amount: totalAmount,
        updated_at: new Date().toISOString()
      })
      .eq('order_id', orderId)

    if (updateOrderError) {
      console.error('Update order error:', updateOrderError)
      return NextResponse.json({ ok: false, error: 'Failed to update order' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, message: 'Order updated successfully' })
  } catch (error) {
    console.error('Update order API error:', error)
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 })
  }
}