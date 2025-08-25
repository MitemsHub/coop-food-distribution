import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sign } from '@/lib/signing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const admin = createClient(url, key)

export async function POST(req) {
  try {
    const { passcode } = await req.json()
    const code = (passcode || '').trim().toUpperCase()
    if (!code) return NextResponse.json({ ok:false, error:'passcode required' }, { status:400 })

    const { data: br, error } = await admin.from('branches').select('id, code, name').eq('code', code).single()
    if (error || !br) return NextResponse.json({ ok:false, error:'Invalid passcode' }, { status:401 })

    const token = sign({ role: 'rep', branch_id: br.id, branch_code: br.code }, 60 * 60 * 8) // 8h
    const res = NextResponse.json({ ok:true, branch: br })
    res.cookies.set('rep_token', token, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60*60*8 })
    return res
  } catch (e) {
    return NextResponse.json({ ok:false, error:e.message }, { status:500 })
  }
}