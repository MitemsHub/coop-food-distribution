// app/api/admin/import/markups/route.js
import { NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabaseServer'
import * as XLSX from 'xlsx/xlsx.mjs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const chunk = (arr, size = 500) => {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

const parseBool = (val) => {
  const s = String(val ?? '').trim().toLowerCase()
  if (!s) return true
  if (['true', 'yes', 'y', '1'].includes(s)) return true
  if (['false', 'no', 'n', '0'].includes(s)) return false
  return true
}

export async function POST(req) {
  try {
    const supabase = createClient()
    const formData = await req.formData()
    const file = formData.get('file')
    if (!file) return NextResponse.json({ ok: false, error: 'file is required' }, { status: 400 })

    const buf = Buffer.from(await file.arrayBuffer())
    const wb = XLSX.read(buf, { type: 'buffer' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })

    // Expected headers:
    // branch_code, sku, amount, active
    if (!rows.length) return NextResponse.json({ ok: false, error: 'No rows found' }, { status: 400 })

    // Fetch branches and items maps
    const { data: branches, error: bErr } = await supabase.from('branches').select('id,code')
    if (bErr) return NextResponse.json({ ok: false, error: bErr.message }, { status: 500 })
    const branchByCode = new Map((branches || []).map(b => [String(b.code).trim().toUpperCase(), b.id]))

    const { data: itemsAll, error: iErr } = await supabase.from('items').select('item_id,sku')
    if (iErr) return NextResponse.json({ ok: false, error: iErr.message }, { status: 500 })
    const itemIdBySku = new Map((itemsAll || []).map(i => [String(i.sku).trim().toUpperCase(), i.item_id]))

    const upserts = []
    const unknownBranches = new Set()
    const missingSkus = new Set()

    for (const r of rows) {
      const branch_code = String(r.branch_code || '').trim().toUpperCase()
      const sku = String(r.sku || '').trim().toUpperCase()
      const amount = Number(String(r.amount || '0').replace(/[, ]/g, '')) || 0
      const active = parseBool(r.active)

      const branch_id = branchByCode.get(branch_code)
      const item_id = itemIdBySku.get(sku)
      if (!branch_id) unknownBranches.add(branch_code)
      if (!item_id) missingSkus.add(sku)
      if (!branch_id || !item_id) continue

      upserts.push({ branch_id, item_id, amount, active })
    }

    let affected = 0
    for (const part of chunk(upserts, 500)) {
      for (const data of part) {
        // Check existing record
        const { data: existing } = await supabase
          .from('branch_item_markups')
          .select('id')
          .eq('branch_id', data.branch_id)
          .eq('item_id', data.item_id)
          .single()

        if (existing) {
          const { error: uErr } = await supabase
            .from('branch_item_markups')
            .update({ amount: data.amount, active: data.active })
            .eq('branch_id', data.branch_id)
            .eq('item_id', data.item_id)
          if (uErr) return NextResponse.json({ ok: false, error: uErr.message }, { status: 500 })
        } else {
          const { error: iErr2 } = await supabase
            .from('branch_item_markups')
            .insert(data)
          if (iErr2) return NextResponse.json({ ok: false, error: iErr2.message }, { status: 500 })
        }
        affected++
      }
    }

    return NextResponse.json({ 
      ok: true, 
      markupsUpserted: affected, 
      unknownBranches: [...unknownBranches].filter(Boolean),
      missingSkus: [...missingSkus].filter(Boolean)
    })
  } catch (e) {
    console.error('Import markups error:', e)
    return NextResponse.json({ ok: false, error: e.message || 'Unknown error' }, { status: 500 })
  }
}