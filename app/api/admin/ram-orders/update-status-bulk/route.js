import { NextResponse } from 'next/server'
import { validateNumber, validateSession } from '@/lib/validation'
import { createClient } from '@/lib/supabaseServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req) {
  try {
    const session = await validateSession(req, 'admin')
    if (!session.valid) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const ids = Array.isArray(body.ids) ? body.ids : []
    const status = String(body.status || '').trim()

    const allowedStatus = new Set(['Pending', 'Approved', 'Cancelled'])
    if (!allowedStatus.has(status)) {
      return NextResponse.json({ ok: false, error: 'Invalid status' }, { status: 400 })
    }

    if (!ids.length) {
      return NextResponse.json({ ok: false, error: 'No order ids provided' }, { status: 400 })
    }

    const parsedIds = []
    for (const raw of ids) {
      const idRes = validateNumber(raw, { min: 1, integer: true })
      if (idRes.isValid) parsedIds.push(idRes.value)
    }

    if (!parsedIds.length) {
      return NextResponse.json({ ok: false, error: 'No valid order ids provided' }, { status: 400 })
    }

    const supabase = createClient()
    const { data, error } = await supabase
      .from('ram_orders')
      .update({ status })
      .in('id', parsedIds)
      .select('id,status')

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

    return NextResponse.json({
      ok: true,
      updated: (data || []).map((r) => ({ id: r.id, status: r.status })),
    })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message || 'Internal server error' }, { status: 500 })
  }
}
