import { NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabaseServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const supabase = createClient()
    const { searchParams } = new URL(request.url)
    const branch = searchParams.get('branch')
    const department = searchParams.get('department')
    
    let query = supabase
      .from('v_inventory_status_by_department')
      .select('*')
    
    // Apply branch filter if specified
    if (branch && branch !== 'All Branches') {
      // Accept either branch code or branch name
      query = query.or(`branch_code.eq.${branch},branch_name.eq.${branch}`)
    }
    
    // Apply department filter if specified
    if (department && department !== 'All Departments') {
      query = query.eq('department_name', department)
    }
    
    // Order by branch, department, then item name
    query = query.order('branch_name').order('department_name').order('item_name')
    
    const { data, error } = await query

    if (error || !data || data.length === 0) {
      console.error('View error or empty; using fallback aggregation')
      // Graceful fallback aggregation when view fails or returns empty
      const [ordersRes, linesRes, itemsRes, deptsRes, branchesRes, membersRes] = await Promise.all([
        supabase.from('orders').select('order_id, status, delivery_branch_id, member_id'),
        supabase.from('order_lines').select('order_id, item_id, qty'),
        supabase.from('items').select('item_id, sku, name, department_id'),
        supabase.from('departments').select('id, name'),
        supabase.from('branches').select('id, code, name'),
        supabase.from('members').select('member_id, department_id')
      ])
      if (ordersRes.error || linesRes.error || itemsRes.error || deptsRes.error || branchesRes.error || membersRes.error) {
        const msg = ordersRes.error?.message || linesRes.error?.message || itemsRes.error?.message || deptsRes.error?.message || branchesRes.error?.message || membersRes.error?.message || 'Fallback aggregation failed'
        return NextResponse.json({ data: [], error: msg }, { status: 200 })
      }
      const orderStatus = new Map(ordersRes.data.map(o => [o.order_id, { status: o.status, branch_id: o.delivery_branch_id, member_id: o.member_id }]))
      const deptMap = new Map(deptsRes.data.map(d => [d.id, d.name]))
      const branchMap = new Map(branchesRes.data.map(b => [b.id, { code: b.code, name: b.name }]))
      const memberDeptMap = new Map(membersRes.data.map(m => [m.member_id, m.department_id]))
      const itemMeta = new Map(itemsRes.data.map(i => [i.item_id, i]))
      const agg = new Map()
      for (const line of linesRes.data) {
        const ord = orderStatus.get(line.order_id)
        if (!ord) continue
        const meta = itemMeta.get(line.item_id)
        if (!meta) continue
        // Prefer member's department if present, else item department
        const depId = memberDeptMap.get(ord.member_id) ?? meta.department_id
        const brId = ord.branch_id
        const key = `${brId}|${depId}|${line.item_id}`
        const entry = agg.get(key) || { branch_id: brId, department_id: depId, item_id: line.item_id, pending_qty: 0, posted_qty: 0, delivered_qty: 0 }
        const st = String(ord.status || '').toLowerCase()
        if (st === 'pending') entry.pending_qty += line.qty || 0
        else if (st === 'posted') entry.posted_qty += line.qty || 0
        else if (st === 'delivered') entry.delivered_qty += line.qty || 0
        agg.set(key, entry)
      }
      let rows = Array.from(agg.values()).map(r => {
        const b = branchMap.get(r.branch_id) || {}
        const dname = deptMap.get(r.department_id) || 'Unknown Department'
        const meta = itemMeta.get(r.item_id) || {}
        const allocated = (r.pending_qty || 0) + (r.posted_qty || 0)
        return {
          branch_code: b.code || 'N/A',
          branch_name: b.name || 'Unknown Branch',
          department_name: dname,
          sku: meta.sku || null,
          item_name: meta.name || `Item ${r.item_id}`,
          total_demand: allocated,
          allocated_qty: allocated,
          pending_delivery_qty: r.posted_qty || 0,
          delivered_qty: r.delivered_qty || 0,
        }
      })
      // Apply filters
      if (branch && branch !== 'All Branches') rows = rows.filter(r => r.branch_code === branch || r.branch_name === branch)
      if (department && department !== 'All Departments') rows = rows.filter(r => r.department_name === department)
      // Exclude branches with zero activity (no orders at all)
      rows = rows.filter(r => (r.total_demand || 0) > 0 || (r.allocated_qty || 0) > 0 || (r.pending_delivery_qty || 0) > 0 || (r.delivered_qty || 0) > 0)
      // Order
      rows.sort((a,b) => (a.branch_name||'').localeCompare(b.branch_name||'') || (a.department_name||'').localeCompare(b.department_name||'') || (a.item_name||'').localeCompare(b.item_name||''))
      return NextResponse.json({ data: rows, summary: { total_items: rows.length } })
    }
    
    // Transform data to include calculated fields
    const transformedData = data.map(row => {
      const computedTotal = (row.pending_demand || 0) + (row.confirmed_demand || 0) + (row.delivered_qty || row.delivered_demand || 0)
      const total = computedTotal
      const available = row.available_stock || 0
      return {
        ...row,
        total_demand: total,
        allocation_percentage: available > 0 
          ? Math.round((total / available) * 100)
          : 0,
        remaining_after_department: Math.max(0, available - total),
        stock_status: available - total <= 0 
          ? 'out_of_stock'
          : available - total <= 20
          ? 'low_stock'
          : 'in_stock',
        display_allocated: `${row.allocated_qty || 0} ${row.unit || ''}`.trim(),
        display_delivered: `${row.delivered_qty || 0} ${row.unit || ''}`.trim(),
        display_remaining: `${Math.max(0, available - total)} ${row.unit || ''}`.trim()
      }
    })

    // Exclude branches with zero activity (no orders at all)
    const nonZeroData = transformedData.filter(r => (r.total_demand || 0) > 0 || (r.allocated_qty || 0) > 0 || (r.pending_delivery_qty || 0) > 0 || (r.delivered_qty || 0) > 0)
    
    return NextResponse.json({
      data: nonZeroData,
      summary: {
        total_items: nonZeroData.length,
        total_branches: [...new Set(nonZeroData.map(r => r.branch_name))].length,
        total_departments: [...new Set(nonZeroData.map(r => r.department_name))].length,
        low_stock_items: nonZeroData.filter(r => r.stock_status === 'low_stock').length,
        out_of_stock_items: nonZeroData.filter(r => r.stock_status === 'out_of_stock').length
      }
    })
    
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// OPTIONS endpoint for fetching available departments and branches
export async function OPTIONS() {
  try {
    const supabase = createClient()
    
    // Fetch departments
    const { data: departments, error: deptError } = await supabase
      .from('departments')
      .select('id, name')
      .order('name')
    
    if (deptError) {
      throw deptError
    }
    
    // Fetch branches
    const { data: branches, error: branchError } = await supabase
      .from('branches')
      .select('id, code, name')
      .order('name')
    
    if (branchError) {
      throw branchError
    }
    
    return NextResponse.json({
      departments: departments || [],
      branches: branches || []
    })
    
  } catch (error) {
    console.error('Error fetching departments and branches:', error)
    return NextResponse.json(
      { error: 'Failed to fetch departments and branches' },
      { status: 500 }
    )
  }
}