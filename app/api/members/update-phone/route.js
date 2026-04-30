import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabaseServer'
import { sanitizeString, validateMemberId } from '@/lib/validation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function sanitizePhone(phoneRaw) {
  const phone = sanitizeString(String(phoneRaw || ''), { maxLength: 50, encodeHtml: false })
  const cleaned = phone.replace(/\s+/g, ' ').trim()
  if (!cleaned) return { ok: false, value: '', error: 'Phone number is required' }
  if (!/^[0-9+\-\s()]{7,20}$/.test(cleaned)) return { ok: false, value: '', error: 'Invalid phone number format' }
  return { ok: true, value: cleaned }
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}))
    const memberIdRes = validateMemberId(String(body.member_id || body.memberId || ''))
    if (!memberIdRes.isValid) return NextResponse.json({ ok: false, error: memberIdRes.error }, { status: 400 })

    const phoneRes = sanitizePhone(body.phone)
    if (!phoneRes.ok) return NextResponse.json({ ok: false, error: phoneRes.error }, { status: 400 })

    const memberId = memberIdRes.sanitized.toUpperCase()
    const supabase = createClient()

    const { data: member, error: mErr } = await supabase.from('members').select('member_id,phone').eq('member_id', memberId).single()
    if (mErr || !member) return NextResponse.json({ ok: false, error: 'Member not found' }, { status: 404 })

    const currentPhone = String(member.phone || '').trim()
    if (currentPhone) {
      return NextResponse.json({ ok: false, error: 'Phone number is already set' }, { status: 400 })
    }

    const { data: updated, error: uErr } = await supabase
      .from('members')
      .update({ phone: phoneRes.value })
      .eq('member_id', memberId)
      .select('member_id,phone')
      .single()

    if (uErr) return NextResponse.json({ ok: false, error: uErr.message }, { status: 500 })

    return NextResponse.json({ ok: true, member: updated })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message || 'Internal server error' }, { status: 500 })
  }
}
