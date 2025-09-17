// app/api/admin/reports/summary/route.js
import { NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabaseServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createClient()
    const byBranchQ       = supabase.from('v_applications_by_branch').select('*')
  const byBranchDeptQ   = supabase.from('v_applications_by_branch_department').select('*')
  const byCategoryQ     = supabase.from('v_applications_by_category').select('*')

  const totalPostedQ    = supabase.from('orders').select('order_id', { count: 'exact', head: true }).in('status', ['Posted','Delivered'])
  const totalPendingQ   = supabase.from('orders').select('order_id', { count: 'exact', head: true }).eq('status', 'Pending')
  const totalDeliveredQ = supabase.from('orders').select('order_id', { count: 'exact', head: true }).eq('status', 'Delivered')
  const totalAllQ       = supabase.from('orders').select('order_id', { count: 'exact', head: true })

    const [
      byBranch, byBranchDept, byCat,
      totalPosted, totalPending, totalDelivered, totalAll
    ] = await Promise.all([
      byBranchQ, byBranchDeptQ, byCategoryQ,
      totalPostedQ, totalPendingQ, totalDeliveredQ, totalAllQ
    ])

    const err = byBranch.error || byBranchDept.error || byCat.error
            || totalPosted.error || totalPending.error || totalDelivered.error || totalAll.error
    if (err) throw new Error(err.message)

    return NextResponse.json({
      ok: true,
      totals: {
        totalPosted: totalPosted.count ?? 0,
        totalPending: totalPending.count ?? 0,
        totalDelivered: totalDelivered.count ?? 0,
        totalAll: totalAll.count ?? 0
      },
      byBranch: byBranch.data || [],
      byBranchDept: byBranchDept.data || [],
      byCategory: byCat.data || []
    })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}