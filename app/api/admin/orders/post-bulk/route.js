// app/api/admin/orders/post-bulk/route.js
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const admin = createClient(url, key)

export async function POST(req) {
  try {
    const { orderIds, adminId } = await req.json()
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({ ok: false, error: 'orderIds must be a non-empty array' }, { status: 400 })
    }

    const results = []
    for (const id of orderIds) {
      const { error } = await admin.rpc('post_order', { p_order_id: id, p_admin: adminId || 'admin' })
      results.push({ id, ok: !error, error: error?.message || null })
    }

    const failed = results.filter(r => !r.ok)
    return NextResponse.json({
      ok: failed.length === 0,
      posted: results.filter(r => r.ok).map(r => r.id),
      failed
    })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}