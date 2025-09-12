// app/api/admin/import/prices/route.js
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
    // sku, item_name, unit, category, branch_code, price, initial_stock
    if (!rows.length) return NextResponse.json({ ok: false, error: 'No rows found' }, { status: 400 })

    // Fetch branches
    const { data: branches, error: bErr } = await supabase.from('branches').select('id,code')
    if (bErr) return NextResponse.json({ ok: false, error: bErr.message }, { status: 500 })
    const branchByCode = new Map(branches.map(b => [String(b.code).trim().toUpperCase(), b.id]))

    const itemUpserts = []
    const priceUpserts = []
    const unknownBranches = new Set()

    // First collect item rows by sku
    const itemsMap = new Map() // sku -> {sku,name,unit,category}
    for (const r of rows) {
      const sku = String(r.sku || '').trim().toUpperCase()
      const name = String(r.item_name || '').trim()
      const unit = String(r.unit || '').trim()
      const category = String(r.category || '').trim()
      if (!sku || !name) continue
      if (!itemsMap.has(sku)) itemsMap.set(sku, { sku, name: name, unit, category })
    }
    itemUpserts.push(...itemsMap.values())

    // Upsert items
    let itemsAffected = 0
    for (const part of chunk(itemUpserts, 500)) {
      const { error: iErr, count } = await supabase
        .from('items')
        .upsert(part, { onConflict: 'sku', ignoreDuplicates: false, count: 'exact' })
      if (iErr) {
        console.error('Items upsert error:', iErr)
        return NextResponse.json({ ok: false, error: iErr.message }, { status: 500 })
      }
      itemsAffected += count || part.length
    }

    // Fetch items to map ids
    const { data: itemsAll, error: fiErr } = await supabase.from('items').select('item_id,sku')
    if (fiErr) return NextResponse.json({ ok: false, error: fiErr.message }, { status: 500 })
    const itemIdBySku = new Map(itemsAll.map(i => [String(i.sku).trim().toUpperCase(), i.item_id]))

    // Get active cycle for inventory movements
    const { data: activeCycle } = await supabase
      .from('cycles')
      .select('id')
      .eq('is_active', true)
      .single()

    // Build branch_item_prices upserts and inventory movements
    const inventoryMovements = []
    
    for (const r of rows) {
      const sku = String(r.sku || '').trim().toUpperCase()
      const branch_code = String(r.branch_code || '').trim().toUpperCase()
      const price = Number(String(r.price || '0').replace(/[, ]/g, '')) || 0
      const initial_stock = Number(String(r.initial_stock || '0').replace(/[, ]/g, '')) || 0

      const item_id = itemIdBySku.get(sku)
      const branch_id = branchByCode.get(branch_code)
      if (!item_id || !branch_id) {
        if (!branch_id) unknownBranches.add(branch_code)
        continue
      }
      priceUpserts.push({ branch_id, item_id, price, initial_stock })
      
      // Add inventory movement for initial stock if provided
      if (initial_stock > 0 && activeCycle) {
        inventoryMovements.push({
          branch_id,
          item_id,
          cycle_id: activeCycle.id,
          movement_type: 'In',
          quantity: initial_stock,
          reference_type: 'initial',
          notes: 'Initial stock from import'
        })
      }
    }

    // Insert/Update prices using manual conflict resolution
    let pricesAffected = 0
    for (const part of chunk(priceUpserts, 500)) {
      for (const priceData of part) {
        // Check if record exists
        const { data: existing } = await supabase
          .from('branch_item_prices')
          .select('id')
          .eq('branch_id', priceData.branch_id)
          .eq('item_id', priceData.item_id)
          .single()
        
        if (existing) {
          // Update existing record
          const { error: updateErr } = await supabase
             .from('branch_item_prices')
             .update({ price: priceData.price, initial_stock: priceData.initial_stock })
             .eq('branch_id', priceData.branch_id)
             .eq('item_id', priceData.item_id)
          if (updateErr) {
            console.error('Price update error:', updateErr)
            return NextResponse.json({ ok: false, error: updateErr.message }, { status: 500 })
          }
        } else {
          // Insert new record
          const { error: insertErr } = await supabase
            .from('branch_item_prices')
            .insert(priceData)
          if (insertErr) {
            console.error('Price insert error:', insertErr)
            return NextResponse.json({ ok: false, error: insertErr.message }, { status: 500 })
          }
        }
        pricesAffected++
      }
    }
    
    // Insert inventory movements for initial stock
    let inventoryAffected = 0
    if (inventoryMovements.length > 0) {
      for (const part of chunk(inventoryMovements, 500)) {
        const { error: invErr } = await supabase
          .from('inventory_movements')
          .insert(part)
        
        if (invErr) {
          console.error('Inventory movements error:', invErr)
        } else {
          inventoryAffected += part.length
        }
      }
    }

    return NextResponse.json({
      ok: true,
      itemsUpserted: itemsAffected,
      priceRowsUpserted: pricesAffected,
      inventoryMovementsCreated: inventoryAffected,
      unknownBranches: [...unknownBranches].filter(Boolean)
    })
  } catch (e) {
    console.error('Import prices error:', e)
    return NextResponse.json({ ok: false, error: e.message || 'Unknown error' }, { status: 500 })
  }
}