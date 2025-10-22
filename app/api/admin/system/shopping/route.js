// app/api/admin/system/shopping/route.js
// Admin endpoint to update and read shopping status (requires admin session)
import { NextResponse } from 'next/server'
import { validateSession } from '@/lib/validation'
import { queryDirect } from '@/lib/directDb'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function ensureTable() {
  await queryDirect(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key VARCHAR(100) PRIMARY KEY,
      value VARCHAR(255),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
}

export async function GET(request) {
  try {
    const session = await validateSession(request, 'admin')
    if (!session.valid) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    await ensureTable()
    const res = await queryDirect('SELECT value FROM app_settings WHERE key = $1 LIMIT 1', ['shopping_open'])
    const value = res.rows[0]?.value
    const open = value === 'true'
    return NextResponse.json({ ok: true, open })
  } catch (error) {
    console.error('GET /api/admin/system/shopping error:', error)
    return NextResponse.json({ ok: false, error: error?.message || 'Failed to read setting' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const session = await validateSession(request, 'admin')
    if (!session.valid) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { open } = body || {}
    if (typeof open !== 'boolean') {
      return NextResponse.json({ ok: false, error: 'Invalid payload: open must be boolean' }, { status: 400 })
    }

    await ensureTable()
    await queryDirect(
      `INSERT INTO app_settings(key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
      ['shopping_open', open ? 'true' : 'false']
    )

    return NextResponse.json({ ok: true, open })
  } catch (error) {
    console.error('POST /api/admin/system/shopping error:', error)
    return NextResponse.json({ ok: false, error: error?.message || 'Failed to update setting' }, { status: 500 })
  }
}