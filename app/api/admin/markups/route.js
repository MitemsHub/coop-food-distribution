// app/api/admin/markups/route.js
import { NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabaseServer'
import { validateSession, validateBranchCode, validateSku, validateNumber } from '../../../../lib/validation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// List markups for a branch (optionally filter by sku)
export async function GET(request) {
  try {
    const session = await validateSession(request, 'admin')
    if (!session.valid) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const branchCodeParam = searchParams.get('branch_code')
    const skuParam = searchParams.get('sku')
    const branchCodeRes = validateBranchCode(branchCodeParam)
    if (!branchCodeRes.isValid) return NextResponse.json({ ok: false, error: branchCodeRes.error }, { status: 400 })

    const supabase = createClient()
    const branchCode = branchCodeRes.sanitized

    const { data: branch, error: brErr } = await supabase
      .from('branches')
      .select('id, code, name')
      .eq('code', branchCode)
      .single()
    if (brErr || !branch) return NextResponse.json({ ok: false, error: 'Branch not found' }, { status: 404 })

    // Join to items for convenience if available
    let query = supabase
      .from('branch_item_markups')
      .select('item_id, amount, active, items:item_id ( sku, name, unit, category )')
      .eq('branch_id', branch.id)

    if (skuParam) {
      const skuRes = validateSku(skuParam)
      if (!skuRes.isValid) return NextResponse.json({ ok: false, error: skuRes.error }, { status: 400 })
      // Filter client-side after fetch because PostgREST nested filter may not work depending on FK aliasing
      const { data, error } = await query
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
      const sku = skuRes.sanitized
      const filtered = (data || []).filter(m => (m.items?.sku || '').toUpperCase() === sku.toUpperCase())
      return NextResponse.json({ ok: true, branch: { code: branch.code, name: branch.name }, markups: filtered })
    } else {
      const { data, error } = await query
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true, branch: { code: branch.code, name: branch.name }, markups: data || [] })
    }
  } catch (error) {
    console.error('Markups GET error:', error)
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 })
  }
}

// Upsert a markup for a given branch_code + sku
export async function POST(request) {
  try {
    const session = await validateSession(request, 'admin')
    if (!session.valid) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient()
    const body = await request.json()
    const branchCodeRes = validateBranchCode(body.branch_code)
    const skuRes = validateSku(body.sku)
    const amountRes = validateNumber(body.amount ?? 500, { min: 0, max: 100000, integer: true })

    if (!branchCodeRes.isValid) return NextResponse.json({ ok: false, error: branchCodeRes.error }, { status: 400 })
    if (!skuRes.isValid)        return NextResponse.json({ ok: false, error: skuRes.error }, { status: 400 })
    if (!amountRes.isValid)     return NextResponse.json({ ok: false, error: amountRes.error }, { status: 400 })

    const branchCode = branchCodeRes.sanitized
    const sku = skuRes.sanitized
    const amount = amountRes.value

    const { data: branch, error: brErr } = await supabase
      .from('branches')
      .select('id, code')
      .eq('code', branchCode)
      .single()
    if (brErr || !branch) return NextResponse.json({ ok: false, error: 'Branch not found' }, { status: 404 })

    const { data: item, error: iErr } = await supabase
      .from('items')
      .select('item_id, sku')
      .eq('sku', sku)
      .single()
    if (iErr || !item) return NextResponse.json({ ok: false, error: 'Item not found' }, { status: 404 })

    // Upsert markup
    const { error: upErr } = await supabase
      .from('branch_item_markups')
      .upsert({ branch_id: branch.id, item_id: item.item_id, amount, active: true }, { onConflict: 'branch_id,item_id' })

    if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 })

    return NextResponse.json({ ok: true, message: `Markup set to ₦${amount} for ${sku} in ${branchCode}` })
  } catch (error) {
    console.error('Markups POST error:', error)
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 })
  }
}

// Remove a markup for branch_code + sku
export async function DELETE(request) {
  try {
    const session = await validateSession(request, 'admin')
    if (!session.valid) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient()
    const body = await request.json()
    const branchCodeRes = validateBranchCode(body.branch_code)
    const skuRes = validateSku(body.sku)

    if (!branchCodeRes.isValid) return NextResponse.json({ ok: false, error: branchCodeRes.error }, { status: 400 })
    if (!skuRes.isValid)        return NextResponse.json({ ok: false, error: skuRes.error }, { status: 400 })

    const branchCode = branchCodeRes.sanitized
    const sku = skuRes.sanitized

    const { data: branch, error: brErr } = await supabase
      .from('branches')
      .select('id, code')
      .eq('code', branchCode)
      .single()
    if (brErr || !branch) return NextResponse.json({ ok: false, error: 'Branch not found' }, { status: 404 })

    const { data: item, error: iErr } = await supabase
      .from('items')
      .select('item_id, sku')
      .eq('sku', sku)
      .single()
    if (iErr || !item) return NextResponse.json({ ok: false, error: 'Item not found' }, { status: 404 })

    const { error: delErr } = await supabase
      .from('branch_item_markups')
      .delete()
      .eq('branch_id', branch.id)
      .eq('item_id', item.item_id)

    if (delErr) return NextResponse.json({ ok: false, error: delErr.message }, { status: 500 })

    return NextResponse.json({ ok: true, message: `Markup removed for ${sku} in ${branchCode}` })
  } catch (error) {
    console.error('Markups DELETE error:', error)
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 })
  }
}