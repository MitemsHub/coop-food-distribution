import { NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabaseServer'
import { sign } from '@/lib/signingEdge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isMissingTable(error, tableName) {
  const code = String(error?.code || '')
  if (code === '42P01') return true
  const msg = `${error?.message || ''} ${error?.details || ''}`.toLowerCase()
  const t = String(tableName || '').toLowerCase()
  if (!msg.includes(t)) return false
  return msg.includes('does not exist') || msg.includes('could not find the table')
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set('rep_token', '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 })
  return res
}

export async function POST(req) {
  try {
    const supabase = createClient()
    const body = await req.json().catch(() => ({}))
    const portalModule = String(body?.module || 'food').toLowerCase() === 'ram' ? 'ram' : 'food'
    const code = String(body?.passcode || body?.branchCode || '').trim().toUpperCase()
    if (!code) return NextResponse.json({ ok:false, error:'passcode required' }, { status:400 })

    if (portalModule === 'ram') {
      const { data: vendors, error } = await supabase
        .from('ram_delivery_locations')
        .select('id, delivery_location, name, rep_code, is_active')
        .eq('rep_code', code)
        .eq('is_active', true)
        .order('id', { ascending: true })
      if (error && isMissingTable(error, 'ram_delivery_locations')) {
        return NextResponse.json(
          { ok: false, error: 'Ram Sales vendors are not set up yet. Run the ram sales migration in Supabase.' },
          { status: 500 }
        )
      }
      if (error) return NextResponse.json({ ok: false, error: error.message || 'Invalid passcode' }, { status: 401 })
      const list = Array.isArray(vendors) ? vendors.filter((v) => v && v.id) : []
      if (!list.length) return NextResponse.json({ ok: false, error: 'Invalid passcode' }, { status: 401 })
      const ids = list.map((v) => Number(v.id)).filter((n) => Number.isFinite(n) && n > 0)
      const first = list[0]

      const token = await sign(
        {
          role: 'rep',
          module: 'ram',
          ram_delivery_location_id: first.id,
          ram_delivery_location_ids: ids,
          ram_vendor_code: code,
        },
        60 * 60 * 8
      )
      const res = NextResponse.json({
        ok: true,
        module: 'ram',
        vendor: {
          id: first.id,
          ids,
          name: first.delivery_location || first.name || '',
          code,
        },
      })
      res.cookies.set('rep_token', token, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 8 })
      return res
    }

    const { data: br, error } = await supabase.from('branches').select('id, code, name').eq('code', code).single()
    if (error || !br) return NextResponse.json({ ok:false, error:'Invalid passcode' }, { status:401 })

    const token = await sign({ role: 'rep', module: 'food', branch_id: br.id, branch_code: br.code }, 60 * 60 * 8) // 8h
    const res = NextResponse.json({ ok:true, module: 'food', branch: br })
    res.cookies.set('rep_token', token, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60*60*8 })
    return res
  } catch (e) {
    return NextResponse.json({ ok:false, error:e.message }, { status:500 })
  }
}
