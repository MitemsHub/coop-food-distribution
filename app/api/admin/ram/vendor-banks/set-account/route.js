import { NextResponse } from 'next/server'
import { validateSession } from '@/lib/validation'
import { createClient } from '@/lib/supabaseServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

function isMissingTable(error, tableName) {
  const code = String(error?.code || '')
  if (code === '42P01') return true
  const msg = `${error?.message || ''} ${error?.details || ''}`.toLowerCase()
  const t = String(tableName || '').toLowerCase()
  if (!msg.includes(t)) return false
  return msg.includes('does not exist') || msg.includes('could not find the table')
}

function isMissingColumn(error, columnName) {
  const msg = `${error?.message || ''} ${error?.details || ''}`.toLowerCase()
  const c = String(columnName || '').toLowerCase()
  if (!msg.includes(c)) return false
  return msg.includes('column') && (msg.includes('does not exist') || msg.includes('could not find'))
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

async function hasColumn(supabase, tableName, columnName) {
  const { error } = await supabase.from(tableName).select(columnName).limit(1)
  if (!error) return true
  if (isMissingTable(error, tableName)) return false
  if (isMissingColumn(error, columnName)) return false
  throw error
}

export async function POST(req) {
  try {
    const session = await validateSession(req, 'admin')
    if (!session.valid) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const locationId = Math.trunc(Number(body?.ram_delivery_location_id || body?.delivery_location_id || 0))
    if (!Number.isFinite(locationId) || locationId <= 0) {
      return NextResponse.json({ ok: false, error: 'delivery_location_id required' }, { status: 400 })
    }

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
    const cycleIdRaw = Math.trunc(Number(body?.ram_cycle_id || body?.cycle_id || 0))
    const cycleId = Number.isFinite(cycleIdRaw) && cycleIdRaw > 0 ? cycleIdRaw : await resolveActiveRamCycleId(supabase).catch(() => null)
    const bankHasCycle = await hasColumn(supabase, 'ram_vendor_bank_accounts', 'ram_cycle_id').catch(() => false)

    let updQ = supabase
      .from('ram_vendor_bank_accounts')
      .update({ is_current: false })
      .eq('ram_delivery_location_id', locationId)
      .eq('is_current', true)
    if (bankHasCycle && cycleId) updQ = updQ.eq('ram_cycle_id', cycleId)
    const { error: updErr } = await updQ
    if (updErr) return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 })

    const { data: inserted, error: insErr } = await supabase
      .from('ram_vendor_bank_accounts')
      .insert({
        ram_delivery_location_id: locationId,
        ...(bankHasCycle ? { ram_cycle_id: cycleId } : {}),
        bank_name: bankName,
        account_name: accountName,
        account_number: accountNumber,
        is_current: true,
        created_by_role: 'admin',
        created_by_code: null,
      })
      .select('id,ram_delivery_location_id,ram_cycle_id,bank_name,account_name,account_number,is_current,created_at,created_by_role,created_by_code')
      .single()

    if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 })

    return NextResponse.json({ ok: true, bank: inserted })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message || 'Internal server error' }, { status: 500 })
  }
}
