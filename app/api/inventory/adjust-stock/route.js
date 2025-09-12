import { NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabaseServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req) {
  try {
    const supabase = createClient()
    const { sku, branchCode, adjustment, memberId, action } = await req.json()
    
    if (!sku || !branchCode || !adjustment || !memberId || !action) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Missing required fields: sku, branchCode, adjustment, memberId, action' 
      }, { status: 400 })
    }

    // Get branch, item, and active cycle
    const [{ data: branch }, { data: item }, { data: cycle }] = await Promise.all([
      supabase.from('branches').select('id,code').eq('code', branchCode).single(),
      supabase.from('items').select('item_id,sku').eq('sku', sku).single(),
      supabase.from('cycles').select('id').eq('is_active', true).single()
    ])

    if (!branch) {
      return NextResponse.json({ ok: false, error: 'Branch not found' }, { status: 404 })
    }
    if (!item) {
      return NextResponse.json({ ok: false, error: 'Item not found' }, { status: 404 })
    }
    if (!cycle) {
      return NextResponse.json({ ok: false, error: 'No active cycle found' }, { status: 400 })
    }

    // Get current stock from branch_item_prices
    let { data: priceRow, error: priceError } = await supabase
      .from('branch_item_prices')
      .select('id, initial_stock')
      .eq('branch_id', branch.id)
      .eq('item_id', item.item_id)
      .single()

    if (priceError || !priceRow) {
      // Try to create a default price record with 0 stock if it doesn't exist
      let { data: newPriceRow, error: createError } = await supabase
        .from('branch_item_prices')
        .insert({
          branch_id: branch.id,
          item_id: item.item_id,
          price: 0,
          initial_stock: 0
        })
        .select('id, initial_stock')
        .single()
      
      if (createError) {
        return NextResponse.json({ 
          ok: false, 
          error: `Price configuration not found for this item and branch. Unable to create default: ${createError.message}` 
        }, { status: 404 })
      }
      
      // Use the newly created record
      priceRow = newPriceRow
    }

    // Calculate movement quantity based on action
    let movementQty = 0
    let movementType = ''
    let referenceType = ''

    switch (action) {
      case 'reserve':
        movementQty = -adjustment // Negative for reservation (stock out)
        movementType = 'Out'
        referenceType = 'reservation'
        break
      case 'release':
        movementQty = adjustment // Positive for release (stock back in)
        movementType = 'In'
        referenceType = 'release'
        break
      case 'purchase':
        movementQty = -adjustment // Negative for purchase (final stock out)
        movementType = 'Out'
        referenceType = 'purchase'
        break
      default:
        return NextResponse.json({ 
          ok: false, 
          error: 'Invalid action. Must be reserve, release, or purchase' 
        }, { status: 400 })
    }

    // Get current available stock from inventory status view
    const { data: stockData, error: stockError } = await supabase
      .from('v_inventory_status')
      .select('remaining_after_posted')
      .eq('branch_code', branchCode)
      .eq('sku', sku)
      .single()

    let currentAvailable = stockData?.remaining_after_posted || priceRow.initial_stock || 0

    // Check stock availability for reservations
    if (action === 'reserve' && currentAvailable < adjustment) {
      return NextResponse.json({ 
        ok: false, 
        error: `Insufficient stock. Available: ${currentAvailable}, Requested: ${adjustment}` 
      }, { status: 400 })
    }

    // Record the inventory movement
    const { error: movementError } = await supabase
      .from('inventory_movements')
      .insert({
        item_id: item.item_id,
        branch_id: branch.id,
        cycle_id: cycle.id,
        movement_type: movementType,
        quantity: movementQty,
        reference_type: referenceType,
        notes: `${action} by member ${memberId}`
      })

    if (movementError) {
      console.error('Inventory movement error:', movementError)
      return NextResponse.json({ 
        ok: false, 
        error: 'Failed to record inventory movement' 
      }, { status: 500 })
    }

    // Calculate new available stock
    const newAvailable = Math.max(0, currentAvailable + movementQty)

    return NextResponse.json({ 
      ok: true, 
      stock: {
        available: newAvailable,
        movement: movementQty,
        action: action
      }
    })

  } catch (error) {
    console.error('Stock adjustment error:', error)
    return NextResponse.json({ 
      ok: false, 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}