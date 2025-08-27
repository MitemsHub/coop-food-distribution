import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function GET(request) {
  try {
    const backup = {
      timestamp: new Date().toISOString(),
      version: '1.0',
      data: {}
    }

    // Export orders with related data
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        *,
        member_branch:branch_id(code,name),
        delivery:delivery_branch_id(code,name),
        departments:department_id(name),
        order_lines(
          *,
          items:item_id(sku,name)
        )
      `)

    if (ordersError) {
      console.error('Error fetching orders:', ordersError)
      return Response.json({ ok: false, error: ordersError.message }, { status: 500 })
    }

    backup.data.orders = orders

    // Export items/inventory
    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select('*')

    if (itemsError) {
      console.error('Error fetching items:', itemsError)
      return Response.json({ ok: false, error: itemsError.message }, { status: 500 })
    }

    backup.data.items = items

    // Export branches
    const { data: branches, error: branchesError } = await supabase
      .from('branches')
      .select('*')

    if (branchesError) {
      console.error('Error fetching branches:', branchesError)
      return Response.json({ ok: false, error: branchesError.message }, { status: 500 })
    }

    backup.data.branches = branches

    // Export departments
    const { data: departments, error: departmentsError } = await supabase
      .from('departments')
      .select('*')

    if (departmentsError) {
      console.error('Error fetching departments:', departmentsError)
      return Response.json({ ok: false, error: departmentsError.message }, { status: 500 })
    }

    backup.data.departments = departments

    // Export members (without sensitive data)
    const { data: members, error: membersError } = await supabase
      .from('members')
      .select('member_id, full_name, branch_id, category')

    if (membersError) {
      console.error('Error fetching members:', membersError)
      return Response.json({ ok: false, error: membersError.message }, { status: 500 })
    }

    backup.data.members = members

    // Create and return the backup file
    const backupJson = JSON.stringify(backup, null, 2)
    
    return new Response(backupJson, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="coop-backup-${new Date().toISOString().split('T')[0]}.json"`
      }
    })

  } catch (error) {
    console.error('Error in export-backup:', error)
    return Response.json({ ok: false, error: error.message }, { status: 500 })
  }
}