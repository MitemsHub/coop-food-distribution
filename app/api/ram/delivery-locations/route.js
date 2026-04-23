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

    const locations = (data || []).map((l) => ({ ...l, delivery_location: l.delivery_location || l.name || '' }))
    return NextResponse.json({ ok: true, locations, tableMissing: false })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message || 'Unknown error' }, { status: 500 })
  }
}
