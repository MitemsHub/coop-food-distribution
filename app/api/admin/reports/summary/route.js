// app/api/admin/reports/summary/route.js
import { NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabaseServer'
import { queryDirect } from '../../../../../lib/directDb'

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

    const [
      byBranch, byBranchDept, byDeliveryMember, byCat,
      totalPosted, totalPending, totalDelivered, totalAll,
      loansAmount, savingsAmount, cashAmount, allAmount
    ] = await Promise.all([
      byBranchQ, byBranchDeptQ, byDeliveryMemberQ, byCategoryQ,
      totalPostedQ, totalPendingQ, totalDeliveredQ, totalAllQ,
      // Amounts are loaded below using either direct SQL or paged Supabase reads
      null, null, null, null
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
    const getTotal = (res) => Number(res?.rows?.[0]?.total || 0)

    // Helper to sum via Supabase when direct DB URL is not available
    async function sumViaSupabase(paymentOption) {
      const countRes = await supabase
        .from('orders')
        .select('order_id', { count: 'exact', head: true })
        .in('status', statuses)
        .eq('payment_option', paymentOption)
      const totalCount = countRes?.count || 0
      const pageSize = 1000
      let sum = 0
      for (let start = 0; start < totalCount; start += pageSize) {
        const end = Math.min(start + pageSize - 1, Math.max(totalCount - 1, 0))
        const res = await supabase
          .from('orders')
          .select('total_amount')
          .in('status', statuses)
          .eq('payment_option', paymentOption)
          .range(start, end)
        sum += (res?.data || []).reduce((s, r) => s + Number(r.total_amount || 0), 0)
      }
      return sum
    }

    async function sumAllViaSupabase() {
      const countRes = await supabase
        .from('orders')
        .select('order_id', { count: 'exact', head: true })
        .in('status', statuses)
      const totalCount = countRes?.count || 0
      const pageSize = 1000
      let sum = 0
      for (let start = 0; start < totalCount; start += pageSize) {
        const end = Math.min(start + pageSize - 1, Math.max(totalCount - 1, 0))
        const res = await supabase
          .from('orders')
          .select('total_amount')
          .in('status', statuses)
          .range(start, end)
        sum += (res?.data || []).reduce((s, r) => s + Number(r.total_amount || 0), 0)
      }
      return sum
    }

    // Compute amounts: prefer direct SQL, else robust Supabase fallback
    const hasDirect = !!process.env.SUPABASE_DB_URL
    let loansOrdersTotal = 0
    let savingsTotal = 0
    let cashTotal = 0
    if (hasDirect) {
      const [loansAmount, savingsAmount, cashAmount, allAmount] = await Promise.all([
        queryDirect(`SELECT COALESCE(SUM(total_amount),0)::numeric AS total FROM orders WHERE payment_option='Loan' AND status IN ('Pending','Posted','Delivered')`),
        queryDirect(`SELECT COALESCE(SUM(total_amount),0)::numeric AS total FROM orders WHERE payment_option='Savings' AND status IN ('Pending','Posted','Delivered')`),
        queryDirect(`SELECT COALESCE(SUM(total_amount),0)::numeric AS total FROM orders WHERE payment_option='Cash' AND status IN ('Pending','Posted','Delivered')`),
        queryDirect(`SELECT COALESCE(SUM(total_amount),0)::numeric AS total FROM orders WHERE status IN ('Pending','Posted','Delivered')`)
      ])
      loansOrdersTotal = getTotal(loansAmount)
      savingsTotal = getTotal(savingsAmount)
      cashTotal = getTotal(cashAmount)
    } else {
      loansOrdersTotal = await sumViaSupabase('Loan')
      savingsTotal = await sumViaSupabase('Savings')
      cashTotal = await sumViaSupabase('Cash')
      // all total not needed for cards; compute if required with sumAllViaSupabase()
    }

    // Compute Loan principal and interest via direct SQL (per-order rounding)
    let loansPrincipal = 0
    let loansInterest = 0
    let loansTotal = 0
    try {
      const sql = `
        WITH loan_orders AS (
          SELECT o.order_id
          FROM orders o
          WHERE o.payment_option = 'Loan'
            AND o.status IN ('Pending','Posted','Delivered')
        ), per_order AS (
          -- Use recorded line amount to avoid unit_price/qty drift
          SELECT ol.order_id, SUM(ol.amount)::numeric AS base
          FROM order_lines ol
          JOIN loan_orders lo ON lo.order_id = ol.order_id
          GROUP BY ol.order_id
        )
        SELECT 
          COALESCE(SUM(base), 0)::numeric AS loans_principal,
          COALESCE(SUM(ROUND(base * 0.13)), 0)::numeric AS loans_interest,
          COALESCE(SUM(base) + SUM(ROUND(base * 0.13)), 0)::numeric AS loans_total
        FROM per_order;
      `
      const result = await queryDirect(sql)
      const row = result?.rows?.[0]
      loansPrincipal = Number(row?.loans_principal || 0)
      loansInterest = Number(row?.loans_interest || 0)
      loansTotal = Number(row?.loans_total || 0)
    } catch (err) {
      console.warn('Reports summary: loan principal/interest calc failed, falling back:', err?.message)
      // Fallback: derive principal approximately by subtracting a 13% aggregate interest (may differ due to per-order rounding)
      const loansAmountTotal = Number(loansOrdersTotal || 0)
      loansPrincipal = Math.round(loansAmountTotal / 1.13)
      loansInterest = loansAmountTotal - loansPrincipal
      loansTotal = loansAmountTotal
    }

    // Unified total used by the Total Amount card: align with displayed Loan card which reads from orders
    const totalUnified = Number(loansOrdersTotal || 0) + Number(savingsTotal || 0) + Number(cashTotal || 0)

    return NextResponse.json({
      ok: true,
      totals: {
        totalPosted: (totalPosted && totalPosted.count) ?? 0,
        totalPending: (totalPending && totalPending.count) ?? 0,
        totalDelivered: (totalDelivered && totalDelivered.count) ?? 0,
        totalAll: (totalAll && totalAll.count) ?? 0
      },
      amounts: {
        // Displayed Total Amount card should match the sum of displayed components
        totalAll: totalUnified,
        // Loan Amount card reads from orders total to match Savings/Cash sourcing
        loans: loansOrdersTotal, // total including interest from orders table
        loansPrincipal,
        loansInterest,
        loansTotal,
        savings: savingsTotal,
        cash: cashTotal
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