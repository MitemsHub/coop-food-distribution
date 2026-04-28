import { createClient } from '../../../../../lib/supabaseServer'
import { validateSession } from '../../../../../lib/validation'
import { queryDirect } from '../../../../../lib/directDb'
 
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
 
export async function POST(request) {
  try {
    const session = await validateSession(request, 'admin')
    if (!session.valid) {
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }
 
    const supabase = createClient()
 
    const hasColumn = async (table, column) => {
      const { error } = await supabase.from(table).select(column).limit(1)
      return !error
    }
 
    const membersHasPin = await hasColumn('members', 'pin')
    if (!membersHasPin) {
      return Response.json({ ok: false, error: 'members.pin column not found' }, { status: 400 })
    }
 
    const membersHasUpdatedAt = await hasColumn('members', 'updated_at')
 
    const sql = membersHasUpdatedAt
      ? `UPDATE public.members SET pin = NULL, updated_at = NOW() WHERE pin IS NOT NULL`
      : `UPDATE public.members SET pin = NULL WHERE pin IS NOT NULL`
 
    const result = await queryDirect(sql)
 
    return Response.json({
      ok: true,
      updatedCount: Number(result?.rowCount || 0)
    })
  } catch (error) {
    console.error('Error in reset-member-pins:', error)
    return Response.json({ ok: false, error: error.message }, { status: 500 })
  }
}
