// app/api/rep/orders/delete/route.js
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verify } from '@/lib/signing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const admin = createClient(url, key)

export async function POST(request) {
  try {
    const { orderId } = await request.json()
    
    if (!orderId) {
      return NextResponse.json({ ok: false, error: 'Order ID is required' }, { status: 400 })
    }

    // Validate session using same method as list API
    const token = request.cookies.get('rep_token')?.value
    const claim = token && verify(token)
    if (!claim || claim.role !== 'rep') {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { branch_id } = claim

    // Check if order exists and belongs to the rep's branch
    const { data: order, error: orderError } = await admin
      .from('orders')
      .select('order_id, status, delivery_branch_id')
      .eq('order_id', orderId)
      .eq('delivery_branch_id', branch_id)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ ok: false, error: 'Order not found or access denied' }, { status: 404 })
    }

    if (order.status !== 'Pending') {
      return NextResponse.json({ ok: false, error: 'Only pending orders can be deleted' }, { status: 400 })
    }

    // Delete order lines first (due to foreign key constraints)
    const { error: deleteLinesError } = await admin
      .from('order_lines')
      .delete()
      .eq('order_id', orderId)

    if (deleteLinesError) {
      console.error('Delete order lines error:', deleteLinesError)
      return NextResponse.json({ ok: false, error: 'Failed to delete order lines' }, { status: 500 })
    }

    // Delete the order
    const { error: deleteOrderError } = await admin
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