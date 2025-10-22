// app/api/system/shopping/route.js
// Public endpoint to read whether shopping is open
import { queryDirect } from '@/lib/directDb'
import { createClient } from '@/lib/supabaseServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isDirectDbUnavailable(error) {
  return error?.message?.includes('SUPABASE_DB_URL')
}

export async function GET() {
  try {
    // Ensure app_settings table exists, then read the flag via direct DB
    try {
      await queryDirect(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key VARCHAR(100) PRIMARY KEY,
        value VARCHAR(255),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)

      const result = await queryDirect(
        'SELECT value FROM app_settings WHERE key = $1 LIMIT 1',
        ['shopping_open']
      )

      const value = result.rows[0]?.value
      const open = value === 'true'
      return Response.json({ ok: true, open })
    } catch (error) {
      if (isDirectDbUnavailable(error)) {
        // Fallback to Supabase client when direct DB URL is not configured
        const supabase = createClient()
        const { data, error: sErr } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'shopping_open')
          .limit(1)
          .maybeSingle()
        if (sErr) {
          return Response.json({ ok: false, error: sErr.message || 'Failed to read shopping status' }, { status: 500 })
        }
        const value = data?.value
        const open = value === 'true'
        return Response.json({ ok: true, open })
      }
      throw error
    }
  } catch (error) {
    console.error('GET /api/system/shopping error:', error)
    return Response.json({ ok: false, error: 'Failed to read shopping status' }, { status: 500 })
  }
}