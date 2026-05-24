import { NextResponse } from 'next/server'
import { createClient } from '../../../../../../lib/supabaseServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req) {
  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    const { orderIds, adminId } = await req.json()
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({ ok: false, error: 'orderIds array is required' }, { status: 400 })
    }

    const { data, error } = await supabase.rpc('post_orders_bulk', {
      p_order_ids: orderIds,
      p_admin: adminId || 'admin@coop',
    })

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
    }

    if (!data || !data.success) {
      return NextResponse.json(
        { ok: false, error: data?.error || 'Bulk post failed', posted: data?.posted || [], failed: data?.failed || [] },
        { status: 400 }
      )
    }

    const posted = data.posted || []
    const failed = data.failed || []

    if (posted.length === 0 && failed.length > 0) {
      const reasonsSummary = failed
        .slice(0, 5)
        .map((f) => `#${f.order_id}: ${f.error}`)
        .join('; ')
      return NextResponse.json(
        { ok: false, error: `No orders posted. ${failed.length} failed: ${reasonsSummary}`, posted, failed },
        { status: 400 }
      )
    }

    return NextResponse.json({ ok: true, posted, failed, message: `Posted ${posted.length} orders, ${failed.length} failed` })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
