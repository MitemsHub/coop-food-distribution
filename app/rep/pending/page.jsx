// app/rep/pending/page.jsx
'use client'

import { useEffect, useState } from 'react'

export default function RepPendingPage() {
  const [orders, setOrders] = useState([])
  const [dept, setDept] = useState('') // '' = All
  const [departments, setDepartments] = useState([])
  const [msg, setMsg] = useState(null)
  const [nextCursor, setNextCursor] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Load department list once
    ;(async () => {
      try {
        const res = await fetch('/api/departments/list', { cache: 'no-store' })
        const j = await res.json()
        if (j?.ok) setDepartments(j.departments || [])
      } catch {}
    })()
  }, [])

  useEffect(() => {
    fetchOrders(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dept])

  const fetchOrders = async (reset = true) => {
    setLoading(true); setMsg(null)
    try {
      const qs = new URLSearchParams({ status:'Pending', limit:'50' })
      if (dept) qs.set('dept', dept)
      if (!reset && nextCursor) { qs.set('cursor', nextCursor); qs.set('dir', 'next') }
      const res = await fetch(`/api/rep/orders/list?${qs.toString()}`, { cache:'no-store' })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || 'Failed')
      setOrders(reset ? (json.orders || []) : [...orders, ...(json.orders || [])])
      setNextCursor(json.nextCursor || null)
    } catch (e) {
      setMsg({ type:'error', text:e.message })
    } finally {
      setLoading(false)
    }
  }

  const postOne = async (id) => {
    if (!confirm(`Post order ${id}?`)) return
    try {
      // optional note for reps
      const adminNote = window.prompt('Optional note for posting (leave blank if none):', '') || ''
      const res = await fetch('/api/rep/orders/post', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ orderId:id, note: adminNote })
      })
      const j = await res.json()
      if (!res.ok || !j.ok) throw new Error(j.error || 'Failed')
      setOrders(orders.filter(o => o.order_id !== id))
    } catch (e) {
      alert(e.message)
    }
  }

  const exportCSV = () => {
    const rows = orders.flatMap(o => (o.order_lines || []).map(l => ({
      order_id:o.order_id, created_at:o.created_at, member:o.member_name_snapshot,
      member_branch:o.member_branch?.name||'', delivery:o.delivery?.name||'',
      department:o.departments?.name||'', payment:o.payment_option,
      sku:l.items?.sku, item:l.items?.name, qty:l.qty, unit_price:l.unit_price, amount:l.amount
    })))
    if (rows.length === 0) return alert('No rows to export')
    const headers = Object.keys(rows[0])
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => `"${String(r[h] ?? '').replace(/"/g,'""')}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a')
    a.href = url; a.download = 'rep_pending.csv'; a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Rep — Pending Orders</h1>

      <div className="flex flex-wrap gap-2 items-end mb-4">
        <select className="border rounded px-3 py-2" value={dept} onChange={e=>setDept(e.target.value)}>
          <option value="">All departments</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <button className="px-3 py-2 bg-gray-700 text-white rounded" onClick={exportCSV}>Export CSV</button>
        <button className="px-3 py-2 bg-blue-600 text-white rounded" onClick={()=>fetchOrders(true)}>{loading ? 'Loading…' : 'Refresh'}</button>
      </div>

      {msg && <div className={`mb-3 text-sm ${msg.type==='error'?'text-red-700':'text-green-700'}`}>{msg.text}</div>}

      <div className="border rounded divide-y">
        {orders.length === 0 && <div className="p-4 text-gray-600">No Pending orders.</div>}
        {orders.map(o => (
          <div key={o.order_id} className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="font-medium">#{o.order_id}</div>
              <div>{new Date(o.created_at).toLocaleString()}</div>
              <div className="ml-2">{o.member_id} — {o.member_name_snapshot}</div>
              <div className="ml-2">Member: {o.member_branch?.name || '-'}</div>
              <div className="ml-2">Delivery: {o.delivery?.name || '-'}</div>
              <div className="ml-2">{o.departments?.name || '-'}</div>
              <div className="ml-2">Payment: <b>{o.payment_option}</b></div>
              <div className="ml-2">Total: ₦{Number(o.total_amount || 0).toLocaleString()}</div>
              <div className="ml-auto flex gap-2">
                <button className="px-3 py-1 bg-green-600 text-white rounded" onClick={() => postOne(o.order_id)}>Post</button>
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

      {nextCursor && (
        <div className="mt-4">
          <button className="px-3 py-2 border rounded" onClick={() => fetchOrders(false)}>
            {loading ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  )
}