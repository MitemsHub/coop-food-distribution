// app/api/branches/list/route.js
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const admin = createClient(supabaseUrl, serviceKey)

export async function GET() {
  try {
    const { data, error } = await admin
      .from('branches')
      .select('code, name')
      .order('name')
    
    if (error) {
      console.error('Error fetching branches:', error)
      return NextResponse.json({ ok: false, error: 'Failed to fetch branches' }, { status: 500 })
    }
    
    return NextResponse.json({ ok: true, branches: data || [] })
  } catch (error) {
    console.error('Branches list error:', error)
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 })
  }
}