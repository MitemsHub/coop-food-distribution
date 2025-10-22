// app/api/system/shopping/route.js
// Public endpoint to read whether shopping is open
import { queryDirect } from '@/lib/directDb'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Ensure app_settings table exists, then read the flag
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
    console.error('GET /api/system/shopping error:', error)
    return Response.json({ ok: false, error: 'Failed to read shopping status' }, { status: 500 })
  }
}