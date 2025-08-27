import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  try {
    // Reset all inventory quantities to 0
    const { data, error } = await supabase
      .from('items')
      .update({ 
        qty_on_hand: 0,
        updated_at: new Date().toISOString()
      })
      .neq('id', 0) // Update all records
      .select('id')

    if (error) {
      console.error('Error resetting inventory:', error)
      return Response.json({ ok: false, error: error.message }, { status: 500 })
    }

    return Response.json({ 
      ok: true, 
      updatedCount: data?.length || 0,
      message: 'Inventory quantities reset to zero successfully'
    })
  } catch (error) {
    console.error('Error in reset-inventory:', error)
    return Response.json({ ok: false, error: error.message }, { status: 500 })
  }
}