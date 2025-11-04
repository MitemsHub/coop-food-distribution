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

    const baseRows = (data || []).map(r => ({
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

    // Build enrichment maps for Original Price and Markup
    const branchCodes = [...new Set(baseRows.map(r => r.DeliveryBranch ? null : null).concat((data || []).map(r => r.branch_code)))].filter(Boolean)
    const itemNames = [...new Set(baseRows.map(r => r.Item))]

    // Fetch branches map: code -> id
    const { data: branchesData, error: branchesErr } = await supabase
      .from('branches')
      .select('id, code')
      .in('code', branchCodes)
    if (branchesErr) throw new Error(branchesErr.message)
    const branchIdByCode = new Map(branchesData.map(b => [b.code, b.id]))

    // Fetch items map: name -> item_id
    const { data: itemsData, error: itemsErr } = await supabase
      .from('items')
      .select('item_id, name')
      .in('name', itemNames)
    if (itemsErr) throw new Error(itemsErr.message)
    const itemIdByName = new Map(itemsData.map(i => [i.name, i.item_id]))

    const branchIds = [...new Set((data || []).map(r => branchIdByCode.get(r.branch_code)).filter(Boolean))]
    const itemIds = [...new Set(itemsData.map(i => i.item_id))]

    // Fetch base prices for branch+item pairs
    const { data: bipData, error: bipErr } = await supabase
      .from('branch_item_prices')
      .select('branch_id, item_id, price')
      .in('branch_id', branchIds)
      .in('item_id', itemIds)
    if (bipErr) throw new Error(bipErr.message)
    const basePriceMap = new Map(bipData.map(r => [`${r.branch_id}:${r.item_id}`, Number(r.price)]))

    // Fetch markups for branch+item pairs (active only)
    const { data: markupData, error: markupErr } = await supabase
      .from('branch_item_markups')
      .select('branch_id, item_id, amount, active')
      .in('branch_id', branchIds)
      .in('item_id', itemIds)
    if (markupErr) throw new Error(markupErr.message)
    const markupMap = new Map(markupData.filter(m => !!m.active).map(m => [`${m.branch_id}:${m.item_id}`, Number(m.amount)]))

    // Enrich rows with OriginalPrice, Markup, Interest
    const rows = baseRows.map((r, idx) => {
      const code = (data[idx] || {}).branch_code
      const itemName = r.Item
      const branchId = branchIdByCode.get(code)
      const itemId = itemIdByName.get(itemName)
      const key = branchId && itemId ? `${branchId}:${itemId}` : null
      const markup = key ? (markupMap.get(key) || 0) : 0
      const basePrice = key ? (basePriceMap.get(key) ?? (r.Price - markup)) : (r.Price - markup)
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