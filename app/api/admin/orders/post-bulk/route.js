// app/api/admin/orders/post-bulk/route.js
import { NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabaseServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req) {
  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    const { orderIds, adminId } = await req.json()
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({ ok: false, error: 'orderIds array is required' }, { status: 400 })
    }

    // Use optimized bulk RPC function
    const { data, error } = await supabase.rpc('post_orders_bulk', { 
      p_order_ids: orderIds, 
      p_admin: adminId || 'admin@coop' 
    })
    
    console.log('Bulk post RPC result:', { orderIds: orderIds.length, data, error })
    
    if (error) {
      console.error('Bulk post RPC error:', error)
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
    }
    
    if (!data || !data.success) {
      console.error('Bulk post RPC failed:', data)
      return NextResponse.json({ 
        ok: false, 
        error: data?.error || 'Bulk post failed',
        posted: data?.posted || [],
        failed: data?.failed || []
      }, { status: 400 })
    }

    // Extract results from RPC response
    const posted = data.posted || []
    const failed = data.failed || []

    return NextResponse.json({ 
      ok: true, 
      posted, 
      failed,
      message: `Posted ${posted.length} orders, ${failed.length} failed`
    })
  } catch (e) {
    console.error('Bulk post error:', e)
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}