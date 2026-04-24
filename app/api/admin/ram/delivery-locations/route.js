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

export async function GET(req) {
  try {
    const session = await validateSession(req, 'admin')
    if (!session.valid) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const supabase = createClient()
    const { data, error } = await supabase
      .from('ram_delivery_locations')
      .select('id,delivery_location,name,phone,address,rep_code,is_active,sort_order,created_at')
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('delivery_location', { ascending: true })

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, locations: data || [] })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message || 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req) {
  try {
    const session = await validateSession(req, 'admin')
    if (!session.valid) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
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

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
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
      return NextResponse.json({ ok: false, error: 'No updates provided' }, { status: 400 })
    }

    const supabase = createClient()
    const { data, error } = await supabase
      .from('ram_delivery_locations')
      .update(updates)
      .eq('id', idRes.value)
      .select('id,delivery_location,name,phone,address,rep_code,is_active,sort_order,created_at')
      .single()

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 })

    return NextResponse.json({ ok: true, location: data })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message || 'Internal server error' }, { status: 500 })
  }
}
