import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req) {
  try {
    // In demand tracking mode, low stock notifications don't apply
    // Since we're tracking demand, not stock levels
    return NextResponse.json({ 
      ok: true, 
      sent: 0,
      message: 'Demand tracking mode - no stock levels to monitor for alerts'
    })
  } catch (e) {
    return NextResponse.json({ ok:false, error:e.message }, { status:500 })
  }
}