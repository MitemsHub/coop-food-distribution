import { NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabaseServer'
import { verify } from '@/lib/signing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function deptId(supabase, name) {
  const { data } = await supabase.from('departments').select('id').eq('name', name).single()
  return data?.id || -1
}

export async function GET(req) {
  try {
    const supabase = createClient()
    const token = req.cookies.get('rep_token')?.value
    const claim = token && verify(token)
    if (!claim || claim.role !== 'rep') return NextResponse.json({ ok:false, error:'unauthorized' }, { status:401 })

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || 'Pending'
    const dept = searchParams.get('dept') || ''     // '' = All
    const limit = Number(searchParams.get('limit') || 50)
    const cursor = searchParams.get('cursor') // order_id
    const direction = searchParams.get('dir') || 'next' // next|prev

    const selectCols = `
      order_id, created_at, posted_at, status, payment_option, total_amount,
      member_id, member_name_snapshot,
      member_branch:branch_id(code,name),
      delivery:delivery_branch_id(code,name),
      departments:department_id(name),
      order_lines(id, qty, unit_price, amount, items:item_id(sku,name))
    `
    let q = supabase
      .from('orders')
      .select(selectCols)
      .eq('delivery_branch_id', claim.branch_id)
      .eq('status', status)
      .order('order_id', { ascending: false })

    if (dept) q = q.eq('department_id', (await deptId(supabase, dept)))
    if (cursor) {
      q = direction === 'next'
        ? q.lt('order_id', Number(cursor))
        : q.gt('order_id', Number(cursor))
    }

    const { data, error } = await q.limit(limit + 1)
    if (error) throw new Error(error.message)

    let nextCursor = null
    let page = data || []
    if (page.length > limit) {
      nextCursor = page[limit - 1]?.order_id
      page = page.slice(0, limit)
    }

    return NextResponse.json({ ok:true, orders: page, nextCursor, branch: claim.branch_code })
  } catch (e) {
    return NextResponse.json({ ok:false, error:e.message }, { status:500 })
  }
}