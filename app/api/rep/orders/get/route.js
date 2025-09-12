// app/api/rep/orders/get/route.js
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verify } from '@/lib/signing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const orderId = searchParams.get('id')
    
    if (!orderId) {
      return NextResponse.json({ ok: false, error: 'Order ID is required' }, { status: 400 })
    }

    // Validate session and get user info
    const token = request.cookies.get('rep_token')?.value
    const claim = token && verify(token)
    if (!claim || claim.role !== 'rep') {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { branch_id } = claim

    // Get order with order lines and related data
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        order_id,
        member_id,
        member_name_snapshot,
        branch_id,
        status,
        total_amount,
        created_at,
        posted_at,
        order_lines (
          id,
          item_id,
          qty,
          unit_price,
          amount,
          items (
            item_id,
            sku,
            name,
            unit,
            category
          )
        ),
        delivery_branch:delivery_branch_id(
          id,
          code,
          name
        )
      `)
      .eq('order_id', orderId)
      .eq('delivery_branch_id', branch_id)
      .single()

    if (orderError || !order) {
      console.log('Order lookup failed:', { orderId, branch_id, orderError: orderError?.message, order })
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