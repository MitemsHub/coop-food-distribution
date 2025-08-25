// app/api/admin/reports/summary/route.js
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const admin = createClient(url, key)

export async function GET() {
  try {
    const byBranchQ       = admin.from('v_applications_by_branch').select('*')
    const byBranchDeptQ   = admin.from('v_applications_by_branch_department').select('*')
    const byCategoryQ     = admin.from('v_applications_by_category').select('*')
    const inventoryQ      = admin.from('v_inventory_status').select('*')

    const totalPostedQ    = admin.from('orders').select('order_id', { count: 'exact', head: true }).in('status', ['Posted','Delivered'])
    const totalPendingQ   = admin.from('orders').select('order_id', { count: 'exact', head: true }).eq('status', 'Pending')
    const totalDeliveredQ = admin.from('orders').select('order_id', { count: 'exact', head: true }).eq('status', 'Delivered')
    const totalCancelledQ = admin.from('orders').select('order_id', { count: 'exact', head: true }).eq('status', 'Cancelled')
    const totalAllQ       = admin.from('orders').select('order_id', { count: 'exact', head: true })

    const [
      byBranch, byBranchDept, byCat, inventory,
      totalPosted, totalPending, totalDelivered, totalCancelled, totalAll
    ] = await Promise.all([
      byBranchQ, byBranchDeptQ, byCategoryQ, inventoryQ,
      totalPostedQ, totalPendingQ, totalDeliveredQ, totalCancelledQ, totalAllQ
    ])

    const err = byBranch.error || byBranchDept.error || byCat.error || inventory.error
            || totalPosted.error || totalPending.error || totalDelivered.error || totalCancelled.error || totalAll.error
    if (err) throw new Error(err.message)

    return NextResponse.json({
      ok: true,
      totals: {
        totalPosted: totalPosted.count ?? 0,
        totalPending: totalPending.count ?? 0,
        totalDelivered: totalDelivered.count ?? 0,
        totalCancelled: totalCancelled.count ?? 0,
        totalAll: totalAll.count ?? 0
      },
      byBranch: byBranch.data || [],
      byBranchDept: byBranchDept.data || [],
      byCategory: byCat.data || [],
      inventory: inventory.data || []
    })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}