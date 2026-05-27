import { NextResponse } from 'next/server'
import { validateSession } from '@/lib/validation'

export async function POST(req) {
  try {
    const session = await validateSession(req, 'admin')
    if (!session.valid) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ ok: false, error: 'Delete is disabled. Use Cancel (and Restore) instead.' }, { status: 410 })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
