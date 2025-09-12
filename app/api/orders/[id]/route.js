// app/api/orders/[id]/route.js
import { NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabaseServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req, { params }) {
  try {
    const supabase = createClient()
    const id = Number(params?.id)
    if (!id || Number.isNaN(id)) {
      return NextResponse.json({ ok: false, error: 'Invalid order id' }, { status: 400 })
    }

    const selectCols = `
      order_id,
      status,
      created_at,
      posted_at,
      payment_option,
      total_amount,
      member_id,
      member_name_snapshot,
      member_category_snapshot,
      branch_id,
      delivery_branch_id,
      delivery:delivery_branch_id(code,name),
      member_branch:branch_id(code,name),
      departments:department_id(name),
      order_lines(qty, unit_price, amount, items:item_id(sku, name))
    `

    const { data, error } = await supabase
      .from('orders')
      .select(selectCols)
      .eq('order_id', id)
      .single()

    if (error || !data) {
      return NextResponse.json({ ok: false, error: 'Order not found' }, { status: 404 })
    }

    // Hydrate branch names if nested joins didn't resolve
    const fixes = []
    if (!data.delivery && data.delivery_branch_id) {
      fixes.push(
        supabase.from('branches').select('code,name').eq('id', data.delivery_branch_id).single()
          .then(r => ({ key: 'delivery', val: r.data || null }))
      )
    }
    if (!data.member_branch && data.branch_id) {
      fixes.push(
        supabase.from('branches').select('code,name').eq('id', data.branch_id).single()
          .then(r => ({ key: 'member_branch', val: r.data || null }))
      )
    }
    if (fixes.length) {
      const rs = await Promise.all(fixes)
      for (const r of rs) if (r?.key) data[r.key] = r.val
    }

    return NextResponse.json({ ok: true, order: data })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}