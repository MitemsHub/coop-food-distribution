// app/admin/posted/page.jsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import ProtectedRoute from '../../components/ProtectedRoute'

function PostedAdminPageContent() {
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

  const handleSearch = () => {
    fetchOrders()
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectAll = () => {
    if (selected.size === orders.length) {
      // If all are selected, deselect all
      setSelected(new Set())
    } else {
      // Otherwise, select all
      setSelected(new Set(orders.map(o => o.order_id)))
    }
  }

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
    <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
        <h1 className="text-base sm:text-lg md:text-xl font-semibold text-center sm:text-left break-words">Admin — Posted Orders</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-4">
        <div className="flex gap-2">
          <input className="border rounded px-3 py-2 text-xs sm:text-sm flex-1" placeholder="Search (ID or name)" value={term} onChange={e=>setTerm(e.target.value)} onKeyPress={handleKeyPress} />
          <button className="px-3 py-2 bg-blue-600 text-white rounded text-xs sm:text-sm hover:bg-blue-700 transition-colors" onClick={handleSearch}>Search</button>
        </div>
        <select className="border rounded px-3 py-2 text-xs sm:text-sm w-full" value={payment} onChange={e=>setPayment(e.target.value)}>
          <option value="">All payments</option>
          <option value="Savings">Savings</option>
          <option value="Loan">Loan</option>
          <option value="Cash">Cash</option>
        </select>
        <div className="flex gap-2">
          <input className="border rounded px-3 py-2 text-xs sm:text-sm flex-1" placeholder="Branch code (e.g. DUTSE)" value={branch} onChange={e=>setBranch(e.target.value)} onKeyPress={handleKeyPress} />
          <button className="px-3 py-2 bg-blue-600 text-white rounded text-xs sm:text-sm hover:bg-blue-700 transition-colors" onClick={handleSearch}>Filter</button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <label className="text-xs sm:text-sm text-gray-600 whitespace-nowrap">From</label>
            <input type="date" className="border rounded px-2 py-1 text-xs sm:text-sm flex-1" value={from} onChange={e=>setFrom(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs sm:text-sm text-gray-600 whitespace-nowrap">To</label>
            <input type="date" className="border rounded px-2 py-1 text-xs sm:text-sm flex-1" value={to} onChange={e=>setTo(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm" onClick={fetchOrders}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
        <button className="px-4 py-2 bg-gray-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-gray-700 transition-colors shadow-sm" onClick={selectAll}>
          {selected.size === orders.length && orders.length > 0 ? 'Deselect All' : 'Select All'}
        </button>
        <button className="px-4 py-2 bg-emerald-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm" disabled={selected.size===0} onClick={deliverSelected}>
          Deliver Selected ({selected.size})
        </button>
        <button className="px-4 py-2 bg-gray-700 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-gray-800 transition-colors shadow-sm" onClick={exportCSV}>
          Export CSV
        </button>
      </div>

      {msg && <div className={`mb-3 text-xs sm:text-sm ${msg.type==='success'?'text-green-700':'text-red-700'}`}>{msg.text}</div>}

      <div className="divide-y border rounded-lg">
        {orders.length === 0 && <div className="p-4 text-xs sm:text-sm text-gray-600">No Posted orders.</div>}
        {orders.map(o => (
          <div key={o.order_id} className="p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-3">
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                <input type="checkbox" checked={selected.has(o.order_id)} onChange={()=>toggleSelect(o.order_id)} className="w-4 h-4" />
                <div className="font-medium text-xs sm:text-sm">#{o.order_id}</div>
                <div className="text-xs text-gray-600">{new Date(o.posted_at || o.created_at).toLocaleString()}</div>
              </div>
              <div className="flex justify-end sm:ml-auto">
                <button className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm whitespace-nowrap" onClick={() => deliverOne(o.order_id)}>Deliver</button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-3">
              <div className="text-xs break-words">{o.member_id} — {o.member_name_snapshot}</div>
              <div className="text-xs">Member: {o.member_branch?.name || '-'}</div>
              <div className="text-xs">Delivery: {o.delivery?.name || '-'}</div>
              <div className="text-xs">{o.departments?.name || '-'}</div>
              <div className="text-xs">Payment: <b>{o.payment_option}</b></div>
              <div className="text-xs font-medium">Total: ₦{Number(o.total_amount || 0).toLocaleString()}</div>
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs sm:text-sm border">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-1 sm:p-2 border">SKU</th>
                    <th className="text-left p-1 sm:p-2 border">Item</th>
                    <th className="text-right p-1 sm:p-2 border">Qty</th>
                    <th className="text-right p-1 sm:p-2 border">Unit Price</th>
                    <th className="text-right p-1 sm:p-2 border">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(o.order_lines || []).map(l => (
                    <tr key={l.id}>
                      <td className="p-1 sm:p-2 border text-xs">{l.items?.sku}</td>
                      <td className="p-1 sm:p-2 border text-xs break-words">{l.items?.name}</td>
                      <td className="p-1 sm:p-2 border text-right text-xs">{l.qty}</td>
                      <td className="p-1 sm:p-2 border text-right text-xs">₦{Number(l.unit_price).toLocaleString()}</td>
                      <td className="p-1 sm:p-2 border text-right text-xs">₦{Number(l.amount).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function PostedAdminPage() {
  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <PostedAdminPageContent />
    </ProtectedRoute>
  )
}