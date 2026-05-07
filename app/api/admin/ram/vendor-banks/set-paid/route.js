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

export async function POST(req) {
  try {
    const session = await validateSession(req, 'admin')
    if (!session.valid) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const locationId = Math.trunc(Number(body?.delivery_location_id || body?.ram_delivery_location_id || 0))
    if (!Number.isFinite(locationId) || locationId <= 0) {
      return NextResponse.json({ ok: false, error: 'delivery_location_id required' }, { status: 400 })
    }

    const isPaid = body?.is_paid === true || body?.is_paid === 'true' || body?.is_paid === 1 || body?.is_paid === '1'

    const supabase = createClient()
    const cycleId = await resolveActiveRamCycleId(supabase)
    if (!cycleId) return NextResponse.json({ ok: false, error: 'No active Ram cycle found' }, { status: 400 })

    const nowIso = new Date().toISOString()
    const payload = {
      ram_delivery_location_id: locationId,
      ram_cycle_id: cycleId,
      is_paid: isPaid,
      paid_at: isPaid ? nowIso : null,
      paid_by_role: 'admin',
      paid_by_code: null,
      updated_at: nowIso,
    }

    const { data, error } = await supabase
      .from('ram_vendor_payment_status')
      .upsert(payload, { onConflict: 'ram_delivery_location_id,ram_cycle_id' })
      .select('ram_delivery_location_id,ram_cycle_id,is_paid,paid_at')
      .single()

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, paid: data })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message || 'Internal server error' }, { status: 500 })
  }
}

