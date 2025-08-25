// app/api/admin/reports/branches/route.js
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const admin = createClient(url, key)

export async function GET() {
  try {
    const { data, error } = await admin
      .from('branches')
      .select('code, name')
      .order('name')
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true, branches: data || [] })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}