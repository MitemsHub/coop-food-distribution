import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabaseServer'
import { verify } from '@/lib/signing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function parseIds(raw) {
  const list = Array.isArray(raw) ? raw : []
  const out = []
  for (const v of list) {
    const n = Number(v)
    if (Number.isFinite(n) && n > 0) out.push(Math.trunc(n))
  }
  return Array.from(new Set(out))
}

export async function POST(req) {
  try {
    const supabase = createClient()
    const token = req.cookies.get('rep_token')?.value
    const claim = token && verify(token)
    if (!claim || claim.role !== 'rep') return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
    if (claim.module && claim.module !== 'ram') return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })

    const rawIds = Array.isArray(claim.ram_delivery_location_ids) ? claim.ram_delivery_location_ids : []
    const allowedLocationIds = (rawIds.length ? rawIds : [claim.ram_delivery_location_id])
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n) && n > 0)
    if (!allowedLocationIds.length) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })

    const body = await req.json().catch(() => ({}))
    const status = String(body.status || '').trim()
    if (status !== 'Delivered') return NextResponse.json({ ok: false, error: 'Invalid status' }, { status: 400 })

    const ids = parseIds(body.ids)
    if (!ids.length) return NextResponse.json({ ok: false, error: 'No order ids provided' }, { status: 400 })

    const { data, error } = await supabase
      .from('ram_orders')
      .update({ status })
      .in('id', ids)
      .eq('status', 'Approved')
      .in('ram_delivery_location_id', allowedLocationIds)
      .select('id,status')

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

    const updated = (data || []).map((r) => ({ id: r.id, status: r.status }))
    return NextResponse.json({ ok: true, updated })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message || 'Internal server error' }, { status: 500 })
  }
}

