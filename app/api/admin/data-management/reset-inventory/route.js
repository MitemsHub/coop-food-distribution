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

    // Reset initial_stock in branch_item_prices table (this is what the inventory display shows)
    const { data, error } = await supabase
      .from('branch_item_prices')
      .update({ initial_stock: 0 })
      .gt('id', 0)

    if (error) {
      console.error('Error resetting inventory:', error)
      return Response.json({ ok: false, error: error.message }, { status: 500 })
    }

    // Also reset qty_on_hand in items table for consistency
    await supabase
      .from('items')
      .update({ qty_on_hand: 0 })
      .gt('item_id', 0)

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