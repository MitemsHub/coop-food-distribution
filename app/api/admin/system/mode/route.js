// app/api/admin/system/mode/route.js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function GET() {
  try {
    // Check if any branches have demand tracking enabled
    // Since the migration sets all branches to demand_tracking_mode = true,
    // we can check if the majority of branches are in demand tracking mode
    const { data: branches, error } = await supabase
      .from('branches')
      .select('demand_tracking_mode')
      .limit(10) // Sample a few branches
    
    if (error) {
      console.error('Error checking demand tracking mode:', error)
      return Response.json({ 
        ok: false, 
        error: 'Failed to check system mode',
        isDemandTrackingMode: false 
      }, { status: 500 })
    }
    
    // If most branches have demand tracking enabled, consider system in demand mode
    const demandTrackingBranches = branches?.filter(b => b.demand_tracking_mode) || []
    const isDemandTrackingMode = demandTrackingBranches.length > (branches?.length || 0) / 2
    
    return Response.json({ 
      ok: true, 
      isDemandTrackingMode,
      totalBranches: branches?.length || 0,
      demandTrackingBranches: demandTrackingBranches.length
    })
    
  } catch (error) {
    console.error('System mode check error:', error)
    return Response.json({ 
      ok: false, 
      error: 'Internal server error',
      isDemandTrackingMode: false 
    }, { status: 500 })
  }
}