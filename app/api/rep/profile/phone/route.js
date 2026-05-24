import { NextResponse } from 'next/server'
import { validateSession } from '@/lib/validation'
import { createClient } from '@/lib/supabaseServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function cleanPhone(v) {
  const raw = String(v ?? '').trim()
  if (!raw) return ''
  const cleaned = raw.replace(/[^\d+()\-\s]/g, '').replace(/\s+/g, ' ')
  return cleaned.slice(0, 30)
}

export async function GET(req) {
  try {
    const session = await validateSession(req, 'rep')
    if (!session.valid) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    if (session?.claims?.module && session.claims.module !== 'food') {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    const branchId = Number(session?.claims?.branch_id)
    if (!Number.isFinite(branchId) || branchId <= 0) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })

    const supabase = createClient()
    const { data, error } = await supabase.from('branches').select('id,code,name,rep_phone').eq('id', branchId).maybeSingle()
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    if (!data?.id) return NextResponse.json({ ok: false, error: 'Branch not found' }, { status: 404 })

    return NextResponse.json({
      ok: true,
      branch: { id: data.id, code: data.code || '', name: data.name || '' },
      rep_phone: String(data.rep_phone || ''),
    })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e?.message || 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req) {
  try {
    const session = await validateSession(req, 'rep')
    if (!session.valid) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    if (session?.claims?.module && session.claims.module !== 'food') {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    const branchId = Number(session?.claims?.branch_id)
    if (!Number.isFinite(branchId) || branchId <= 0) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })

    const body = await req.json().catch(() => ({}))
    const phone = cleanPhone(body?.rep_phone ?? body?.phone)

    const supabase = createClient()
    const { data, error } = await supabase
      .from('branches')
      .update({ rep_phone: phone })
      .eq('id', branchId)
      .select('id,code,name,rep_phone')
      .maybeSingle()
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    if (!data?.id) return NextResponse.json({ ok: false, error: 'Branch not found' }, { status: 404 })

    return NextResponse.json({ ok: true, rep_phone: String(data.rep_phone || '') })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e?.message || 'Internal server error' }, { status: 500 })
  }
}

