import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Helper function to convert array of objects to CSV
function arrayToCSV(data, title) {
  if (!data || data.length === 0) {
    return `${title}\nNo data available\n\n`
  }

  // Get all unique keys from all objects
  const allKeys = new Set()
  data.forEach(item => {
    Object.keys(item).forEach(key => allKeys.add(key))
  })
  
  const headers = Array.from(allKeys)
  
  // Create CSV content
  let csv = `${title}\n`
  csv += headers.join(',') + '\n'
  
  data.forEach(item => {
    const row = headers.map(header => {
      let value = item[header]
      
      // Handle nested objects (like relations)
      if (typeof value === 'object' && value !== null) {
        if (Array.isArray(value)) {
          // Handle arrays (like order_lines)
          value = value.map(v => typeof v === 'object' ? JSON.stringify(v) : v).join(';')
        } else {
          // Handle objects (like member_branch)
          value = JSON.stringify(value)
        }
      }
      
      // Escape commas and quotes in CSV
      if (value === null || value === undefined) {
        return ''
      }
      
      value = String(value)
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        value = '"' + value.replace(/"/g, '""') + '"'
      }
      
      return value
    })
    csv += row.join(',') + '\n'
  })
  
  return csv + '\n'
}

export async function GET(request) {
  try {
    let csvContent = `Coop Food Distribution System - Data Backup\n`
    csvContent += `Generated: ${new Date().toISOString()}\n`
    csvContent += `Version: 1.0\n\n`

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

    csvContent += arrayToCSV(orders, 'ORDERS')

    // Export items/inventory
    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select('*')

    if (itemsError) {
      console.error('Error fetching items:', itemsError)
      return Response.json({ ok: false, error: itemsError.message }, { status: 500 })
    }

    csvContent += arrayToCSV(items, 'ITEMS')

    // Export branches
    const { data: branches, error: branchesError } = await supabase
      .from('branches')
      .select('*')

    if (branchesError) {
      console.error('Error fetching branches:', branchesError)
      return Response.json({ ok: false, error: branchesError.message }, { status: 500 })
    }

    csvContent += arrayToCSV(branches, 'BRANCHES')

    // Export departments
    const { data: departments, error: departmentsError } = await supabase
      .from('departments')
      .select('*')

    if (departmentsError) {
      console.error('Error fetching departments:', departmentsError)
      return Response.json({ ok: false, error: departmentsError.message }, { status: 500 })
    }

    csvContent += arrayToCSV(departments, 'DEPARTMENTS')

    // Export members (without sensitive data)
    const { data: members, error: membersError } = await supabase
      .from('members')
      .select('member_id, full_name, email, branch_id, department_id, status')

    if (membersError) {
      console.error('Error fetching members:', membersError)
      return Response.json({ ok: false, error: membersError.message }, { status: 500 })
    }

    csvContent += arrayToCSV(members, 'MEMBERS')

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

    csvContent += arrayToCSV(orderLines, 'ORDER_LINES')

    // Create and return the CSV file
    return new Response(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="coop-backup-${new Date().toISOString().split('T')[0]}.csv"`
      }
    })

  } catch (error) {
    console.error('Error in export-backup:', error)
    return Response.json({ ok: false, error: error.message }, { status: 500 })
  }
}