import { NextResponse } from 'next/server'
import { validateSession, validateNumber } from '@/lib/validation'
import { createClient } from '@/lib/supabaseServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function asIdArray(input) {
  if (Array.isArray(input)) return input
  if (input == null) return []
  return [input]
}

export async function POST(req) {
  try {
    const session = await validateSession(req, 'admin')
    if (!session.valid) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const idsRaw = asIdArray(body.ids ?? body.id)
    const ids = idsRaw
      .map((v) => validateNumber(v, { min: 1, integer: true }))
      .filter((r) => r.isValid)
      .map((r) => r.value)

    if (!ids.length) return NextResponse.json({ ok: false, error: 'Invalid order id(s)' }, { status: 400 })

    const supabase = createClient()

    const { data: rows, error: selErr } = await supabase.from('ram_orders').select('id,status').in('id', ids)
    if (selErr) return NextResponse.json({ ok: false, error: selErr.message }, { status: 500 })

    const allowed = new Set(['Pending', 'Cancelled'])
    const invalid = (rows || []).filter((r) => !allowed.has(String(r.status || ''))).map((r) => r.id)
    if (invalid.length) {
      return NextResponse.json(
        { ok: false, error: `Only Pending or Cancelled orders can be deleted. Invalid: ${invalid.join(', ')}` },
        { status: 400 }
      )
    }

    const { error: delErr } = await supabase.from('ram_orders').delete().in('id', ids)
    if (delErr) return NextResponse.json({ ok: false, error: delErr.message }, { status: 500 })

    return NextResponse.json({ ok: true, deleted: ids })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message || 'Internal server error' }, { status: 500 })
  }
}
