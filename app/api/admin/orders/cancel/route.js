// app/api/admin/orders/cancel/route.js
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(req) {
  try {
    const { orderId, adminId, reason } = await req.json()
    if (!orderId) return NextResponse.json({ ok:false, error:'orderId required' }, { status:400 })

    const { data: o } = await admin
      .from('orders')
      .select('order_id, cycle_id, delivery_branch_id')
      .eq('order_id', orderId)
      .single()
    if (!o) return NextResponse.json({ ok:false, error:'Order not found' }, { status:404 })

    const { error } = await admin.rpc('cancel_order', { p_order_id: orderId, p_admin: adminId || 'admin' })
    if (error) return NextResponse.json({ ok:false, error:error.message }, { status:400 })

    await admin.from('orders').update({ cancel_reason: reason || null }).eq('order_id', orderId)

    await admin.from('audit_log').insert({
      actor: adminId || 'admin',
      action: 'cancel',
      order_id: orderId,
      cycle_id: o.cycle_id,
      delivery_branch_id: o.delivery_branch_id,
      detail: { reason }
    })

    return NextResponse.json({ ok:true })
  } catch (e) {
    return NextResponse.json({ ok:false, error:e.message }, { status:500 })
  }
}