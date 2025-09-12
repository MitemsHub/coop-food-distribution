// app/api/branches/list/route.js
import { NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabaseServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
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