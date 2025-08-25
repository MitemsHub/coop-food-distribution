// app/admin/delivered/page.jsx
'use client'

import { useEffect, useState } from 'react'

export default function DeliveredPage() {
  const [orders, setOrders] = useState([])
  const [term, setTerm] = useState('')
  const [branch, setBranch] = useState('')      // DELIVERY branch code (e.g. DUTSE)
  const [payment, setPayment] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const fetchOrders = async () => {
    const qs = new URLSearchParams({
      status: 'Delivered',
      limit: '200',
      ...(term ? { term } : {}),
      ...(payment ? { payment } : {}),
      ...(branch ? { branch } : {}),
    })
    const res = await fetch(`/api/admin/orders/list?${qs}`)
    const json = await res.json()
    if (json.ok) {
      let rows = json.orders || []
      if (from) rows = rows.filter(r => new Date(r.posted_at || r.created_at) >= new Date(from))
      if (to) rows = rows.filter(r => new Date(r.posted_at || r.created_at) <= new Date(to + 'T23:59:59'))
      setOrders(rows)
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
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Admin — Delivered Orders</h1>

      <div className="flex flex-wrap gap-2 items-end mb-4">
        <input className="border rounded px-3 py-2" placeholder="Search (ID or name)" value={term} onChange={e=>setTerm(e.target.value)} />
        <select className="border rounded px-3 py-2" value={payment} onChange={e=>setPayment(e.target.value)}>
          <option value="">All payments</option>
          <option value="Savings">Savings</option>
          <option value="Loan">Loan</option>
          <option value="Cash">Cash</option>
        </select>
        <input className="border rounded px-3 py-2" placeholder="Branch code (e.g. DUTSE)" value={branch} onChange={e=>setBranch(e.target.value)} />
        <label className="text-sm text-gray-600">From</label>
        <input type="date" className="border rounded px-2 py-1" value={from} onChange={e=>setFrom(e.target.value)} />
        <label className="text-sm text-gray-600">To</label>
        <input type="date" className="border rounded px-2 py-1" value={to} onChange={e=>setTo(e.target.value)} />
        <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={fetchOrders}>Refresh</button>
        <button className="px-4 py-2 bg-gray-700 text-white rounded" onClick={exportCSV}>Export CSV</button>
      </div>

      <div className="divide-y border rounded">
        {orders.length === 0 && <div className="p-4 text-gray-600">No Delivered orders.</div>}
        {orders.map(o => (
          <div key={o.order_id} className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="font-medium">#{o.order_id}</div>
              <div>{new Date(o.posted_at || o.created_at).toLocaleString()}</div>
              <div className="ml-2">{o.member_id} — {o.member_name_snapshot}</div>

              {/* Show both branches */}
              <div className="ml-2">Member: {o.member_branch?.name || '-'}</div>
              <div className="ml-2">Delivery: {o.delivery?.name || '-'}</div>

              <div className="ml-2">{o.departments?.name || '-'}</div>
              <div className="ml-2">Payment: <b>{o.payment_option}</b></div>
              <div className="ml-2">Total: ₦{Number(o.total_amount || 0).toLocaleString()}</div>
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