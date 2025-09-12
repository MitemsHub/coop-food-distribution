import { NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabaseServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req) {
  try {
    const supabase = createClient()
    const { orderIds, adminId } = await req.json()
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({ ok: false, error: 'orderIds must be a non-empty array' }, { status: 400 })
    }

    const results = []
    for (const id of orderIds) {
      const { error } = await supabase.rpc('deliver_order', { p_order_id: id, p_admin: adminId || 'admin' })
      results.push({ id, ok: !error, error: error?.message || null })
    }
    const failed = results.filter(r => !r.ok)
    return NextResponse.json({ ok: failed.length === 0, delivered: results.filter(r => r.ok).map(r => r.id), failed })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}