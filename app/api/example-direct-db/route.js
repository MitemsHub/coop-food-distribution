import { queryDirect } from '../../../lib/directDb.js'
import { createSupabaseServerClient } from '../../../lib/supabaseServer.js'

export const runtime = 'nodejs'

export async function GET(request) {
  try {
    // Verify admin session using standard Supabase client
    const supabase = await createSupabaseServerClient()
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Example: Get member count using direct database connection (transaction pooler)
    // This is more efficient for heavy database operations
    const memberCountResult = await queryDirect(
      'SELECT COUNT(*) as total FROM members WHERE status = $1',
      ['active']
    )

    // Example: Get recent orders using direct database connection
    const recentOrdersResult = await queryDirect(`
      SELECT 
        o.id,
        o.created_at,
        o.status,
        m.name as member_name
      FROM orders o
      JOIN members m ON o.member_id = m.id
      WHERE o.created_at >= NOW() - INTERVAL '7 days'
      ORDER BY o.created_at DESC
      LIMIT 10
    `)

    return Response.json({
      success: true,
      data: {
        memberCount: memberCountResult.rows[0]?.total || 0,
        recentOrders: recentOrdersResult.rows
      },
      message: 'Data retrieved using transaction pooler for optimal performance'
    })

  } catch (error) {
    console.error('Direct DB example error:', error)
    return Response.json(
      { 
        error: 'Database operation failed',
        details: error.message 
      }, 
      { status: 500 }
    )
  }
}