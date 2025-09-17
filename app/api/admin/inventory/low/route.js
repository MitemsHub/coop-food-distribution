import { NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabaseServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req) {
  try {
    const supabase = createClient()
    // In demand tracking mode, "low stock" doesn't apply - return empty result
    // Since we're tracking demand, not stock levels
    return NextResponse.json({ 
      ok: true, 
      count: 0, 
      rows: [],
      message: 'Demand tracking mode - no stock levels to monitor'
    })
  } catch (e) {
    return NextResponse.json({ ok:false, error:e.message }, { status:500 })
  }
}