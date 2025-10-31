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
    const byDeliveryMemberQ = supabase.from('v_applications_by_delivery_branch_member_branch').select('*')
    const byCategoryQ     = supabase.from('v_applications_by_category').select('*')

    const totalPostedQ    = supabase.from('orders').select('order_id', { count: 'exact', head: true }).in('status', ['Posted','Delivered'])
    const totalPendingQ   = supabase.from('orders').select('order_id', { count: 'exact', head: true }).eq('status', 'Pending')
    const totalDeliveredQ = supabase.from('orders').select('order_id', { count: 'exact', head: true }).eq('status', 'Delivered')
    const totalAllQ       = supabase.from('orders').select('order_id', { count: 'exact', head: true })

    // Amount totals across all statuses (Pending, Posted, Delivered)
    const statuses = ['Pending','Posted','Delivered']
    const loansAmountQ   = supabase.from('orders').select('total_amount').eq('payment_option','Loan').in('status', statuses)
    const savingsAmountQ = supabase.from('orders').select('total_amount').eq('payment_option','Savings').in('status', statuses)
    const cashAmountQ    = supabase.from('orders').select('total_amount').eq('payment_option','Cash').in('status', statuses)
    const allAmountQ     = supabase.from('orders').select('total_amount').in('status', statuses)

    const [
      byBranch, byBranchDept, byDeliveryMember, byCat,
      totalPosted, totalPending, totalDelivered, totalAll,
      loansAmount, savingsAmount, cashAmount, allAmount
    ] = await Promise.all([
      byBranchQ, byBranchDeptQ, byDeliveryMemberQ, byCategoryQ,
      totalPostedQ, totalPendingQ, totalDeliveredQ, totalAllQ,
      loansAmountQ, savingsAmountQ, cashAmountQ, allAmountQ
    ])

    // Graceful handling: views may be missing in some environments
    const viewWarn = byBranch.error || byBranchDept.error || byDeliveryMember.error || byCat.error
    if (viewWarn) {
      console.warn('Reports summary: one or more views unavailable:', viewWarn.message)
    }

    // Totals and amounts should not fail the whole endpoint
    const totalsErr = totalPosted.error || totalPending.error || totalDelivered.error || totalAll.error
    if (totalsErr) {
      console.warn('Reports summary: totals error:', totalsErr.message)
    }
    const amountsErr = loansAmount.error || savingsAmount.error || cashAmount.error || allAmount.error
    if (amountsErr) {
      console.warn('Reports summary: amounts error:', amountsErr.message)
    }

    const sumAmt = (rows) => (rows || []).reduce((s, r) => s + Number(r.total_amount || 0), 0)

    return NextResponse.json({
      ok: true,
      totals: {
        totalPosted: (totalPosted && totalPosted.count) ?? 0,
        totalPending: (totalPending && totalPending.count) ?? 0,
        totalDelivered: (totalDelivered && totalDelivered.count) ?? 0,
        totalAll: (totalAll && totalAll.count) ?? 0
      },
      amounts: {
        totalAll: sumAmt(allAmount?.data || []),
        loans: sumAmt(loansAmount?.data || []),
        savings: sumAmt(savingsAmount?.data || []),
        cash: sumAmt(cashAmount?.data || [])
      },
      byBranch: byBranch?.data || [],
      byBranchDept: byBranchDept?.data || [],
      byDeliveryMember: byDeliveryMember?.data || [],
      byCategory: byCat?.data || []
    })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}