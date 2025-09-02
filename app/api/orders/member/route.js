// app/api/orders/member/route.js
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '../../../../lib/supabaseServer'
import { validateSession } from '../../../../lib/validation'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const memberId = searchParams.get('member_id')
    
    if (!memberId) {
      return NextResponse.json({ ok: false, error: 'Member ID is required' }, { status: 400 })
    }

    // Try to validate session for reps and admins
    // Members don't have session tokens, so we allow requests without tokens
    const adminToken = request.cookies.get('admin_token')?.value
    const repToken = request.cookies.get('rep_token')?.value
    
    let role = null
    let sessionMemberId = null
    let branch_id = null

    if (adminToken || repToken) {
      // User has a session token, validate it
      let sessionResult
      if (adminToken) {
        sessionResult = await validateSession(request, 'admin')
      } else if (repToken) {
        sessionResult = await validateSession(request, 'rep')
      }
      
      if (!sessionResult.valid) {
        return NextResponse.json({ ok: false, error: 'Invalid session' }, { status: 401 })
      }
      
      role = sessionResult.claims.role
      sessionMemberId = sessionResult.claims.member_id
      branch_id = sessionResult.claims.branch_id

      // Reps can view orders from their branch
      // Admins can view all orders
      if (role === 'member' && sessionMemberId !== memberId) {
        return NextResponse.json({ ok: false, error: 'Access denied' }, { status: 403 })
      }
    }
    // If no session tokens, assume it's a member request (members access via URL params)
    // This is acceptable since the UI controls access to member data

    const supabase = await createSupabaseServerClient()

    let query = supabase
      .from('orders')
      .select(`
        *,
        order_lines (
          *,
          items (
            item_id,
            sku,
            name,
            unit,
            category
          )
        ),
        branches!orders_branch_id_fkey (
          name,
          code
        ),
        departments (
          name
        )
      `)
      .eq('member_id', memberId)
      .order('created_at', { ascending: false })

    // If user is a rep, filter by their branch
    if (role === 'rep' && branch_id) {
      query = query.eq('branch_id', branch_id)
    }

    const { data: orders, error } = await query

    if (error) {
      console.error('Fetch member orders error:', error)
      return NextResponse.json({ ok: false, error: 'Failed to fetch orders' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, orders: orders || [] })
  } catch (error) {
    console.error('Member orders API error:', error)
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 })
  }
}