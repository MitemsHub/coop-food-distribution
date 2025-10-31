import { NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabaseServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req) {
  try {
    const supabase = createClient()
    const { memberId, departmentName } = await req.json()

    const mid = String(memberId || '').trim().toUpperCase()
    const name = String(departmentName || '').trim()
    if (!mid || !name) {
      return NextResponse.json({ ok:false, error:'memberId and departmentName are required' }, { status:400 })
    }

    // Resolve department id by name
    const { data: dept, error: deptErr } = await supabase
      .from('departments')
      .select('id, name')
      .eq('name', name)
      .single()
    if (deptErr || !dept) return NextResponse.json({ ok:false, error:'Department not found' }, { status:404 })

    // Verify member exists
    const { data: mb, error: mbErr } = await supabase
      .from('members')
      .select('member_id, department_id')
      .eq('member_id', mid)
      .single()
    if (mbErr || !mb) return NextResponse.json({ ok:false, error:'Member not found' }, { status:404 })

    // Update member department
    const { error: upErr } = await supabase
      .from('members')
      .update({ department_id: dept.id })
      .eq('member_id', mid)
    if (upErr) return NextResponse.json({ ok:false, error: upErr.message }, { status:500 })

    return NextResponse.json({ ok:true, member_id: mid, department: { name: dept.name } })
  } catch (e) {
    return NextResponse.json({ ok:false, error: e.message }, { status:500 })
  }
}