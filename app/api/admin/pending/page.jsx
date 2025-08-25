'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'

// export const revalidate = 0

export default function PendingAdminPage() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const [branches, setBranches] = useState([])
  const [filter, setFilter] = useState({ term: '', branchCode: '', payment: '', limit: 50 })
  const [editing, setEditing] = useState(null) // { order_id, lines: [{sku,name,qty,price}] }
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    const loadLookups = async () => {
      const { data: b } = await supabase.from('branches').select('code, name').order('name')
      setBranches(b || [])
    }
    loadLookups()
  }, [])

  const fetchOrders = async () => {
    setLoading(true)
    setMsg(null)
    try {
      let query = supabase
        .from('orders')
        .select(`
          order_id,
          created_at,
          member_id,
          member_name_snapshot,
          member_category_snapshot,
          payment_option,
          total_amount,
          branches:branch_id(code, name),
          departments:department_id(name),
          order_lines(
            id, qty, unit_price, amount,
            items:item_id(sku, name)
          )
        `)
        .eq('status', 'Pending')
        .order('created_at', { ascending: false })

      if (filter.branchCode) query = query.eq('branches.code', filter.branchCode)
      if (filter.payment) query = query.eq('payment_option', filter.payment)
      if (filter.term) {
        const t = filter.term
        query = query.or(`member_id.ilike.%${t}%,member_name_snapshot.ilike.%${t}%`)
      }

      const { data, error } = await query.limit(filter.limit)
      if (error) throw error
      setOrders(data || [])
    } catch (e) {
      setMsg({ type: 'error', text: e.message })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter.branchCode, filter.payment])

  const startEdit = (o) => {
    const lines = (o.order_lines || []).map(l => ({
      sku: l.items?.sku,
      name: l.items?.name,
      qty: l.qty,
      price: Number(l.unit_price)
    }))
    setEditing({ order_id: o.order_id, lines })
  }

  const setEditQty = (idx, val) => {
    setEditing(prev => {
      const lines = prev.lines.slice()
      const n = Math.max(0, Math.min(9999, Number(val) || 0))
      lines[idx] = { ...lines[idx], qty: n }
      return { ...prev, lines }
    })
  }

  const editedTotal = useMemo(() => {
    if (!editing) return 0
    return editing.lines.reduce((s, l) => s + l.qty * l.price, 0)
  }, [editing])

  const saveEdit = async () => {
    try {
      const lines = editing.lines.filter(l => l.qty > 0).map(l => ({ sku: l.sku, qty: l.qty }))
      if (lines.length === 0) throw new Error('At least one line with qty > 0 required')
      const res = await fetch('/api/admin/orders/update-lines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: editing.order_id, lines })
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || 'Update failed')
      setMsg({ type: 'success', text: `Order ${editing.order_id} updated` })
      setEditing(null)
      fetchOrders()
    } catch (e) {
      setMsg({ type: 'error', text: e.message })
    }
  }

  const doPost = async (order_id) => {
    if (!confirm(`Post order ${order_id}?`)) return
    const res = await fetch('/api/admin/orders/post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: order_id, adminId: 'admin@coop' })
    })
    const json = await res.json()
    if (!res.ok || !json.ok) return setMsg({ type: 'error', text: json.error || 'Post failed' })
    setMsg({ type: 'success', text: `Order ${order_id} posted` })
    fetchOrders()
  }

  const doCancel = async (order_id) => {
    if (!confirm(`Cancel order ${order_id}?`)) return
    const res = await fetch('/api/admin/orders/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: order_id, adminId: 'admin@coop' })
    })
    const json = await res.json()
    if (!res.ok || !json.ok) return setMsg({ type: 'error', text: json.error || 'Cancel failed' })
    setMsg({ type: 'success', text: `Order ${order_id} cancelled` })
    fetchOrders()
  }

  const doDelete = async (order_id) => {
    if (!confirm(`Delete order ${order_id}? This cannot be undone.`)) return
    const res = await fetch('/api/admin/orders/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: order_id })
    })
    const json = await res.json()
    if (!res.ok || !json.ok) return setMsg({ type: 'error', text: json.error || 'Delete failed' })
    setMsg({ type: 'success', text: `Order ${order_id} deleted` })
    fetchOrders()
  }

  const exportCSV = () => {
    const rows = orders.flatMap(o => (o.order_lines || []).map(l => ({
      order_id: o.order_id,
      created_at: o.created_at,
      member_id: o.member_id,
      member_name: o.member_name_snapshot,
      category: o.member_category_snapshot,
      branch: o.branches?.name,
      department: o.departments?.name,
      payment: o.payment_option,
      item: l.items?.name,
      sku: l.items?.sku,
      qty: l.qty,
      unit_price: l.unit_price,
      amount: l.amount
    })))
    const headers = Object.keys(rows[0] || { order_id: '', created_at: '', member_id: '', member_name: '', category: '', branch: '', department: '', payment: '', item: '', sku: '', qty: '', unit_price: '', amount: '' })
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pending_orders.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Admin — Pending Orders</h1>

      <div className="flex flex-wrap gap-3 items-end mb-4">
        <div>
          <label className="block text-sm mb-1">Search (ID or Name)</label>
          <input
            className="border rounded px-3 py-2"
            placeholder="A12345 or Musa"
            value={filter.term}
            onChange={(e) => setFilter(f => ({ ...f, term: e.target.value }))}
            onKeyDown={(e) => e.key === 'Enter' && fetchOrders()}
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Branch</label>
          <select
            className="border rounded px-3 py-2"
            value={filter.branchCode}
            onChange={(e) => setFilter(f => ({ ...f, branchCode: e.target.value }))}
          >
            <option value="">All</option>
            {branches.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">Payment</label>
          <select
            className="border rounded px-3 py-2"
            value={filter.payment}
            onChange={(e) => setFilter(f => ({ ...f, payment: e.target.value }))}
          >
            <option value="">All</option>
            <option value="Savings">Savings</option>
            <option value="Loan">Loan</option>
            <option value="Cash">Cash</option>
          </select>
        </div>
        <button className="bg-blue-600 text-white px-4 py-2 rounded" onClick={fetchOrders}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
        <button className="bg-gray-700 text-white px-4 py-2 rounded" onClick={exportCSV}>
          Export CSV
        </button>
      </div>

      {msg && <div className={`mb-3 text-sm ${msg.type === 'success' ? 'text-green-700' : 'text-red-700'}`}>{msg.text}</div>}

      <div className="divide-y border rounded">
        {orders.length === 0 && <div className="p-4 text-gray-600">No Pending orders.</div>}
        {orders.map(o => (
          <div key={o.order_id} className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="font-medium">#{o.order_id}</div>
              <div>{new Date(o.created_at).toLocaleString()}</div>
              <div className="ml-4">{o.member_id} — {o.member_name_snapshot}</div>
              <div className="ml-4">{o.branches?.name} • {o.departments?.name || '-'}</div>
              <div className="ml-4">Payment: <span className="font-medium">{o.payment_option}</span></div>
              <div className="ml-4">Total: ₦{Number(o.total_amount || 0).toLocaleString()}</div>
              <div className="ml-auto flex gap-2">
                <button className="px-3 py-1 border rounded" onClick={() => startEdit(o)}>Edit</button>
                <button className="px-3 py-1 border rounded" onClick={() => doCancel(o.order_id)}>Cancel</button>
                <button className="px-3 py-1 border rounded text-white bg-green-600" onClick={() => doPost(o.order_id)}>Post</button>
                <button className="px-3 py-1 border rounded" onClick={() => doDelete(o.order_id)}>Delete</button>
              </div>
            </div>

            {/* Lines */}
            <div className="mt-3">
              {(o.order_lines || []).length === 0 && <div className="text-sm text-gray-600">No lines</div>}
              {(o.order_lines || []).length > 0 && (
                <table className="w-full text-sm border mt-2">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-2 border">SKU</th>
                      <th className="text-left p-2 border">Item</th>
                      <th className="text-right p-2 border">Qty</th>
                      <th className="text-right p-2 border">Unit Price</th>
                      <th className="text-right p-2 border">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {o.order_lines.map(l => (
                      <tr key={l.id}>
                        <td className="p-2 border">{l.items?.sku}</td>
                        <td className="p-2 border">{l.items?.name}</td>
                        <td className="p-2 border text-right">{l.qty}</td>
                        <td className="p-2 border text-right">₦{Number(l.unit_price).toLocaleString()}</td>
                        <td className="p-2 border text-right">₦{Number(l.amount).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Edit Drawer */}
      {editing && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center">
          <div className="bg-white w-full max-w-2xl rounded p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Edit Order #{editing.order_id}</h3>
              <button onClick={() => setEditing(null)} className="px-2">✕</button>
            </div>
            <table className="w-full text-sm border mb-3">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-2 border">SKU</th>
                  <th className="text-left p-2 border">Item</th>
                  <th className="text-right p-2 border">Qty</th>
                  <th className="text-right p-2 border">Unit Price</th>
                  <th className="text-right p-2 border">Amount</th>
                </tr>
              </thead>
              <tbody>
                {editing.lines.map((l, idx) => (
                  <tr key={l.sku}>
                    <td className="p-2 border">{l.sku}</td>
                    <td className="p-2 border">{l.name}</td>
                    <td className="p-2 border text-right">
                      <input
                        type="number"
                        min={0}
                        value={l.qty}
                        onChange={e => setEditQty(idx, e.target.value)}
                        className="border rounded px-2 py-1 w-20 text-right"
                      />
                    </td>
                    <td className="p-2 border text-right">₦{l.price.toLocaleString()}</td>
                    <td className="p-2 border text-right">₦{(l.qty * l.price).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center gap-3">
              <div className="ml-auto text-right">
                <div className="text-sm text-gray-600">New Total</div>
                <div className="text-xl font-semibold">₦{editedTotal.toLocaleString()}</div>
              </div>
              <button className="px-4 py-2 border rounded" onClick={() => setEditing(null)}>Cancel</button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={saveEdit}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}