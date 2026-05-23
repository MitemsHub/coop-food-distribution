import { NextResponse } from 'next/server'
import { sanitizeString, validateNumber, validateSession } from '@/lib/validation'
import { createClient } from '@/lib/supabaseServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function normalizeBody(body) {
  const delivery_location = sanitizeString(body.delivery_location || '', { maxLength: 120, encodeHtml: false })
  const name = sanitizeString(body.name || '', { maxLength: 120, encodeHtml: false })
  const phone = sanitizeString(body.phone || '', { maxLength: 60, encodeHtml: false })
  const address = sanitizeString(body.address || '', { maxLength: 300, encodeHtml: false })
  const repCodeRaw = sanitizeString(body.rep_code || '', { maxLength: 40, encodeHtml: false })
  const rep_code = repCodeRaw ? repCodeRaw.toUpperCase() : null
  const is_active = body.is_active === false ? false : true
  const sortOrderRes = body.sort_order === undefined ? { isValid: true, value: null } : validateNumber(body.sort_order, { integer: true })
  return { delivery_location, name, phone, address, rep_code, is_active, sort_order: sortOrderRes.isValid ? sortOrderRes.value : null }
}

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
    const cycleParam = asInt(searchParams.get('cycle_id') || searchParams.get('ram_cycle_id'), null)
    const cycleId = Number.isFinite(cycleParam) && cycleParam != null && cycleParam > 0 ? cycleParam : await resolveActiveRamCycleId(supabase).catch(() => null)
    const { data, error } = await supabase
      .from('ram_delivery_locations')
      .select('id,delivery_location,name,phone,address,rep_code,is_active,sort_order,created_at')
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('delivery_location', { ascending: true })

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

    const locations = data || []
    if (!Number.isFinite(cycleId) || cycleId == null || cycleId <= 0) return NextResponse.json({ ok: true, locations })

    const { data: cycleRows, error: cErr } = await supabase
      .from('ram_cycle_delivery_locations')
      .select('ram_delivery_location_id,is_active')
      .eq('ram_cycle_id', cycleId)

    if (cErr) {
      if (isMissingTable(cErr, 'ram_cycle_delivery_locations')) return NextResponse.json({ ok: true, locations })
      return NextResponse.json({ ok: false, error: cErr.message }, { status: 500 })
    }

    const activeIds = new Set(
      (cycleRows || [])
        .filter((r) => r?.is_active !== false)
        .map((r) => Number(r.ram_delivery_location_id))
        .filter((n) => Number.isFinite(n) && n > 0)
    )

    const out = locations
      .filter((l) => activeIds.has(Number(l.id)))
      .map((l) => ({
        ...l,
        in_cycle: true,
        cycle_active: true,
      }))

    return NextResponse.json({ ok: true, locations: out })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message || 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req) {
  try {
    const session = await validateSession(req, 'admin')
    if (!session.valid) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const cycleId = asInt(body?.cycle_id || body?.ram_cycle_id, null)
    const payload = normalizeBody(body)
    if (!payload.delivery_location) {
      return NextResponse.json({ ok: false, error: 'delivery_location is required' }, { status: 400 })
    }

    const supabase = createClient()
    const { data, error } = await supabase
      .from('ram_delivery_locations')
      .insert(payload)
      .select('id,delivery_location,name,phone,address,rep_code,is_active,sort_order,created_at')
      .single()

    if (error) {
      const msg = String(error.message || '')
      if (msg.includes('ram_delivery_locations_rep_code_uidx')) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'This passcode is currently restricted to be unique in your database. To allow multiple vendors to share the same passcode, apply the migration: migrations/allow-duplicate-ram-vendor-passcodes.sql',
          },
          { status: 400 }
        )
      }
      return NextResponse.json({ ok: false, error: msg }, { status: 500 })
    }

    if (Number.isFinite(cycleId) && cycleId != null && cycleId > 0) {
      const { error: linkErr } = await supabase
        .from('ram_cycle_delivery_locations')
        .upsert(
          { ram_cycle_id: cycleId, ram_delivery_location_id: data.id, is_active: true },
          { onConflict: 'ram_cycle_id,ram_delivery_location_id' }
        )
      if (linkErr && !isMissingTable(linkErr, 'ram_cycle_delivery_locations')) {
        return NextResponse.json({ ok: false, error: linkErr.message }, { status: 500 })
      }
    }
    return NextResponse.json({ ok: true, location: data })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message || 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req) {
  try {
    const session = await validateSession(req, 'admin')
    if (!session.valid) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const idRes = validateNumber(body.id, { min: 1, integer: true })
    if (!idRes.isValid) return NextResponse.json({ ok: false, error: 'Invalid id' }, { status: 400 })

    const cycleId = asInt(body?.cycle_id || body?.ram_cycle_id, null)
    const wantsCycleUpdate = Number.isFinite(cycleId) && cycleId != null && cycleId > 0 && body.cycle_active !== undefined

    const payload = normalizeBody(body)
    const updates = {}

    if (body.delivery_location !== undefined) updates.delivery_location = payload.delivery_location
    if (body.name !== undefined) updates.name = payload.name
    if (body.phone !== undefined) updates.phone = payload.phone
    if (body.address !== undefined) updates.address = payload.address
    if (body.rep_code !== undefined) updates.rep_code = payload.rep_code
    if (body.is_active !== undefined) updates.is_active = payload.is_active
    if (body.sort_order !== undefined) updates.sort_order = payload.sort_order

    if (!Object.keys(updates).length) {
      if (!wantsCycleUpdate) return NextResponse.json({ ok: false, error: 'No updates provided' }, { status: 400 })
    }

    const supabase = createClient()
    let updatedLocation = null
    if (Object.keys(updates).length) {
      const { data, error } = await supabase
        .from('ram_delivery_locations')
        .update(updates)
        .eq('id', idRes.value)
        .select('id,delivery_location,name,phone,address,rep_code,is_active,sort_order,created_at')
        .single()

      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
      if (!data) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 })
      updatedLocation = data
    } else {
      const { data, error } = await supabase
        .from('ram_delivery_locations')
        .select('id,delivery_location,name,phone,address,rep_code,is_active,sort_order,created_at')
        .eq('id', idRes.value)
        .single()
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
      updatedLocation = data
    }

    if (wantsCycleUpdate) {
      const isActive = body.cycle_active === true || body.cycle_active === 'true' || body.cycle_active === 1 || body.cycle_active === '1'
      const { error: linkErr } = await supabase
        .from('ram_cycle_delivery_locations')
        .upsert(
          { ram_cycle_id: cycleId, ram_delivery_location_id: idRes.value, is_active: isActive },
          { onConflict: 'ram_cycle_id,ram_delivery_location_id' }
        )
      if (linkErr) {
        if (!isMissingTable(linkErr, 'ram_cycle_delivery_locations')) {
          return NextResponse.json({ ok: false, error: linkErr.message }, { status: 500 })
        }
      }
      return NextResponse.json({ ok: true, location: { ...updatedLocation, in_cycle: true, cycle_active: isActive } })
    }

    return NextResponse.json({ ok: true, location: updatedLocation })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message || 'Internal server error' }, { status: 500 })
  }
}
