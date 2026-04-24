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
      const { data: vendor, error } = await supabase
        .from('ram_delivery_locations')
        .select('id, delivery_location, name, rep_code, is_active')
        .eq('rep_code', code)
        .eq('is_active', true)
        .single()
      if (error && isMissingTable(error, 'ram_delivery_locations')) {
        return NextResponse.json(
          { ok: false, error: 'Ram Sales vendors are not set up yet. Run the ram sales migration in Supabase.' },
          { status: 500 }
        )
      }
      if (error || !vendor) return NextResponse.json({ ok: false, error: 'Invalid passcode' }, { status: 401 })

      const token = await sign(
        {
          role: 'rep',
          module: 'ram',
          ram_delivery_location_id: vendor.id,
          ram_vendor_code: vendor.rep_code,
        },
        60 * 60 * 8
      )
      const res = NextResponse.json({
        ok: true,
        module: 'ram',
        vendor: { id: vendor.id, name: vendor.name || vendor.delivery_location || '', code: vendor.rep_code },
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
