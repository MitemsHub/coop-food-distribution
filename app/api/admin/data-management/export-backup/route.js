import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Helper function to prepare data for Excel sheet
function prepareDataForSheet(data) {
  if (!data || data.length === 0) {
    return []
  }

  return data.map(item => {
    const processedItem = {}
    
    Object.keys(item).forEach(key => {
      let value = item[key]
      
      // Handle nested objects (like relations)
      if (typeof value === 'object' && value !== null) {
        if (Array.isArray(value)) {
          // Handle arrays (like order_lines) - convert to readable string
          value = value.map(v => {
            if (typeof v === 'object') {
              // For order lines, create a readable format
              if (v.items && v.qty) {
                return `${v.items.name || v.items.sku} (Qty: ${v.qty})`
              }
              return JSON.stringify(v)
            }
            return v
          }).join('; ')
        } else {
          // Handle objects (like member_branch) - extract meaningful info
          if (value.name && value.code) {
            value = `${value.name} (${value.code})`
          } else if (value.name) {
            value = value.name
          } else {
            value = JSON.stringify(value)
          }
        }
      }
      
      processedItem[key] = value
    })
    
    return processedItem
  })
}

export async function GET(request) {
  try {
    // Create a new workbook
    const workbook = XLSX.utils.book_new()

    // Export orders with related data
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        *,
        member_branch:branch_id(code,name),
        delivery:delivery_branch_id(code,name),
        order_lines(
          *,
          items:item_id(sku,name)
        )
      `)

    if (ordersError) {
      console.error('Error fetching orders:', ordersError)
      return Response.json({ ok: false, error: ordersError.message }, { status: 500 })
    }

    // Add Orders sheet
    const ordersData = prepareDataForSheet(orders)
    const ordersSheet = XLSX.utils.json_to_sheet(ordersData)
    XLSX.utils.book_append_sheet(workbook, ordersSheet, 'Orders')

    // Export items/inventory
    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select('*')

    if (itemsError) {
      console.error('Error fetching items:', itemsError)
      return Response.json({ ok: false, error: itemsError.message }, { status: 500 })
    }

    // Add Items sheet
    const itemsData = prepareDataForSheet(items)
    const itemsSheet = XLSX.utils.json_to_sheet(itemsData)
    XLSX.utils.book_append_sheet(workbook, itemsSheet, 'Items')

    // Export branches
    const { data: branches, error: branchesError } = await supabase
      .from('branches')
      .select('*')

    if (branchesError) {
      console.error('Error fetching branches:', branchesError)
      return Response.json({ ok: false, error: branchesError.message }, { status: 500 })
    }

    // Add Branches sheet
    const branchesData = prepareDataForSheet(branches)
    const branchesSheet = XLSX.utils.json_to_sheet(branchesData)
    XLSX.utils.book_append_sheet(workbook, branchesSheet, 'Branches')

    // Export departments
    const { data: departments, error: departmentsError } = await supabase
      .from('departments')
      .select('*')

    if (departmentsError) {
      console.error('Error fetching departments:', departmentsError)
      return Response.json({ ok: false, error: departmentsError.message }, { status: 500 })
    }

    // Add Departments sheet
    const departmentsData = prepareDataForSheet(departments)
    const departmentsSheet = XLSX.utils.json_to_sheet(departmentsData)
    XLSX.utils.book_append_sheet(workbook, departmentsSheet, 'Departments')

    // Export members (without sensitive data)
    const { data: members, error: membersError } = await supabase
      .from('members')
      .select('member_id, full_name, email, branch_id, department_id, status')

    if (membersError) {
      console.error('Error fetching members:', membersError)
      return Response.json({ ok: false, error: membersError.message }, { status: 500 })
    }

    // Add Members sheet
    const membersData = prepareDataForSheet(members)
    const membersSheet = XLSX.utils.json_to_sheet(membersData)
    XLSX.utils.book_append_sheet(workbook, membersSheet, 'Members')

    // Export order lines separately for better readability
    const { data: orderLines, error: orderLinesError } = await supabase
      .from('order_lines')
      .select(`
        *,
        items:item_id(sku, name)
      `)

    if (orderLinesError) {
      console.error('Error fetching order lines:', orderLinesError)
      return Response.json({ ok: false, error: orderLinesError.message }, { status: 500 })
    }

    // Add Order Lines sheet
    const orderLinesData = prepareDataForSheet(orderLines)
    const orderLinesSheet = XLSX.utils.json_to_sheet(orderLinesData)
    XLSX.utils.book_append_sheet(workbook, orderLinesSheet, 'Order Lines')

    // Generate Excel file buffer
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    // Create and return the Excel file
    return new Response(excelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="coop-backup-${new Date().toISOString().split('T')[0]}.xlsx"`
      }
    })

  } catch (error) {
    console.error('Error in export-backup:', error)
    return Response.json({ ok: false, error: error.message }, { status: 500 })
  }
}