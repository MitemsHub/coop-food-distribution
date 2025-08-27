// app/api/rep/orders/get/route.js
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '../../../../../lib/supabaseServer'
import { validateSession } from '../../../../../lib/validation'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const orderId = searchParams.get('id')
    
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

    // Get order with order lines and related data
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        order_lines (
          *,
          items (
            item_id,
            sku,
            name,
            unit,
            category
          )
        ),
        branches (
          name
        ),
        departments (
          name
        ),
        delivery_options (
          name
        )
      `)
      .eq('order_id', orderId)
      .eq('branch_id', branch_id)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ ok: false, error: 'Order not found or access denied' }, { status: 404 })
    }

    if (order.status !== 'Pending') {
      return NextResponse.json({ ok: false, error: 'Only pending orders can be edited' }, { status: 400 })
    }

    return NextResponse.json({ ok: true, order })
  } catch (error) {
    console.error('Get order API error:', error)
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 })
  }
}