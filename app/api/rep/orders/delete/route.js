// app/api/rep/orders/delete/route.js
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '../../../../../lib/supabaseServer'
import { validateSession } from '../../../../../lib/validation'

export async function DELETE(request) {
  try {
    const { orderId } = await request.json()
    
    if (!orderId) {
      return NextResponse.json({ ok: false, error: 'Order ID is required' }, { status: 400 })
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
      return NextResponse.json({ ok: false, error: 'Only pending orders can be deleted' }, { status: 400 })
    }

    // Delete order lines first (due to foreign key constraints)
    const { error: deleteLinesError } = await supabase
      .from('order_lines')
      .delete()
      .eq('order_id', orderId)

    if (deleteLinesError) {
      console.error('Delete order lines error:', deleteLinesError)
      return NextResponse.json({ ok: false, error: 'Failed to delete order lines' }, { status: 500 })
    }

    // Delete the order
    const { error: deleteOrderError } = await supabase
      .from('orders')
      .delete()
      .eq('order_id', orderId)

    if (deleteOrderError) {
      console.error('Delete order error:', deleteOrderError)
      return NextResponse.json({ ok: false, error: 'Failed to delete order' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, message: 'Order deleted successfully' })
  } catch (error) {
    console.error('Delete order API error:', error)
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 })
  }
}