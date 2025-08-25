// app/page.js
import { supabase } from '../lib/supabaseClient'

// no caching while testing
export const revalidate = 0

export default async function Page() {
  // 1) Get the DUTSE branch row
  const { data: branchRow, error: branchErr } = await supabase
    .from('branches')
    .select('id, code, name')
    .eq('code', 'DUTSE')
    .single()

  if (branchErr) {
    return (
      <div style={{ padding: 20 }}>
        <h1>Dutse Items Test</h1>
        <p style={{ color: 'crimson' }}>Branch lookup error</p>
        <pre>{JSON.stringify(branchErr, null, 2)}</pre>
      </div>
    )
  }

  // 2) Fetch DUTSE items (with price + stock), ordered by item name
  const { data: items, error: itemsErr } = await supabase
    .from('branch_item_prices')
    .select(`
      price,
      initial_stock,
      items:item_id(name, sku, unit, category)
    `)
    .eq('branch_id', branchRow.id)
    .order('name', { foreignTable: 'items' }) // order by related table's column

  return (
    <div style={{ padding: 20, fontFamily: 'sans-serif' }}>
      <h1>Dutse Items Test</h1>

      <h2>Branch</h2>
      <pre>{JSON.stringify(branchRow, null, 2)}</pre>

      {itemsErr && (
        <>
          <p style={{ color: 'crimson' }}>Items query error</p>
          <pre>{JSON.stringify(itemsErr, null, 2)}</pre>
        </>
      )}

      <h2>Items ({items?.length || 0})</h2>
      {(!items || items.length === 0) && (
        <p>No items configured for DUTSE yet. Seed items and branch prices, then reload.</p>
      )}
      <pre>{JSON.stringify(items || [], null, 2)}</pre>
    </div>
  )
}