import * as XLSX from 'xlsx'
import { createClient } from '../../../../../lib/supabaseServer'
import { validateSession } from '../../../../../lib/validation'

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
    const session = await validateSession(request, 'admin')
    if (!session.valid) {
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient()
    const { searchParams } = new URL(request.url)
    const cycleParam = searchParams.get('cycle_id') || searchParams.get('cycle')

    let cycleId = null
    let cycleCode = null
    if (cycleParam && cycleParam !== 'all') {
      cycleId = Number(cycleParam)
      if (!Number.isFinite(cycleId)) {
        return Response.json({ ok: false, error: 'Invalid cycle_id' }, { status: 400 })
      }
    } else if (!cycleParam) {
      const { data: active, error: activeErr } = await supabase
        .from('cycles')
        .select('id, code')
        .eq('is_active', true)
        .maybeSingle()
      if (activeErr) return Response.json({ ok: false, error: activeErr.message }, { status: 500 })
      if (!active?.id) return Response.json({ ok: false, error: 'No active cycle found' }, { status: 400 })
      cycleId = active.id
      cycleCode = active.code || null
    }

    if (cycleId && !cycleCode) {
      const { data: c, error: cErr } = await supabase
        .from('cycles')
        .select('code')
        .eq('id', cycleId)
        .maybeSingle()
      if (cErr) return Response.json({ ok: false, error: cErr.message }, { status: 500 })
      cycleCode = c?.code || null
    }

    // Create a new workbook
    const workbook = XLSX.utils.book_new()

    const { data: cycles, error: cyclesError } = await supabase
      .from('cycles')
      .select('id, code, name, is_active, starts_at, ends_at, created_at')
      .order('id', { ascending: true })

    if (cyclesError) {
      console.error('Error fetching cycles:', cyclesError)
      return Response.json({ ok: false, error: cyclesError.message }, { status: 500 })
    }

    const cyclesData = prepareDataForSheet(cycleId ? (cycles || []).filter(c => c.id === cycleId) : (cycles || []))
    const cyclesSheet = XLSX.utils.json_to_sheet(cyclesData)
    XLSX.utils.book_append_sheet(workbook, cyclesSheet, 'Cycles')

    // Export orders with related data
    let ordersQuery = supabase
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
    if (cycleId) ordersQuery = ordersQuery.eq('cycle_id', cycleId)
    const { data: orders, error: ordersError } = await ordersQuery

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
    let orderLinesQuery = supabase
      .from('order_lines')
      .select('*, items:item_id(sku, name), orders:order_id!inner(order_id, cycle_id)')
    if (cycleId) orderLinesQuery = orderLinesQuery.eq('orders.cycle_id', cycleId)
    const { data: orderLines, error: orderLinesError } = await orderLinesQuery

    if (orderLinesError) {
      console.error('Error fetching order lines:', orderLinesError)
      return Response.json({ ok: false, error: orderLinesError.message }, { status: 500 })
    }

    // Add Order Lines sheet
    const orderLinesData = prepareDataForSheet(orderLines)
    const orderLinesSheet = XLSX.utils.json_to_sheet(orderLinesData)
    XLSX.utils.book_append_sheet(workbook, orderLinesSheet, 'Order Lines')

    let bipQuery = supabase
      .from('branch_item_prices')
      .select('*, branches:branch_id(code,name), items:item_id(sku,name,unit,category)')
    if (cycleId) bipQuery = bipQuery.eq('cycle_id', cycleId)
    const { data: prices, error: pricesError } = await bipQuery
    if (pricesError) {
      console.error('Error fetching branch_item_prices:', pricesError)
      return Response.json({ ok: false, error: pricesError.message }, { status: 500 })
    }
    const pricesData = prepareDataForSheet(prices)
    const pricesSheet = XLSX.utils.json_to_sheet(pricesData)
    XLSX.utils.book_append_sheet(workbook, pricesSheet, 'Branch Item Prices')

    let movesQuery = supabase
      .from('inventory_movements')
      .select('*, branches:branch_id(code,name), items:item_id(sku,name)')
    if (cycleId) movesQuery = movesQuery.eq('cycle_id', cycleId)
    const { data: movements, error: movementsError } = await movesQuery
    if (movementsError) {
      console.error('Error fetching inventory_movements:', movementsError)
      return Response.json({ ok: false, error: movementsError.message }, { status: 500 })
    }
    const movementsData = prepareDataForSheet(movements)
    const movementsSheet = XLSX.utils.json_to_sheet(movementsData)
    XLSX.utils.book_append_sheet(workbook, movementsSheet, 'Inventory Movements')

    // Generate Excel file buffer
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    // Create and return the Excel file
    const suffix = cycleParam === 'all' ? 'all-cycles' : (cycleCode || (cycleId ? `cycle-${cycleId}` : 'active'))
    return new Response(excelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="coop-backup-${suffix}-${new Date().toISOString().split('T')[0]}.xlsx"`
      }
    })

  } catch (error) {
    console.error('Error in export-backup:', error)
    return Response.json({ ok: false, error: error.message }, { status: 500 })
  }
}
