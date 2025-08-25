import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export async function GET(req) {
  try {
    const th = Number(new URL(req.url).searchParams.get('threshold') || 20)
    const { data, error } = await admin
      .from('v_inventory_status')
      .select('*')
      .lte('remaining_after_posted', th)
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok:true, count: data?.length || 0, rows: data || [] })
  } catch (e) {
    return NextResponse.json({ ok:false, error:e.message }, { status:500 })
  }
}