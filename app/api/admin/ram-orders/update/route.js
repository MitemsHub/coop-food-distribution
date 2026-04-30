import { NextResponse } from 'next/server'
import { validateSession, validateNumber } from '@/lib/validation'
import { createClient } from '@/lib/supabaseServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const LOAN_INTEREST_RATE = 0.06

function normalizeGrade(grade) {
  return String(grade || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function isPensionerGrade(grade) {
  const g = normalizeGrade(grade)
  if (!g) return false
  return g.includes('pensioner')
}

export async function POST(req) {
  try {
    const session = await validateSession(req, 'admin')
    if (!session.valid) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const idRes = validateNumber(body.id, { min: 1, integer: true })
    if (!idRes.isValid) return NextResponse.json({ ok: false, error: 'Invalid order id' }, { status: 400 })

    const qtyRes = validateNumber(body.qty, { min: 1, max: 1000, integer: true })
    if (!qtyRes.isValid) return NextResponse.json({ ok: false, error: 'Invalid quantity' }, { status: 400 })

    const locRes = validateNumber(body.delivery_location_id, { min: 1, integer: true })
    if (!locRes.isValid) return NextResponse.json({ ok: false, error: 'Invalid delivery location' }, { status: 400 })

    const hasUnitPrice = body.unit_price !== undefined && body.unit_price !== null && String(body.unit_price).trim() !== ''
    const unitPriceRes = hasUnitPrice ? validateNumber(body.unit_price, { min: 1, max: 100000000 }) : { isValid: true, value: null }
    if (!unitPriceRes.isValid) return NextResponse.json({ ok: false, error: 'Invalid unit price' }, { status: 400 })

    const supabase = createClient()

    const { data: order, error: selErr } = await supabase
      .from('ram_orders')
      .select('id,status,payment_option,unit_price,member_grade')
      .eq('id', idRes.value)
      .single()

    if (selErr || !order) return NextResponse.json({ ok: false, error: 'Order not found' }, { status: 404 })

    const editable = new Set(['Pending'])
    if (!editable.has(String(order.status || ''))) {
      return NextResponse.json({ ok: false, error: 'Only Pending orders can be edited' }, { status: 400 })
    }

    const payment = String(order.payment_option || '').trim()
    if (payment === 'Loan') {
      const cap = isPensionerGrade(order.member_grade) ? 1 : 2
      if (qtyRes.value > cap) {
        return NextResponse.json({ ok: false, error: `Maximum allowed is ${cap} ram(s) for Loan` }, { status: 400 })
      }
    }

    const { data: loc, error: locErr } = await supabase
      .from('ram_delivery_locations')
      .select('id,is_active')
      .eq('id', locRes.value)
      .single()

    if (locErr) return NextResponse.json({ ok: false, error: locErr.message }, { status: 500 })
    if (!loc) return NextResponse.json({ ok: false, error: 'Delivery location not found' }, { status: 404 })
    if (loc.is_active === false) return NextResponse.json({ ok: false, error: 'Delivery location is not active' }, { status: 400 })

    const unitPrice = hasUnitPrice ? Number(unitPriceRes.value || 0) : Number(order.unit_price || 0)
    const principalAmount = unitPrice * qtyRes.value
    const interestAmount = payment === 'Loan' ? Math.round(principalAmount * LOAN_INTEREST_RATE) : 0
    const totalAmount = principalAmount + interestAmount

    const { data: updated, error: updErr } = await supabase
      .from('ram_orders')
      .update({
        qty: qtyRes.value,
        unit_price: unitPrice,
        principal_amount: principalAmount,
        interest_amount: interestAmount,
        total_amount: totalAmount,
        ram_delivery_location_id: locRes.value,
      })
      .eq('id', idRes.value)
      .select('*')
      .single()

    if (updErr) return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 })
    if (!updated) return NextResponse.json({ ok: false, error: 'Update failed' }, { status: 500 })

    return NextResponse.json({ ok: true, order: updated })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message || 'Internal server error' }, { status: 500 })
  }
}
