// app/api/orders/[id]/route.js
import { NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabaseServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req, { params }) {
  try {
    const supabase = createClient()
    const id = Number(params?.id)
    if (!id || Number.isNaN(id)) return NextResponse.json({ ok:false, error:'Invalid id' }, { status:400 })

    const { data, error } = await supabase
      .from('orders')
      .select(`
        order_id, status, created_at, payment_option, total_amount,
        member_id, member_name_snapshot, member_category_snapshot,
        delivery:delivery_branch_id(code, name),
        member_branch:branch_id(code, name),
        departments:department_id(name),
        order_lines(qty, unit_price, amount, items:item_id(sku, name))
      `)
      .eq('order_id', id)
      .single()

    if (error || !data) return NextResponse.json({ ok:false, error:'Order not found' }, { status:404 })

    return NextResponse.json({ ok:true, order: data })
  } catch (e) {
    return NextResponse.json({ ok:false, error:e.message }, { status:500 })
  }
}