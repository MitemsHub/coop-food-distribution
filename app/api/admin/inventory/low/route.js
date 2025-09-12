import { NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabaseServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req) {
  try {
    const supabase = createClient()
    const th = Number(new URL(req.url).searchParams.get('threshold') || 20)
    const { data, error } = await supabase
      .from('v_inventory_status')
      .select('*')
      .lte('remaining_after_posted', th)
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok:true, count: data?.length || 0, rows: data || [] })
  } catch (e) {
    return NextResponse.json({ ok:false, error:e.message }, { status:500 })
  }
}