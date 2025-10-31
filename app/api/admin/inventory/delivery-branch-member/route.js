// app/api/admin/inventory/delivery-branch-member/route.js
import { NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabaseServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Returns rows aggregated by DELIVERY branch and MEMBER branch with status counts
// Source: v_applications_by_delivery_branch_member_branch
export async function GET(req) {
  try {
    const supabase = createClient()
    const { searchParams } = new URL(req.url)
    const delivery = (searchParams.get('delivery') || '').trim() // delivery branch name
    const member = (searchParams.get('member') || '').trim()     // member/home branch name

    let q = supabase
      .from('v_applications_by_delivery_branch_member_branch')
      .select('*')
      .order('delivery_branch_name', { ascending: true })
      .order('branch_name', { ascending: true })

    if (delivery) q = q.eq('delivery_branch_name', delivery)
    if (member) q = q.eq('branch_name', member)

    const { data, error } = await q
    if (error) throw new Error(error.message)

    // Add total column for convenience
    const rows = (data || []).map(r => ({
      ...r,
      total: Number(r.pending || 0) + Number(r.posted || 0) + Number(r.delivered || 0)
    }))

    return NextResponse.json({ ok: true, data: rows })
  } catch (e) {
    console.error('delivery-branch-member API error:', e)
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}