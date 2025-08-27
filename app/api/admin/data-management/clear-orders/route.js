import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  try {
    // First, delete all inventory movements
    const { error: movementsError } = await supabase
      .from('inventory_movements')
      .delete()
      .neq('id', 0) // Delete all records

    if (movementsError) {
      console.error('Error deleting inventory movements:', movementsError)
      return Response.json({ ok: false, error: movementsError.message }, { status: 500 })
    }

    // Then, delete all order lines
    const { error: linesError } = await supabase
      .from('order_lines')
      .delete()
      .neq('id', 0) // Delete all records

    if (linesError) {
      console.error('Error deleting order lines:', linesError)
      return Response.json({ ok: false, error: linesError.message }, { status: 500 })
    }

    // Finally, delete all orders
    const { data, error: ordersError } = await supabase
      .from('orders')
      .delete()
      .gt('order_id', 0)
      .select('order_id')

    if (ordersError) {
      console.error('Error deleting orders:', ordersError)
      return Response.json({ ok: false, error: ordersError.message }, { status: 500 })
    }

    return Response.json({ 
      ok: true, 
      deletedCount: data?.length || 0,
      message: 'All orders and order lines cleared successfully'
    })
  } catch (error) {
    console.error('Error in clear-orders:', error)
    return Response.json({ ok: false, error: error.message }, { status: 500 })
  }
}