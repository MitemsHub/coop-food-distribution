// app/admin/posted/page.jsx
'use client'

import { useEffect, useMemo, useState } from 'react'

export default function PostedAdminPage() {
  const [orders, setOrders] = useState([])
  const [msg, setMsg] = useState(null)
  const [term, setTerm] = useState('')
  const [branch, setBranch] = useState('')
  const [payment, setPayment] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [loading, setLoading] = useState(false)

  const safeJson = async (res, label) => {
    const ct = res.headers.get('content-type') || ''
    if (ct.includes('application/json')) return await res.json()
    const text = await res.text()
    throw new Error(`Non-JSON response from ${label} (${res.status}): ${text.slice(0, 300)}`)
  }

  const fetchOrders = async () => {
    setLoading(true); setMsg(null)
    try {
      const qs = new URLSearchParams({ status:'Posted', limit:'200' })
      if (term) qs.set('term', term)
      if (payment) qs.set('payment', payment)
      if (branch) qs.set('branch', branch)
      const res = await fetch(`/api/admin/orders/list?${qs.toString()}`, { cache:'no-store' })
      const json = await safeJson(res, '/api/admin/orders/list')
      if (!json.ok) throw new Error(json.error || 'Failed')
      setOrders(json.orders || [])
    } catch (e) {
      setMsg({ type:'error', text:e.message })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchOrders() }, [])

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  const selectAll = () => setSelected(new Set(orders.map(o => o.order_id)))
  const clearSelected = () => setSelected(new Set())

  const deliverOne = async (order_id) => {
    const deliveredBy = window.prompt('Delivered by (name or rep):', 'rep')
    if (deliveredBy === null) return
    try {
      const res = await fetch('/api/admin/orders/deliver', {
        method:'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ orderId: order_id, adminId:'admin@coop', deliveredBy })
      })
      const json = await safeJson(res, '/api/admin/orders/deliver')
      if (!json.ok) throw new Error(json.error || 'Deliver failed')
      setMsg({ type:'success', text:`Order ${order_id} marked Delivered` })
      setOrders(orders.filter(o => o.order_id !== order_id))
      clearSelected()
    } catch (e) {
      setMsg({ type:'error', text:e.message })
    }
  }

  const deliverSelected = async () => {
    if (selected.size === 0) return
    const deliveredBy = window.prompt('Delivered by (name or rep) for selected:', 'rep')
    if (deliveredBy === null) return
    try {
      for (const id of selected) {
        await fetch('/api/admin/orders/deliver', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ orderId:id, adminId:'admin@coop', deliveredBy })
        })
      }
      setMsg({ type:'success', text:`Delivered ${selected.size} order(s)` })
      fetchOrders(); clearSelected()
    } catch (e) {
      setMsg({ type:'error', text:e.message })
    }
  }

  const exportCSV = () => {
    const rows = orders.flatMap(o => (o.order_lines || []).map(l => ({
      order_id:o.order_id, posted_at:o.posted_at, member:o.member_name_snapshot,
      member_branch:o.member_branch?.name||'', delivery:o.delivery?.name||'',
      department:o.departments?.name||'', payment:o.payment_option,
      sku:l.items?.sku, item:l.items?.name, qty:l.qty, unit_price:l.unit_price, amount:l.amount
    })))
    const headers = Object.keys(rows[0] || { order_id:'', posted_at:'', member:'', member_branch:'', delivery:'', department:'', payment:'', sku:'', item:'', qty:'', unit_price:'', amount:'' })
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => `"${String(r[h] ?? '').replace(/"/g,'""')}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a')
    a.href = url; a.download = 'posted_orders.csv'; a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Admin — Posted Orders</h1>

      <div className="flex flex-wrap gap-2 items-end mb-4">
        <input className="border rounded px-3 py-2" placeholder="Search (ID or name)" value={term} onChange={e=>setTerm(e.target.value)} />
        <select className="border rounded px-3 py-2" value={payment} onChange={e=>setPayment(e.target.value)}>
          <option value="">All payments</option>
          <option value="Savings">Savings</option>
          <option value="Loan">Loan</option>
          <option value="Cash">Cash</option>
        </select>
        <input className="border rounded px-3 py-2" placeholder="Branch code (e.g. DUTSE)" value={branch} onChange={e=>setBranch(e.target.value)} />
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">From</label>
          <input type="date" className="border rounded px-2 py-1" value={from} onChange={e=>setFrom(e.target.value)} />
          <label className="text-sm text-gray-600">To</label>
          <input type="date" className="border rounded px-2 py-1" value={to} onChange={e=>setTo(e.target.value)} />
        </div>
        <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={fetchOrders}>{loading ? 'Loading…' : 'Refresh'}</button>
        <button className="px-4 py-2 bg-gray-700 text-white rounded" onClick={exportCSV}>Export CSV</button>
      </div>

      <div className="flex gap-2 mb-3">
        <button className="px-3 py-1 border rounded" onClick={selectAll}>Select All</button>
        <button className="px-3 py-1 border rounded" onClick={clearSelected}>Clear</button>
        <button className="px-3 py-1 bg-emerald-600 text-white rounded disabled:opacity-50" disabled={selected.size===0} onClick={deliverSelected}>
          Deliver Selected ({selected.size})
        </button>
      </div>

      {msg && <div className={`mb-3 text-sm ${msg.type==='success'?'text-green-700':'text-red-700'}`}>{msg.text}</div>}

      <div className="divide-y border rounded">
        {orders.length === 0 && <div className="p-4 text-gray-600">No Posted orders.</div>}
        {orders.map(o => (
          <div key={o.order_id} className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <input type="checkbox" checked={selected.has(o.order_id)} onChange={()=>toggleSelect(o.order_id)} />
              <div className="font-medium">#{o.order_id}</div>
              <div>{new Date(o.posted_at || o.created_at).toLocaleString()}</div>
              <div className="ml-2">{o.member_id} — {o.member_name_snapshot}</div>
              <div className="ml-2">Member: {o.member_branch?.name || '-'}</div>
              <div className="ml-2">Delivery: {o.delivery?.name || '-'}</div>
              <div className="ml-2">{o.departments?.name || '-'}</div>
              <div className="ml-2">Payment: <b>{o.payment_option}</b></div>
              <div className="ml-2">Total: ₦{Number(o.total_amount || 0).toLocaleString()}</div>
              <div className="ml-auto flex gap-2">
                <button className="px-3 py-1 bg-emerald-600 text-white rounded" onClick={() => deliverOne(o.order_id)}>Deliver</button>
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
    </div>
  )
}