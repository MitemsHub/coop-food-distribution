import { NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabaseServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req) {
  try {
    const supabase = createClient()
    const { memberId, branchCode } = await req.json()

    const mid = String(memberId || '').trim().toUpperCase()
    const code = String(branchCode || '').trim().toUpperCase()
    if (!mid || !code) {
      return NextResponse.json({ ok:false, error:'memberId and branchCode are required' }, { status:400 })
    }

    // Resolve branch id
    const { data: br, error: brErr } = await supabase
      .from('branches')
      .select('id, code, name')
      .eq('code', code)
      .single()
    if (brErr || !br) return NextResponse.json({ ok:false, error:'Branch not found' }, { status:404 })

    // Verify member exists
    const { data: mb, error: mbErr } = await supabase
      .from('members')
      .select('member_id, branch_id')
      .eq('member_id', mid)
      .single()
    if (mbErr || !mb) return NextResponse.json({ ok:false, error:'Member not found' }, { status:404 })

    // Update member home/reporting branch
    const { error: upErr } = await supabase
      .from('members')
      .update({ branch_id: br.id })
      .eq('member_id', mid)
    if (upErr) return NextResponse.json({ ok:false, error: upErr.message }, { status:500 })

    return NextResponse.json({ ok:true, member_id: mid, branch: { code: br.code, name: br.name } })
  } catch (e) {
    return NextResponse.json({ ok:false, error: e.message }, { status:500 })
  }
}