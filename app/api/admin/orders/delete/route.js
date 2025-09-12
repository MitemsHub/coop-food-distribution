import { NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabaseServer'

export async function POST(req) {
  try {
    const supabase = createClient()
    const { orderId } = await req.json()
    if (!orderId) return NextResponse.json({ ok: false, error: 'orderId required' }, { status: 400 })

    // Allow delete only for Pending or Cancelled
    const { data: row, error: selErr } = await supabase
      .from('orders')
      .select('status')
      .eq('order_id', orderId)
      .single()
    if (selErr || !row) return NextResponse.json({ ok: false, error: 'Order not found' }, { status: 404 })
    if (!['Pending', 'Cancelled'].includes(row.status)) {
      return NextResponse.json({ ok: false, error: 'Only Pending or Cancelled orders can be deleted' }, { status: 400 })
    }

    const { error } = await supabase.from('orders').delete().eq('order_id', orderId)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}