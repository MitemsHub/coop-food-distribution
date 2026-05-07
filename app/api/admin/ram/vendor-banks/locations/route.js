import { NextResponse } from 'next/server'
import { validateSession } from '@/lib/validation'
import { createClient } from '@/lib/supabaseServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function asInt(value, fallback) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

function isMissingTable(error, tableName) {
  const code = String(error?.code || '')
  if (code === '42P01') return true
  const msg = `${error?.message || ''} ${error?.details || ''}`.toLowerCase()
  const t = String(tableName || '').toLowerCase()
  if (!msg.includes(t)) return false
  return msg.includes('does not exist') || msg.includes('could not find the table')
}

async function resolveActiveRamCycleId(supabase) {
  const { data: active, error: aErr } = await supabase
    .from('ram_cycles')
    .select('id')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .maybeSingle()
  if (aErr) {
    if (isMissingTable(aErr, 'ram_cycles')) return null
    throw aErr
  }
  if (active?.id) return active.id
  const { data: latest, error: lErr } = await supabase.from('ram_cycles').select('id').order('created_at', { ascending: false }).maybeSingle()
  if (lErr) {
    if (isMissingTable(lErr, 'ram_cycles')) return null
    throw lErr
  }
  return latest?.id || null
}

export async function GET(req) {
  try {
    const session = await validateSession(req, 'admin')
    if (!session.valid) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const supabase = createClient()
    const { searchParams } = new URL(req.url)
    const onlyActive = String(searchParams.get('active') || '1') !== '0'

    let q = supabase.from('ram_delivery_locations').select('id,delivery_location,name,phone,is_active,rep_code').order('id', { ascending: true })
    if (onlyActive) q = q.eq('is_active', true)
    const { data: locations, error: locErr } = await q
    if (locErr) return NextResponse.json({ ok: false, error: locErr.message }, { status: 500 })

    const ids = (locations || []).map((l) => asInt(l?.id, null)).filter((n) => Number.isFinite(n) && n > 0)
    if (!ids.length) return NextResponse.json({ ok: true, locations: [] })

    const cycleId = await resolveActiveRamCycleId(supabase).catch(() => null)

    const [banksRes, invoicesRes, paidRes] = await Promise.all([
      supabase
        .from('ram_vendor_bank_accounts')
        .select('id,ram_delivery_location_id,bank_name,account_name,account_number,is_current,created_at,created_by_role,created_by_code')
        .in('ram_delivery_location_id', ids)
        .eq('is_current', true),
      supabase.from('ram_vendor_invoices').select('id,ram_delivery_location_id').in('ram_delivery_location_id', ids),
      cycleId
        ? supabase
            .from('ram_vendor_payment_status')
            .select('ram_delivery_location_id,is_paid,paid_at,ram_cycle_id')
            .eq('ram_cycle_id', cycleId)
            .in('ram_delivery_location_id', ids)
        : Promise.resolve({ data: [], error: null }),
    ])

    if (banksRes.error) return NextResponse.json({ ok: false, error: banksRes.error.message }, { status: 500 })
    if (invoicesRes.error) return NextResponse.json({ ok: false, error: invoicesRes.error.message }, { status: 500 })
    if (paidRes?.error) {
      if (!isMissingTable(paidRes.error, 'ram_vendor_payment_status')) {
        return NextResponse.json({ ok: false, error: paidRes.error.message }, { status: 500 })
      }
    }

    const bankByLocId = new Map((banksRes.data || []).map((b) => [Number(b.ram_delivery_location_id), b]))
    const invoiceCountByLocId = new Map()
    for (const inv of invoicesRes.data || []) {
      const id = Number(inv?.ram_delivery_location_id)
      if (!Number.isFinite(id) || id <= 0) continue
      invoiceCountByLocId.set(id, (invoiceCountByLocId.get(id) || 0) + 1)
    }

    const paidByLocId = new Map()
    for (const p of paidRes?.data || []) {
      const id = Number(p?.ram_delivery_location_id)
      if (!Number.isFinite(id) || id <= 0) continue
      paidByLocId.set(id, { is_paid: !!p?.is_paid, paid_at: p?.paid_at || null, ram_cycle_id: p?.ram_cycle_id ?? null })
    }

    const out = (locations || []).map((l) => {
      const id = Number(l.id)
      const bank = bankByLocId.get(id) || null
      const paid = paidByLocId.get(id) || { is_paid: false, paid_at: null, ram_cycle_id: cycleId ?? null }
      return {
        id,
        delivery_location: l.delivery_location || '',
        name: l.name || '',
        phone: l.phone || '',
        rep_code: l.rep_code || '',
        is_active: l.is_active !== false,
        bank,
        invoice_count: invoiceCountByLocId.get(id) || 0,
        paid,
      }
    })

    return NextResponse.json({ ok: true, locations: out })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message || 'Internal server error' }, { status: 500 })
  }
}
