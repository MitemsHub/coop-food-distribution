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

    // Filter by DELIVERY branch code if provided (server-side)
    if (branch) q = q.eq('branch_code', branch)

    // NOTE: Do NOT filter by posted_at server-side; it excludes Pending orders.
    // We'll filter by an effective date client-side: posted_at if present, else created_at.

    const { data, error } = await q
    if (error) throw new Error(error.message)

    // Paginate to fetch ALL rows using 1000-row pages (Supabase default cap)
    const batchSize = 1000
    let start = 0
    const allData = []
    while (true) {
      const { data: page, error: pageErr } = await q
        .order('order_id', { ascending: true })
        .range(start, start + batchSize - 1)
      if (pageErr) throw new Error(pageErr.message)
      if (!page || page.length === 0) break
      allData.push(...page)
      if (page.length < batchSize) break
      start += batchSize
    }

    let baseRows = (allData || []).map(r => ({
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
      CreatedAt: r.created_at,
      EffectiveDate: r.posted_at || r.created_at
    }))

    // Apply date filters client-side using EffectiveDate (posted_at || created_at)
    if (from) {
      const fromTs = new Date(from).getTime()
      baseRows = baseRows.filter(r => {
        const d = r.EffectiveDate ? new Date(r.EffectiveDate).getTime() : 0
        return d >= fromTs
      })
    }
    if (to) {
      const toTs = new Date(to + 'T23:59:59').getTime()
      baseRows = baseRows.filter(r => {
        const d = r.EffectiveDate ? new Date(r.EffectiveDate).getTime() : 0
        return d <= toTs
      })
    }

    // Build enrichment maps for Markup using item names joined from markups
    const branchCodes = [...new Set((allData || []).map(r => r.branch_code))].filter(Boolean)

    // Fetch branches map: code -> id
    const { data: branchesData, error: branchesErr } = await supabase
      .from('branches')
      .select('id, code')
      .in('code', branchCodes)
    if (branchesErr) throw new Error(branchesErr.message)
    const branchIdByCode = new Map(branchesData.map(b => [b.code, b.id]))
    const branchIds = [...new Set((allData || []).map(r => branchIdByCode.get(r.branch_code)).filter(Boolean))]

    // Fetch markups joined with items to resolve by item name; paginate to avoid 1000-row cap
    const norm = s => String(s || '').toLowerCase().trim()
    const markupByBranchAndName = new Map()
    {
      const batchSize = 1000
      let start = 0
      while (true) {
        const { data: page, error: pageErr } = await supabase
          .from('branch_item_markups')
          .select('branch_id, amount, active, items(name)')
          .in('branch_id', branchIds)
          .order('branch_id', { ascending: true })
          .range(start, start + batchSize - 1)
        if (pageErr) throw new Error(pageErr.message)
        if (!page || page.length === 0) break
        for (const m of page) {
          if (!m.active) continue
          const key = `${m.branch_id}:${norm(m.items?.name)}`
          markupByBranchAndName.set(key, Number(m.amount) || 0)
        }
        if (page.length < batchSize) break
        start += batchSize
      }
    }

    // Enrich rows with OriginalPrice, Markup, Interest
    const rows = baseRows.map((r, idx) => {
      const code = (allData[idx] || {}).branch_code
      const itemName = r.Item
      const branchId = branchIdByCode.get(code)
      const key2 = branchId ? `${branchId}:${norm(itemName)}` : null
      const markup = key2 ? (markupByBranchAndName.get(key2) || 0) : 0
      const basePrice = Number(r.Price) - Number(markup)
      const interest = r.Payment === 'Loan' ? Math.round(r.Amount * 0.13) : 0
      return {
        ...r,
        OriginalPrice: Number(basePrice),
        Markup: Number(markup),
        Interest: Number(interest)
      }
    })

    const wb = XLSX.utils.book_new()
    const mk = a => XLSX.utils.json_to_sheet(a)

    // Sheets with enriched columns
    XLSX.utils.book_append_sheet(wb, mk(rows), 'Master')
    XLSX.utils.book_append_sheet(wb, mk(rows.filter(r => r.Payment === 'Savings').map(r => ({
      ...r,
      Interest: 0
    }))), 'Savings')
    XLSX.utils.book_append_sheet(wb, mk(rows.filter(r => r.Payment === 'Loan')), 'Loan')
    XLSX.utils.book_append_sheet(wb, mk(rows.filter(r => r.Payment === 'Cash').map(r => ({
      ...r,
      Interest: 0
    }))), 'Cash')

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