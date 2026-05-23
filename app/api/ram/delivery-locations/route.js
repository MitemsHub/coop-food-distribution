import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabaseServer'

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

function isMissingColumn(error, columnName) {
  const msg = `${error?.message || ''} ${error?.details || ''}`.toLowerCase()
  const c = String(columnName || '').toLowerCase()
  if (!msg.includes(c)) return false
  return msg.includes('column') && (msg.includes('does not exist') || msg.includes('could not find'))
}

async function resolveActiveRamCycleId(supabase) {
  const { data: active, error: aErr } = await supabase
    .from('ram_cycles')
    .select('id')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .maybeSingle()
  if (aErr) {
    if (isMissingTable(aErr, 'ram_cycles')) return null
    throw aErr
  }
  if (active?.id) return active.id
  const { data: latest, error: lErr } = await supabase.from('ram_cycles').select('id').order('created_at', { ascending: false }).maybeSingle()
  if (lErr) {
    if (isMissingTable(lErr, 'ram_cycles')) return null
    throw lErr
  }
  return latest?.id || null
}

export async function GET() {
  try {
    const supabase = createClient()

    const { data, error } = await supabase
      .from('ram_delivery_locations')
      .select('id,delivery_location,name,phone,address,is_active,sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('delivery_location', { ascending: true })

    if (error) {
      const tableMissing = isMissingTable(error, 'ram_delivery_locations')
      if (tableMissing) return NextResponse.json({ ok: true, locations: [], tableMissing: true })
      const deliveryLocationMissing = isMissingColumn(error, 'delivery_location')
      if (!deliveryLocationMissing) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

      const legacy = await supabase
        .from('ram_delivery_locations')
        .select('id,name,phone,address,is_active,sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true })

      if (legacy.error) return NextResponse.json({ ok: false, error: legacy.error.message }, { status: 500 })

      const locations = (legacy.data || []).map((l) => ({
        ...l,
        delivery_location: l.name || '',
      }))

      return NextResponse.json({ ok: true, locations, tableMissing: false })
    }

    let locations = (data || []).map((l) => ({ ...l, delivery_location: l.delivery_location || l.name || '' }))

    const cycleId = await resolveActiveRamCycleId(supabase).catch(() => null)
    if (cycleId) {
      const { data: rows, error: cErr } = await supabase
        .from('ram_cycle_delivery_locations')
        .select('ram_delivery_location_id,is_active')
        .eq('ram_cycle_id', cycleId)
        .eq('is_active', true)
      if (cErr) {
        if (!isMissingTable(cErr, 'ram_cycle_delivery_locations')) {
          return NextResponse.json({ ok: false, error: cErr.message }, { status: 500 })
        }
      } else {
        const allowed = new Set((rows || []).map((r) => Number(r.ram_delivery_location_id)).filter((n) => Number.isFinite(n) && n > 0))
        locations = locations.filter((l) => allowed.has(Number(l.id)))
      }
    }

    return NextResponse.json({ ok: true, locations, tableMissing: false })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message || 'Unknown error' }, { status: 500 })
  }
}
