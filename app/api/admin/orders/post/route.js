// app/api/admin/orders/post/route.js
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
    const { orderId, adminId, adminNote } = await req.json()
    if (!orderId) return NextResponse.json({ ok:false, error:'orderId required' }, { status:400 })

    // fetch order metadata for audit
    const { data: o, error: oErr } = await admin
      .from('orders')
      .select('order_id, cycle_id, delivery_branch_id')
      .eq('order_id', orderId)
      .single()
    if (oErr || !o) return NextResponse.json({ ok:false, error:'Order not found' }, { status:404 })

    // post
    const { error } = await admin.rpc('post_order', { p_order_id: orderId, p_admin: adminId || 'admin' })
    if (error) return NextResponse.json({ ok:false, error:error.message }, { status:400 })

    if (adminNote) {
      await admin.from('orders').update({ admin_note: adminNote }).eq('order_id', orderId)
    }

    await admin.from('audit_log').insert({
      actor: adminId || 'admin',
      action: 'post',
      order_id: orderId,
      cycle_id: o.cycle_id,
      delivery_branch_id: o.delivery_branch_id,
      detail: { adminNote }
    })

    return NextResponse.json({ ok:true })
  } catch (e) {
    return NextResponse.json({ ok:false, error:e.message }, { status:500 })
  }
}