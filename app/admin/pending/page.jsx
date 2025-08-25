// app/admin/pending/page.jsx
'use client'
import { useEffect, useMemo, useState } from 'react'

export default function PendingAdminPage() {
  const [orders, setOrders] = useState([])
  const [term, setTerm] = useState('')
  const [payment, setPayment] = useState('')
  const [branch, setBranch] = useState('')
  const [msg, setMsg] = useState(null)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [editing, setEditing] = useState(null)

  const safeJson = async (res, label) => {
    const ct = res.headers.get('content-type') || ''
    if (ct.includes('application/json')) return await res.json()
    const text = await res.text()
    throw new Error(`Non-JSON response from ${label} (${res.status}): ${text.slice(0, 300)}`)
  }

  const fetchOrders = async () => {
    setLoading(true); setMsg(null)
    try {
      const qs = new URLSearchParams({
        status: 'Pending',
        limit: '200',
        ...(term ? { term } : {}),
        ...(payment ? { payment } : {}),
        ...(branch ? { branch } : {}),
      })
      const res = await fetch(`/api/admin/orders/list?${qs.toString()}`, { cache:'no-store' })
      const json = await safeJson(res, '/api/admin/orders/list')
      if (!json.ok) throw new Error(json.error || 'Failed to load')
      setOrders(json.orders || [])
    } catch (e) {
      setMsg({ type:'error', text:e.message })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchOrders() }, []) // first load

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  const selectAll = () => setSelected(new Set(orders.map(o => o.order_id)))
  const clearSelected = () => setSelected(new Set())

  // Actions with prompts
  const doPost = async (order_id) => {
    if (!confirm(`Post order ${order_id}?`)) return
    const adminNote = window.prompt('Optional note for posting (leave blank if none):', '') || ''
    try {
      const res = await fetch('/api/admin/orders/post', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ orderId: order_id, adminId:'admin@coop', adminNote })
      })
      const json = await safeJson(res, '/api/admin/orders/post')
      if (!json.ok) throw new Error(json.error || 'Post failed')
      setMsg({ type:'success', text:`Order ${order_id} posted` })
      fetchOrders(); clearSelected()
    } catch (e) {
      setMsg({ type:'error', text:e.message })
    }
  }

  const postSelected = async () => {
    if (selected.size === 0) return
    if (!confirm(`Post ${selected.size} order(s)?`)) return
    // Optional: one note for bulk
    const adminNote = window.prompt('Optional note for posting these orders:', '') || ''
    try {
      // First post in bulk
      const res = await fetch('/api/admin/orders/post-bulk', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ orderIds: Array.from(selected), adminId:'admin@coop' })
      })
      const json = await safeJson(res, '/api/admin/orders/post-bulk')
      if (!json.ok) throw new Error(json.error || 'Bulk post failed')

      // Then patch admin_note for posted ones if provided
      if (adminNote && Array.isArray(json.posted)) {
        await Promise.all(json.posted.map(id =>
          fetch('/api/admin/orders/post', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ orderId:id, adminId:'admin@coop', adminNote })
          })
        ))
      }

      setMsg({ type:'success', text:`Posted ${json.posted?.length || 0} order(s)` })
      fetchOrders(); clearSelected()
    } catch (e) {
      setMsg({ type:'error', text:e.message })
    }
  }

  const doCancel = async (order_id) => {
    const reason = window.prompt('Enter cancel reason:', '')
    if (reason === null) return // user aborted
    try {
      const res = await fetch('/api/admin/orders/cancel', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ orderId: order_id, adminId:'admin@coop', reason })
      })
      const json = await safeJson(res, '/api/admin/orders/cancel')
      if (!json.ok) throw new Error(json.error || 'Cancel failed')
      setMsg({ type:'success', text:`Order ${order_id} cancelled` })
      fetchOrders(); clearSelected()
    } catch (e) {
      setMsg({ type:'error', text:e.message })
    }
  }

  const doDelete = async (order_id) => {
    if (!confirm(`Delete order ${order_id}? This cannot be undone.`)) return
    try {
      const res = await fetch('/api/admin/orders/delete', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ orderId: order_id })
      })
      const json = await safeJson(res, '/api/admin/orders/delete')
      if (!json.ok) throw new Error(json.error || 'Delete failed')
      setMsg({ type:'success', text:`Order ${order_id} deleted` })
      fetchOrders(); clearSelected()
    } catch (e) {
      setMsg({ type:'error', text:e.message })
    }
  }

  // Edit modal logic (unchanged)
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
      const next = { ...prev }
      const n = Math.max(0, Math.min(9999, Number(val) || 0))
      next.lines = next.lines.slice()
      next.lines[idx] = { ...next.lines[idx], qty: n }
      return next
    })
  }
  const editedTotal = useMemo(() => editing?.lines?.reduce((s, l) => s + Number(l.qty) * Number(l.price), 0) || 0, [editing])
  const saveEdit = async () => {
    try {
      const payload = editing.lines.filter(l => Number(l.qty) > 0).map(l => ({ sku: l.sku, qty: Number(l.qty) }))
      if (!payload.length) throw new Error('At least one line qty > 0 required')
      const res = await fetch('/api/admin/orders/update-lines', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ orderId: editing.order_id, lines: payload })
      })
      const json = await safeJson(res, '/api/admin/orders/update-lines')
      if (!json.ok) throw new Error(json.error || 'Update failed')
      setMsg({ type:'success', text:`Order ${editing.order_id} updated` })
      setEditing(null)
      fetchOrders()
    } catch (e) {
      setMsg({ type:'error', text:e.message })
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Admin — Pending Orders</h1>

      <div className="flex flex-wrap gap-2 items-end mb-4">
        <input className="border rounded px-3 py-2" placeholder="Search (ID or name)" value={term} onChange={e=>setTerm(e.target.value)} />
        <select className="border rounded px-3 py-2" value={payment} onChange={e=>setPayment(e.target.value)}>
          <option value="">All payments</option>
          <option value="Savings">Savings</option>
          <option value="Loan">Loan</option>
          <option value="Cash">Cash</option>
        </select>
        <input className="border rounded px-3 py-2" placeholder="Branch code (e.g. DUTSE)" value={branch} onChange={e=>setBranch(e.target.value)} />
        <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={fetchOrders}>{loading ? 'Loading…' : 'Refresh'}</button>
      </div>

      <div className="flex gap-2 mb-3">
        <button className="px-3 py-1 border rounded" onClick={selectAll}>Select All</button>
        <button className="px-3 py-1 border rounded" onClick={clearSelected}>Clear</button>
        <button className="px-3 py-1 bg-green-600 text-white rounded disabled:opacity-50" disabled={selected.size===0} onClick={postSelected}>
          Post Selected ({selected.size})
        </button>
      </div>

      {msg && <div className={`mb-3 text-sm ${msg.type==='success'?'text-green-700':'text-red-700'}`}>{msg.text}</div>}

      <div className="border rounded divide-y">
        {orders.length === 0 && <div className="p-4 text-gray-600">No Pending orders.</div>}
        {orders.map(o => (
          <div key={o.order_id} className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <input type="checkbox" checked={selected.has(o.order_id)} onChange={() => toggleSelect(o.order_id)} />
              <div className="font-medium">#{o.order_id}</div>
              <div>{new Date(o.created_at).toLocaleString()}</div>
              <div className="ml-2">{o.member_id} — {o.member_name_snapshot}</div>
              <div className="ml-2">Member: {o.member_branch?.name || '-'}</div>
              <div className="ml-2">Delivery: {o.delivery?.name || '-'}</div>
              <div className="ml-2">{o.departments?.name || '-'}</div>
              <div className="ml-2">Payment: <b>{o.payment_option}</b></div>
              <div className="ml-2">Total: ₦{Number(o.total_amount || 0).toLocaleString()}</div>
              <div className="ml-auto flex gap-2">
                <button className="px-3 py-1 border rounded" onClick={() => startEdit(o)}>Edit</button>
                <button className="px-3 py-1 border rounded" onClick={() => doCancel(o.order_id)}>Cancel</button>
                <button className="px-3 py-1 bg-green-600 text-white rounded" onClick={() => doPost(o.order_id)}>Post</button>
                <button className="px-3 py-1 border rounded" onClick={() => doDelete(o.order_id)}>Delete</button>
              </div>
            </div>

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
                {(o.order_lines || []).map(l => (
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
          </div>
        ))}
      </div>

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
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
                      <input type="number" min={0} value={l.qty} onChange={e=>setEditQty(idx, e.target.value)} className="border rounded px-2 py-1 w-20 text-right" />
                    </td>
                    <td className="p-2 border text-right">₦{l.price.toLocaleString()}</td>
                    <td className="p-2 border text-right">₦{(Number(l.qty) * l.price).toLocaleString()}</td>
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