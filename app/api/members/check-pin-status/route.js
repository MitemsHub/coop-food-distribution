import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  try {
    const { memberId } = await request.json()

    if (!memberId) {
      return Response.json({ error: 'Member ID is required' }, { status: 400 })
    }

    // Check if member exists and get their PIN status
    const { data, error } = await supabase
      .from('members')
      .select('member_id, pin')
      .eq('member_id', memberId.toUpperCase())
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return Response.json({ 
          exists: false, 
          hasPin: false 
        })
      }
      throw error
    }

    return Response.json({
      exists: true,
      hasPin: data.pin !== null && data.pin !== ''
    })

  } catch (error) {
    console.error('Check PIN status error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}