// app/api/admin/reports/branch-pack/route.js
import { NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabaseServer'
import * as XLSX from 'xlsx/xlsx.mjs' // ESM namespace import

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req) {
  try {
    const supabase = createClient()
    const { searchParams } = new URL(req.url)
    const branch = (searchParams.get('branch') || '').trim() // '' => ALL DELIVERY branches
    const from   = searchParams.get('from') || ''
    const to     = searchParams.get('to')   || ''

    // v_master_sheet now exposes:
    // branch_code/branch_name           => DELIVERY branch
    // member_branch_code/_name          => MEMBER (home) branch
    const selectCols = `
      order_id,
      created_at,
      posted_at,
      payment_option,
      member_id,
      member_name,
      branch_code,
      branch_name,
      member_branch_code,
      member_branch_name,
      department_name,
      item_name,
      unit_price,
      qty,
      amount
    `

    let q = supabase.from('v_master_sheet').select(selectCols)

    // Filter by DELIVERY branch code if provided
    if (branch) q = q.eq('branch_code', branch)
    if (from)   q = q.gte('posted_at', from)
    if (to)     q = q.lte('posted_at', to + 'T23:59:59')

    const { data, error } = await q
    if (error) throw new Error(error.message)

    const rows = (data || []).map(r => ({
      OrderID: r.order_id,
      MemberID: r.member_id,
      MemberName: r.member_name,
      DeliveryBranch: r.branch_name,             // DELIVERY
      MemberBranch: r.member_branch_name || '',  // HOME
      Department: r.department_name || '',
      Payment: r.payment_option,
      Item: r.item_name,
      Price: Number(r.unit_price),
      Qty: Number(r.qty),
      Amount: Number(r.amount),
      PostedAt: r.posted_at,
      CreatedAt: r.created_at
    }))

    const wb = XLSX.utils.book_new()
    const mk = a => XLSX.utils.json_to_sheet(a)

    XLSX.utils.book_append_sheet(wb, mk(rows), 'Master')
    XLSX.utils.book_append_sheet(wb, mk(rows.filter(r => r.Payment === 'Savings')), 'Savings')
    XLSX.utils.book_append_sheet(wb, mk(rows.filter(r => r.Payment === 'Loan')), 'Loan')
    XLSX.utils.book_append_sheet(wb, mk(rows.filter(r => r.Payment === 'Cash')), 'Cash')

    // Use base64 encoding for better compatibility with fetch API
    const b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' })
    const filename = `Branch_Pack_${branch || 'ALL'}.xlsx`

    // Return JSON with the base64 data
    return NextResponse.json({
      ok: true,
      filename,
      data: b64,
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
  } catch (e) {
    console.error('branch-pack error:', e)
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}