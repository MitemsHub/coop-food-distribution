// app/admin/delivered/page.jsx
'use client'

import { useEffect, useState } from 'react'
import ProtectedRoute from '../../components/ProtectedRoute'

function DeliveredPageContent() {
  const [orders, setOrders] = useState([])
  const [term, setTerm] = useState('')
  const [branch, setBranch] = useState('')      // DELIVERY branch code (e.g. DUTSE)
  const [payment, setPayment] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const safeJson = async (res, label) => {
    const ct = res.headers.get('content-type') || ''
    if (ct.includes('application/json')) return await res.json()
    const text = await res.text()
    throw new Error(`Non-JSON response from ${label} (${res.status}): ${text.slice(0, 300)}`)
  }

  const fetchOrders = async () => {
    const qs = new URLSearchParams({
      status: 'Delivered',
      limit: '200',
      ...(term ? { term } : {}),
      ...(payment ? { payment } : {}),
      ...(branch ? { branch } : {}),
    })
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), 8000)
    try {
      const res = await fetch(`/api/admin/orders/list?${qs}`, { headers:{ 'Accept':'application/json' }, cache:'no-store', signal: ctl.signal })
      const json = await safeJson(res, '/api/admin/orders/list (delivered)')
      if (json.ok) {
        let rows = json.orders || []
        if (from) rows = rows.filter(r => new Date(r.posted_at || r.created_at) >= new Date(from))
        if (to) rows = rows.filter(r => new Date(r.posted_at || r.created_at) <= new Date(to + 'T23:59:59'))
        setOrders(rows)
      }
    } catch (e) {
      setOrders([])
      console.warn('Delivered list fetch error:', e)
    } finally {
      try { clearTimeout(timer) } catch {}
    }
  }

  useEffect(() => { fetchOrders() }, [])

  const exportCSV = () => {
    const rows = orders.flatMap(o => (o.order_lines || []).map(l => ({
      order_id: o.order_id,
      posted_at: o.posted_at,
      member_id: o.member_id,
      member_name: o.member_name_snapshot,
      member_branch: o.member_branch?.name || '',
      delivery_branch: o.delivery?.name || '',
      department: o.departments?.name || '',
      payment: o.payment_option,
      sku: l.items?.sku,
      item: l.items?.name,
      qty: l.qty,
      unit_price: l.unit_price,
      amount: l.amount
    })))
    if (!rows.length) return
    const headers = Object.keys(rows[0])
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => `"${String(r[h] ?? '').replace(/"/g,'""')}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a')
    a.href = url; a.download = 'delivered_orders.csv'; a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
        <h1 className="text-base sm:text-lg md:text-xl font-semibold text-center sm:text-left break-words">Admin — Delivered Orders</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-4">
        <div className="flex gap-2">
          <input className="border rounded px-3 py-2 text-xs sm:text-sm flex-1" placeholder="Search (ID or name)" value={term} onChange={e=>setTerm(e.target.value)} />
          <button className="px-3 py-2 bg-blue-600 text-white rounded text-xs sm:text-sm hover:bg-blue-700 transition-colors" onClick={fetchOrders}>Search</button>
        </div>
        <select className="border rounded px-3 py-2 text-xs sm:text-sm w-full" value={payment} onChange={e=>setPayment(e.target.value)}>
          <option value="">All payments</option>
          <option value="Savings">Savings</option>
          <option value="Loan">Loan</option>
          <option value="Cash">Cash</option>
        </select>
        <div className="flex gap-2">
          <input className="border rounded px-3 py-2 text-xs sm:text-sm flex-1" placeholder="Branch code (e.g. DUTSE)" value={branch} onChange={e=>setBranch(e.target.value)} />
          <button className="px-3 py-2 bg-blue-600 text-white rounded text-xs sm:text-sm hover:bg-blue-700 transition-colors" onClick={fetchOrders}>Filter</button>
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
          Refresh
        </button>
        <button className="px-4 py-2 bg-gray-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-gray-700 transition-colors shadow-sm" onClick={exportCSV}>
          Export CSV
        </button>
      </div>

      <div className="divide-y border rounded">
        {orders.length === 0 && <div className="p-4 text-gray-600">No Delivered orders.</div>}
        {orders.map(o => (
          <div key={o.order_id} className="p-2 sm:p-3 md:p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1 sm:gap-2 md:gap-3 mb-2 sm:mb-3">
              <div className="font-medium text-xs sm:text-sm md:text-base">#{o.order_id}</div>
              <div className="text-xs sm:text-sm text-gray-600">{new Date(o.posted_at || o.created_at).toLocaleString()}</div>
              <div className="text-xs sm:text-sm break-words">{o.member_id} — {o.member_name_snapshot}</div>
              <div className="text-xs sm:text-sm">Member: {o.member_branch?.name || '-'}</div>
              <div className="text-xs sm:text-sm">Delivery: {o.delivery?.name || '-'}</div>
              <div className="text-xs sm:text-sm">{o.departments?.name || '-'}</div>
              <div className="text-xs sm:text-sm">Payment: <b>{o.payment_option}</b></div>
              <div className="text-xs sm:text-sm font-medium">Total: ₦{Number(o.total_amount || 0).toLocaleString()}</div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs border mt-2">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-1 sm:p-2 border text-xs">SKU</th>
                    <th className="text-left p-1 sm:p-2 border text-xs">Item</th>
                    <th className="text-right p-1 sm:p-2 border text-xs">Qty</th>
                    <th className="text-right p-1 sm:p-2 border text-xs">Unit Price</th>
                    <th className="text-right p-1 sm:p-2 border text-xs">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(o.order_lines || []).map(l => (
                    <tr key={l.id}>
                      <td className="p-1 sm:p-2 border text-xs">{l.items?.sku}</td>
                      <td className="p-1 sm:p-2 border text-xs">{l.items?.name}</td>
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

export default function DeliveredPage() {
  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <DeliveredPageContent />
    </ProtectedRoute>
  )
}