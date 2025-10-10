import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  try {
    const { memberId, pin } = await request.json()

    if (!memberId || !pin) {
      return Response.json({ error: 'Member ID and PIN are required' }, { status: 400 })
    }

    // Validate PIN format (4-5 digits)
    if (!/^\d{4,5}$/.test(pin)) {
      return Response.json({ error: 'Invalid PIN format' }, { status: 400 })
    }

    // Check member and PIN
    const { data, error } = await supabase
      .from('members')
      .select('pin')
      .eq('member_id', memberId.toUpperCase())
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return Response.json({ error: 'Member not found' }, { status: 404 })
      }
      throw error
    }

    // Verify PIN
    if (data.pin !== pin) {
      return Response.json({ error: 'Invalid PIN' }, { status: 401 })
    }

    return Response.json({ success: true })

  } catch (error) {
    console.error('Verify PIN error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}