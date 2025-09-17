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
      query = query.eq('branch_code', branch)
    }
    
    // Apply department filter if specified
    if (department && department !== 'All Departments') {
      query = query.eq('department_name', department)
    }
    
    // Order by branch, department, then item name
    query = query.order('branch_name').order('department_name').order('item_name')
    
    const { data, error } = await query
    
    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch department inventory data' },
        { status: 500 }
      )
    }
    
    // Transform data to include calculated fields
    const transformedData = data.map(row => ({
      ...row,
      // Calculate percentage of stock allocated to this department (use available_stock instead of initial_stock)
      allocation_percentage: row.available_stock > 0 
        ? Math.round((row.total_demand / row.available_stock) * 100)
        : 0,
      
      // Calculate remaining stock after department demand
      remaining_after_department: Math.max(0, (row.available_stock || 0) - (row.total_demand || 0)),
      
      // Determine stock status based on available stock and demand
      stock_status: (row.available_stock || 0) - (row.total_demand || 0) <= 0 
        ? 'out_of_stock'
        : (row.available_stock || 0) - (row.total_demand || 0) <= 20
        ? 'low_stock'
        : 'in_stock',
      
      // Format display values
      display_allocated: `${row.allocated_qty || 0} ${row.unit || ''}`.trim(),
      display_delivered: `${row.delivered_qty || 0} ${row.unit || ''}`.trim(),
      display_remaining: `${Math.max(0, (row.available_stock || 0) - (row.total_demand || 0))} ${row.unit || ''}`.trim()
    }))
    
    return NextResponse.json({
      data: transformedData,
      summary: {
        total_items: transformedData.length,
        total_branches: [...new Set(transformedData.map(r => r.branch_name))].length,
        total_departments: [...new Set(transformedData.map(r => r.department_name))].length,
        low_stock_items: transformedData.filter(r => r.stock_status === 'low_stock').length,
        out_of_stock_items: transformedData.filter(r => r.stock_status === 'out_of_stock').length
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