import { NextResponse } from 'next/server'
import { validateSession } from '@/lib/validation'
import { createClient } from '@/lib/supabaseServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

async function isPaidLocked(supabase, locationId, cycleId) {
  if (!cycleId) return false
  const { data, error } = await supabase
    .from('ram_vendor_payment_status')
    .select('is_paid')
    .eq('ram_delivery_location_id', locationId)
    .eq('ram_cycle_id', cycleId)
    .maybeSingle()
  if (error) {
    if (isMissingTable(error, 'ram_vendor_payment_status')) return false
    throw error
  }
  return !!data?.is_paid
}

function cleanText(v, maxLen = 200) {
  return String(v ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, maxLen)
}

function cleanAccountNumber(v) {
  return String(v ?? '')
    .replace(/\s+/g, '')
    .replace(/[^\d]/g, '')
    .slice(0, 20)
}

function getRepLocationIds(claims) {
  const rawIds = Array.isArray(claims?.ram_delivery_location_ids) ? claims.ram_delivery_location_ids : []
  const ids = rawIds.length ? rawIds : [claims?.ram_delivery_location_id]
  return ids.map((v) => Math.trunc(Number(v))).filter((n) => Number.isFinite(n) && n > 0)
}

export async function POST(req) {
  try {
    const session = await validateSession(req, 'rep')
    if (!session.valid) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    if (session?.claims?.module !== 'ram') return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const locationId = Math.trunc(Number(body?.ram_delivery_location_id || body?.delivery_location_id || 0))
    if (!Number.isFinite(locationId) || locationId <= 0) {
      return NextResponse.json({ ok: false, error: 'delivery_location_id required' }, { status: 400 })
    }

    const allowedIds = new Set(getRepLocationIds(session.claims))
    if (!allowedIds.has(locationId)) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })

    const bankName = cleanText(body?.bank_name, 120)
    const accountName = cleanText(body?.account_name, 120)
    const accountNumber = cleanAccountNumber(body?.account_number)
    if (!bankName || !accountName || !accountNumber) {
      return NextResponse.json({ ok: false, error: 'bank_name, account_name and account_number are required' }, { status: 400 })
    }
    if (accountNumber.length < 8) {
      return NextResponse.json({ ok: false, error: 'account_number looks invalid' }, { status: 400 })
    }

    const supabase = createClient()
    const cycleId = await resolveActiveRamCycleId(supabase).catch(() => null)
    const locked = await isPaidLocked(supabase, locationId, cycleId).catch(() => false)
    if (locked) return NextResponse.json({ ok: false, error: 'Vendor is marked as Paid. Editing is locked.' }, { status: 403 })

    const { error: updErr } = await supabase
      .from('ram_vendor_bank_accounts')
      .update({ is_current: false })
      .eq('ram_delivery_location_id', locationId)
      .eq('is_current', true)
    if (updErr) return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 })

    const { data: inserted, error: insErr } = await supabase
      .from('ram_vendor_bank_accounts')
      .insert({
        ram_delivery_location_id: locationId,
        bank_name: bankName,
        account_name: accountName,
        account_number: accountNumber,
        is_current: true,
        created_by_role: 'rep',
        created_by_code: String(session?.claims?.ram_vendor_code || '').trim() || null,
      })
      .select('id,ram_delivery_location_id,bank_name,account_name,account_number,is_current,created_at,created_by_role,created_by_code')
      .single()

    if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 })

    return NextResponse.json({ ok: true, bank: inserted })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message || 'Internal server error' }, { status: 500 })
  }
}
