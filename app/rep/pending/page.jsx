// app/rep/pending/page.jsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../contexts/AuthContext'
import ProtectedRoute from '../../components/ProtectedRoute'

function RepPendingPageContent() {
  const [orders, setOrders] = useState([])
  const [dept, setDept] = useState('') // '' = All
  const [departments, setDepartments] = useState([])
  const [msg, setMsg] = useState(null)
  const [nextCursor, setNextCursor] = useState(null)
  const [loading, setLoading] = useState(false)
  const { user, logout } = useAuth()
  const router = useRouter()

  const changeBranch = () => {
    if (confirm('Are you sure you want to change your branch? You will be logged out and redirected to the login page.')) {
      logout()
    }
  }

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
      setMsg({ type:'success', text:`Order ${id} posted successfully` })
    } catch (e) {
      setMsg({ type:'error', text:e.message })
    }
  }

  const editOne = async (id) => {
    // Navigate to edit page or open edit modal
    router.push(`/rep/orders/edit/${id}`)
  }

  const cancelOne = async (id) => {
    if (!confirm(`Cancel order ${id}? This action cannot be undone.`)) return
    try {
      const reason = window.prompt('Reason for cancellation:', '') || 'Cancelled by rep'
      const res = await fetch('/api/rep/orders/cancel', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ orderId:id, reason })
      })
      const j = await res.json()
      if (!res.ok || !j.ok) throw new Error(j.error || 'Failed')
      setOrders(orders.filter(o => o.order_id !== id))
      setMsg({ type:'success', text:`Order ${id} cancelled successfully` })
    } catch (e) {
      setMsg({ type:'error', text:e.message })
    }
  }

  const deleteOne = async (id) => {
    if (!confirm(`Delete order ${id}? This action cannot be undone.`)) return
    try {
      const res = await fetch('/api/rep/orders/delete', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ orderId:id })
      })
      const j = await res.json()
      if (!res.ok || !j.ok) throw new Error(j.error || 'Failed')
      setOrders(orders.filter(o => o.order_id !== id))
      setMsg({ type:'success', text:`Order ${id} deleted successfully` })
    } catch (e) {
      setMsg({ type:'error', text:e.message })
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

  const exportPDF = async () => {
    if (!orders.length) return alert('No rows to export')
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF()
    let y = 12
    doc.setFontSize(14); doc.text('Pending Orders Manifest', 10, y); y += 6
    doc.setFontSize(10); doc.text(`Generated: ${new Date().toLocaleString()}`, 10, y); y += 6
    if (dept) { doc.text(`Department: ${dept}`, 10, y); y += 6 }
    const header = ['Order','Member','Dept','Pay','SKU','Item','Qty']
    doc.text(header.join(' | '), 10, y); y += 4
    doc.line(10, y, 200, y); y += 4
    orders.forEach(o => {
      (o.order_lines || []).forEach(l => {
        const line = [
          String(o.order_id),
          String(o.member_name_snapshot || ''),
          String(o.departments?.name || ''),
          String(o.payment_option || ''),
          String(l.items?.sku || ''),
          String(l.items?.name || ''),
          String(l.qty || 0),
        ].join(' | ')
        doc.text(line, 10, y)
        y += 5
        if (y > 280) { doc.addPage(); y = 12 }
      })
    })
    doc.save('rep_pending_manifest.pdf')
  }

  return (
      <div className="p-6 max-w-6xl mx-auto">

        
        <h1 className="text-2xl font-semibold mb-4">Rep — Pending Orders</h1>
        
        {/* Branch Code Display */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <div>
                <div className="text-sm text-blue-600 font-medium">Current Branch</div>
                <div className="text-lg font-bold text-blue-800">{user?.branchCode || 'Unknown'}</div>
              </div>
            </div>
            <button 
              onClick={changeBranch}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              Change Branch
            </button>
          </div>
        </div>

      <div className="flex flex-wrap gap-2 items-end mb-4">
        <select className="border rounded px-3 py-2" value={dept} onChange={e=>setDept(e.target.value)}>
          <option value="">All departments</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <button className="px-3 py-2 bg-gray-700 text-white rounded" onClick={exportCSV}>Export CSV</button>
        <button className="px-3 py-2 bg-emerald-600 text-white rounded" onClick={exportPDF}>Export PDF</button>
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
                <button className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700" onClick={() => editOne(o.order_id)}>Edit</button>
                <button className="px-3 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700" onClick={() => cancelOne(o.order_id)}>Cancel</button>
                <button className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700" onClick={() => deleteOne(o.order_id)}>Delete</button>
                <button className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700" onClick={() => postOne(o.order_id)}>Post</button>
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

export default function RepPendingPage() {
  return (
    <ProtectedRoute allowedRoles={['rep']}>
      <RepPendingPageContent />
    </ProtectedRoute>
  )
}