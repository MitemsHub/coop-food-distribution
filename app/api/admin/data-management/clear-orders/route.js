import { createClient } from '../../../../../lib/supabaseServer'
import { validateSession } from '../../../../../lib/validation'

export async function POST(request) {
  try {
    const session = await validateSession(request, 'admin')
    if (!session.valid) {
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient()
    const body = await request.json().catch(() => ({}))

    const hasColumn = async (table, column) => {
      const { error } = await supabase.from(table).select(column).limit(1)
      return !error
    }

    const ordersHasCycle = await hasColumn('orders', 'cycle_id')
    const movementsHasCycle = await hasColumn('inventory_movements', 'cycle_id')

    let cycleId = body.cycle_id != null ? Number(body.cycle_id) : null
    if (cycleId != null && !Number.isFinite(cycleId)) {
      return Response.json({ ok: false, error: 'Invalid cycle_id' }, { status: 400 })
    }

    if (!cycleId && ordersHasCycle) {
      const { data: active, error: activeErr } = await supabase
        .from('cycles')
        .select('id')
        .eq('is_active', true)
        .maybeSingle()
      if (activeErr) return Response.json({ ok: false, error: activeErr.message }, { status: 500 })
      if (!active?.id) return Response.json({ ok: false, error: 'No active cycle found' }, { status: 400 })
      cycleId = active.id
    }

    if (movementsHasCycle && cycleId) {
      const { error: movementsError } = await supabase
        .from('inventory_movements')
        .delete()
        .eq('cycle_id', cycleId)

      if (movementsError) {
        console.error('Error deleting inventory movements:', movementsError)
        return Response.json({ ok: false, error: movementsError.message }, { status: 500 })
      }
    }

    let ordersToDelete = []
    if (ordersHasCycle && cycleId) {
      const { data: orderRows, error: fetchErr } = await supabase
        .from('orders')
        .select('order_id')
        .eq('cycle_id', cycleId)
      if (fetchErr) return Response.json({ ok: false, error: fetchErr.message }, { status: 500 })
      ordersToDelete = (orderRows || []).map(o => o.order_id)
    } else {
      const { data: orderRows, error: fetchErr } = await supabase
        .from('orders')
        .select('order_id')
        .gt('order_id', 0)
      if (fetchErr) return Response.json({ ok: false, error: fetchErr.message }, { status: 500 })
      ordersToDelete = (orderRows || []).map(o => o.order_id)
    }

    const chunkSize = 500
    for (let i = 0; i < ordersToDelete.length; i += chunkSize) {
      const chunk = ordersToDelete.slice(i, i + chunkSize)
      const { error: linesError } = await supabase
        .from('order_lines')
        .delete()
        .in('order_id', chunk)
      if (linesError) {
        console.error('Error deleting order lines:', linesError)
        return Response.json({ ok: false, error: linesError.message }, { status: 500 })
      }
    }

    let ordersDeleteQuery = supabase.from('orders').delete().select('order_id')
    if (ordersHasCycle && cycleId) ordersDeleteQuery = ordersDeleteQuery.eq('cycle_id', cycleId)
    else ordersDeleteQuery = ordersDeleteQuery.gt('order_id', 0)
    const { data, error: ordersError } = await ordersDeleteQuery

    if (ordersError) {
      console.error('Error deleting orders:', ordersError)
      return Response.json({ ok: false, error: ordersError.message }, { status: 500 })
    }

    return Response.json({ 
      ok: true, 
      deletedCount: data?.length || 0,
      message: cycleId ? `Orders cleared for cycle_id=${cycleId}` : 'All orders cleared successfully'
    })
  } catch (error) {
    console.error('Error in clear-orders:', error)
    return Response.json({ ok: false, error: error.message }, { status: 500 })
  }
}
