import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  try {
    // First, get all delivered order IDs
    const { data: deliveredOrders, error: fetchError } = await supabase
      .from('orders')
      .select('order_id')
      .eq('status', 'Delivered')

    if (fetchError) {
      console.error('Error fetching delivered orders:', fetchError)
      return Response.json({ ok: false, error: fetchError.message }, { status: 500 })
    }

    if (!deliveredOrders || deliveredOrders.length === 0) {
      return Response.json({ 
        ok: true, 
        deletedCount: 0,
        message: 'No delivered orders found to clear'
      })
    }

    const orderIds = deliveredOrders.map(order => order.order_id)

    // First, delete inventory movements for delivered orders
    const { error: movementsError } = await supabase
      .from('inventory_movements')
      .delete()
      .in('order_id', orderIds)

    if (movementsError) {
      console.error('Error deleting inventory movements:', movementsError)
      return Response.json({ ok: false, error: movementsError.message }, { status: 500 })
    }

    // Then, delete order lines for delivered orders
    const { error: linesError } = await supabase
      .from('order_lines')
      .delete()
      .in('order_id', orderIds)

    if (linesError) {
      console.error('Error deleting order lines:', linesError)
      return Response.json({ ok: false, error: linesError.message }, { status: 500 })
    }

    // Delete delivered orders
    const { error: ordersError } = await supabase
      .from('orders')
      .delete()
      .eq('status', 'Delivered')

    if (ordersError) {
      console.error('Error deleting delivered orders:', ordersError)
      return Response.json({ ok: false, error: ordersError.message }, { status: 500 })
    }

    return Response.json({ 
      ok: true, 
      deletedCount: deliveredOrders.length,
      message: 'Delivered orders cleared successfully'
    })
  } catch (error) {
    console.error('Error in clear-delivered:', error)
    return Response.json({ ok: false, error: error.message }, { status: 500 })
  }
}