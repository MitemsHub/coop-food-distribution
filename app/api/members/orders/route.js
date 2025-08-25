// app/api/members/orders/route.js
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const admin = createClient(url, key)

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const memberId = (searchParams.get('id') || '').trim()
    const status = (searchParams.get('status') || '').trim()
    const limit = Number(searchParams.get('limit') || 100)
    if (!memberId) return NextResponse.json({ ok:false, error:'id required' }, { status:400 })

    const selectCols = `
      order_id, created_at, posted_at, status, payment_option, total_amount,
      delivery:delivery_branch_id(code,name),
      member_branch:branch_id(code,name),
      departments:department_id(name),
      order_lines(qty, unit_price, amount, items:item_id(sku,name))
    `

    let q = admin
      .from('orders')
      .select(selectCols)
      .eq('member_id', memberId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (status) q = q.eq('status', status)

    const { data, error } = await q
    if (error) throw new Error(error.message)

    return NextResponse.json({ ok: true, orders: data || [] })
  } catch (e) {
    return NextResponse.json({ ok:false, error: e.message }, { status:500 })
  }
}