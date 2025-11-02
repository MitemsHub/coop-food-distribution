// app/api/admin/reports/departments/route.js
import { NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabaseServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('departments')
      .select('id, name')
      .order('name')
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true, departments: data || [] })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}