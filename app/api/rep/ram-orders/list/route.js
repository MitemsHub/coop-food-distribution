import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabaseServer'
import { verify } from '@/lib/signing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function asInt(value, fallback) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

function getLoanInterest(order) {
  return Number(order?.loan_interest ?? order?.interest_amount ?? 0)
}

export async function GET(req) {
  try {
    const supabase = createClient()
    const token = req.cookies.get('rep_token')?.value
    const claim = token && verify(token)
    if (!claim || claim.role !== 'rep') return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
    if (claim.module && claim.module !== 'ram') return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
    const vendorLocationId = Number(claim.ram_delivery_location_id)
    if (!Number.isFinite(vendorLocationId) || vendorLocationId <= 0) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const payment = (searchParams.get('payment') || '').trim()
    const memberId = (searchParams.get('member_id') || '').trim().toUpperCase()
    const term = (searchParams.get('term') || '').trim()
    const deliveryLocationId = asInt(searchParams.get('delivery_location_id'), null)
    const from = (searchParams.get('from') || '').trim()
    const to = (searchParams.get('to') || '').trim()
    const limit = Math.min(Math.max(asInt(searchParams.get('limit'), 300), 1), 1000)

    const allowedPayment = new Set(['Cash', 'Loan', 'Savings'])

    let query = supabase
      .from('ram_orders')
      .select('*')
      .eq('status', 'Approved')
      .eq('ram_delivery_location_id', vendorLocationId)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (payment && allowedPayment.has(payment)) query = query.eq('payment_option', payment)
    if (memberId) query = query.eq('member_id', memberId)
    if (Number.isFinite(deliveryLocationId) && deliveryLocationId > 0) query = query.eq('ram_delivery_location_id', deliveryLocationId)
    if (from) query = query.gte('created_at', from)
    if (to) query = query.lte('created_at', `${to}T23:59:59`)

    const { data: orders, error } = await query
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

    let filtered = orders || []
    if (term) {
      const t = term.toLowerCase()
      filtered = filtered.filter((o) => {
        const idTxt = String(o.id || '')
        const mid = String(o.member_id || '')
        return idTxt.toLowerCase().includes(t) || mid.toLowerCase().includes(t)
      })
    }

    const memberIds = Array.from(new Set(filtered.map((o) => String(o.member_id || '').trim()).filter(Boolean)))
    const locationIds = Array.from(
      new Set(filtered.map((o) => Number(o.ram_delivery_location_id)).filter((n) => Number.isFinite(n) && n > 0))
    )

    const [membersRes, locationsRes] = await Promise.all([
      memberIds.length
        ? supabase.from('members').select('member_id,full_name,branches:branch_id(code,name)').in('member_id', memberIds)
        : Promise.resolve({ data: [], error: null }),
      locationIds.length
        ? supabase.from('ram_delivery_locations').select('id,delivery_location,name,phone,address,is_active').in('id', locationIds)
        : Promise.resolve({ data: [], error: null }),
    ])

    if (membersRes.error) return NextResponse.json({ ok: false, error: membersRes.error.message }, { status: 500 })
    if (locationsRes.error) return NextResponse.json({ ok: false, error: locationsRes.error.message }, { status: 500 })

    const membersById = new Map((membersRes.data || []).map((m) => [String(m.member_id), m]))
    const locationsById = new Map((locationsRes.data || []).map((l) => [Number(l.id), l]))

    const enriched = filtered.map((o) => {
      const m = membersById.get(String(o.member_id)) || null
      const locationId = Number(o.ram_delivery_location_id)
      const loc = Number.isFinite(locationId) ? locationsById.get(locationId) || null : null
      return {
        ...o,
        ram_delivery_location_id: Number.isFinite(locationId) ? locationId : null,
        loan_interest: getLoanInterest(o),
        member: m
          ? {
              member_id: m.member_id,
              full_name: m.full_name,
              branch: m.branches?.code ? { code: m.branches.code, name: m.branches.name || '' } : null,
            }
          : null,
        delivery_location: loc
          ? {
              id: loc.id,
              delivery_location: loc.delivery_location || '',
              name: loc.name || '',
              phone: loc.phone || '',
              address: loc.address || '',
              is_active: loc.is_active,
            }
          : null,
      }
    })

    return NextResponse.json({ ok: true, orders: enriched })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message || 'Internal server error', orders: [] }, { status: 500 })
  }
}
