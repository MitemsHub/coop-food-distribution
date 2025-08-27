// app/rep/pending/page.jsx
'use client'

import { useEffect, useState, useMemo } from 'react'
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
  const [selected, setSelected] = useState(new Set())
  const [editing, setEditing] = useState(null)
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

  const safeJson = async (res, label) => {
    const ct = res.headers.get('content-type') || ''
    if (ct.includes('application/json')) return await res.json()
    const text = await res.text()
    throw new Error(`Non-JSON response from ${label} (${res.status}): ${text.slice(0, 300)}`)
  }

  const fetchOrders = async (reset = true) => {
    setLoading(true); setMsg(null)
    try {
      const qs = new URLSearchParams({ status:'Pending', limit:'50' })
      if (dept) qs.set('dept', dept)
      if (!reset && nextCursor) { qs.set('cursor', nextCursor); qs.set('dir', 'next') }
      const res = await fetch(`/api/rep/orders/list?${qs.toString()}`, { cache:'no-store' })
      const json = await safeJson(res, '/api/rep/orders/list')
      if (!json.ok) throw new Error(json.error || 'Failed')
      setOrders(reset ? (json.orders || []) : [...orders, ...(json.orders || [])])
      setNextCursor(json.nextCursor || null)
    } catch (e) {
      setMsg({ type:'error', text:e.message })
    } finally {
      setLoading(false)
    }
  }

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
      const res = await fetch('/api/rep/orders/post', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ orderId: order_id, note: adminNote })
      })
      const json = await safeJson(res, '/api/rep/orders/post')
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
    const adminNote = window.prompt('Optional note for posting these orders:', '') || ''
    try {
      for (const orderId of selected) {
        const res = await fetch('/api/rep/orders/post', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ orderId, note: adminNote })
        })
        const json = await safeJson(res, '/api/rep/orders/post')
        if (!json.ok) throw new Error(json.error || 'Post failed')
      }
      setMsg({ type:'success', text:`Posted ${selected.size} order(s)` })
      fetchOrders(); clearSelected()
    } catch (e) {
      setMsg({ type:'error', text:e.message })
    }
  }

  const doCancel = async (order_id) => {
    const reason = window.prompt('Enter cancel reason:', '')
    if (reason === null) return // user aborted
    try {
      const res = await fetch('/api/rep/orders/cancel', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ orderId: order_id, reason })
      })
      const json = await safeJson(res, '/api/rep/orders/cancel')
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
      const res = await fetch('/api/rep/orders/delete', {
        method:'DELETE',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ orderId: order_id })
      })
      const json = await safeJson(res, '/api/rep/orders/delete')
      if (!json.ok) throw new Error(json.error || 'Delete failed')
      setMsg({ type:'success', text:`Order ${order_id} deleted` })
      fetchOrders(); clearSelected()
    } catch (e) {
      setMsg({ type:'error', text:e.message })
    }
  }

  // Edit modal logic
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
      const res = await fetch('/api/rep/orders/update-lines', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ orderId: editing.order_id, lines: payload })
      })
      const json = await safeJson(res, '/api/rep/orders/update-lines')
      if (!json.ok) throw new Error(json.error || 'Update failed')
      setMsg({ type:'success', text:`Order ${editing.order_id} updated` })
      setEditing(null)
      fetchOrders()
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

      <div className="flex gap-2 mb-3">
        <button className="px-3 py-1 border rounded" onClick={selectAll}>Select All</button>
        <button className="px-3 py-1 border rounded" onClick={clearSelected}>Clear</button>
        <button className="px-3 py-1 bg-green-600 text-white rounded disabled:opacity-50" disabled={selected.size===0} onClick={postSelected}>
          Post Selected ({selected.size})
        </button>
      </div>

      {msg && <div className={`mb-3 text-sm ${msg.type==='error'?'text-red-700':'text-green-700'}`}>{msg.text}</div>}

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

      {nextCursor && (
        <div className="mt-4">
          <button className="px-3 py-2 border rounded" onClick={() => fetchOrders(false)}>
            {loading ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}

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

export default function RepPendingPage() {
  return (
    <ProtectedRoute allowedRoles={['rep']}>
      <RepPendingPageContent />
    </ProtectedRoute>
  )
}