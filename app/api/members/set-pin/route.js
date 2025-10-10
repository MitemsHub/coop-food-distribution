import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  try {
    const { memberId, pin } = await request.json()

    console.log('Set PIN request:', { memberId, pin })

    if (!memberId || !pin) {
      return Response.json({ error: 'Member ID and PIN are required' }, { status: 400 })
    }

    // Validate PIN format (4-5 digits)
    if (!/^\d{4,5}$/.test(pin)) {
      console.log('PIN validation failed:', pin)
      return Response.json({ error: 'PIN must be 4-5 digits' }, { status: 400 })
    }

    // Check if member exists
    const { data: memberData, error: memberError } = await supabase
      .from('members')
      .select('member_id')
      .eq('member_id', memberId.toUpperCase())
      .single()

    if (memberError) {
      console.log('Member lookup error:', memberError)
      if (memberError.code === 'PGRST116') {
        return Response.json({ error: 'Member not found' }, { status: 404 })
      }
      throw memberError
    }

    console.log('Member found:', memberData)

    // Set the PIN for the member
    const { error: updateError } = await supabase
      .from('members')
      .update({ 
        pin: pin
      })
      .eq('member_id', memberId.toUpperCase())

    if (updateError) {
      console.log('PIN update error:', updateError)
      throw updateError
    }

    console.log('PIN set successfully for member:', memberId)
    return Response.json({ success: true })

  } catch (error) {
    console.error('Set PIN error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}