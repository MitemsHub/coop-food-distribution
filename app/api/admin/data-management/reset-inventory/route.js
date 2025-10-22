import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  try {
    // First get all branch_item_prices to count them
    const { data: branchItems, error: fetchError } = await supabase
      .from('branch_item_prices')
      .select('id')

    if (fetchError) {
      console.error('Error fetching branch items:', fetchError)
      return Response.json({ ok: false, error: fetchError.message }, { status: 500 })
    }

    if (!branchItems || branchItems.length === 0) {
      return Response.json({ 
        ok: true, 
        updatedCount: 0,
        message: 'No inventory items found to reset'
      })
    }

    // Reset inventory by clearing all inventory movements (stock is derived from movements)
    const { error: movementsError } = await supabase
      .from('inventory_movements')
      .delete()
      .neq('id', 0)

    if (movementsError) {
      console.error('Error clearing inventory movements:', movementsError)
      return Response.json({ ok: false, error: movementsError.message }, { status: 500 })
    }

    return Response.json({ 
      ok: true, 
      updatedCount: branchItems.length,
      message: 'Inventory quantities reset to zero successfully'
    })
  } catch (error) {
    console.error('Error in reset-inventory:', error)
    return Response.json({ ok: false, error: error.message }, { status: 500 })
  }
}