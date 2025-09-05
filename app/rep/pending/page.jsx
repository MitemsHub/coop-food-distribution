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

  const safeJson = async (res, label) => {
    const ct = res.headers.get('content-type') || ''
    if (ct.includes('application/json')) return await res.json()
    const text = await res.text()
    throw new Error(`Non-JSON response from ${label} (${res.status}): ${text.slice(0, 300)}`)
  }

  // Edit modal logic (same as admin)
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
      const filteredLines = editing.lines.filter(l => Number(l.qty) > 0)
      if (!filteredLines.length) throw new Error('At least one line qty > 0 required')
      
      // Get item_ids for the SKUs
      const itemsRes = await fetch('/api/items/list', { cache: 'no-store' })
      const itemsJson = await safeJson(itemsRes, '/api/items/list')
      if (!itemsJson.ok) throw new Error('Failed to load items')
      
      const itemsMap = new Map()
      itemsJson.items.forEach(item => {
        itemsMap.set(item.sku, item.item_id)
      })
      
      // Convert to the format expected by rep API
      const orderLines = filteredLines.map(l => {
        const item_id = itemsMap.get(l.sku)
        if (!item_id) throw new Error(`Item not found: ${l.sku}`)
        return {
          item_id,
          qty: Number(l.qty)
          // Note: unit_price is no longer sent - server will validate and use correct price
        }
      })
      
      const res = await fetch('/api/rep/orders/update', {
        method:'PUT',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ orderId: editing.order_id, orderLines })
      })
      const json = await safeJson(res, '/api/rep/orders/update')
      if (!json.ok) throw new Error(json.error || 'Update failed')
      setMsg({ type:'success', text:`Order ${editing.order_id} updated` })
      setEditing(null)
      fetchOrders(true)
    } catch (e) {
      setMsg({ type:'error', text:e.message })
    }
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
      <div className="p-3 sm:p-6 max-w-6xl mx-auto">

        
        <h1 className="text-xl sm:text-2xl font-semibold mb-4">Rep — Pending Orders</h1>
        
        {/* Branch Code Display */}
        <div className="mb-6 p-3 sm:p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
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
              className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center text-sm sm:text-base whitespace-nowrap"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              Change Branch
            </button>
          </div>
        </div>

      <div className="flex flex-col sm:flex-row flex-wrap gap-2 items-stretch sm:items-end mb-4">
        <select className="border rounded px-3 py-2 text-sm sm:text-base w-full sm:w-auto" value={dept} onChange={e=>setDept(e.target.value)}>
          <option value="">All departments</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <button className="px-3 py-2 bg-gray-700 text-white rounded text-sm sm:text-base whitespace-nowrap" onClick={exportCSV}>Export CSV</button>
        <button className="px-3 py-2 bg-emerald-600 text-white rounded text-sm sm:text-base whitespace-nowrap" onClick={exportPDF}>Export PDF</button>
        <button className="px-3 py-2 bg-blue-600 text-white rounded text-sm sm:text-base whitespace-nowrap" onClick={()=>fetchOrders(true)}>{loading ? 'Loading…' : 'Refresh'}</button>
      </div>

      {msg && <div className={`mb-3 text-sm ${msg.type==='error'?'text-red-700':'text-green-700'}`}>{msg.text}</div>}

      <div className="border rounded divide-y">
        {orders.length === 0 && <div className="p-4 text-gray-600">No Pending orders.</div>}
        {orders.map(o => (
          <div key={o.order_id} className="p-3 sm:p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-3">
              <div className="font-medium text-sm sm:text-base">#{o.order_id}</div>
              <div className="text-sm sm:text-base">{new Date(o.created_at).toLocaleString()}</div>
              <div className="text-sm sm:text-base">{o.member_id} — {o.member_name_snapshot}</div>
              <div className="text-sm sm:text-base">Member: {o.member_branch?.name || '-'}</div>
              <div className="text-sm sm:text-base">Delivery: {o.delivery?.name || '-'}</div>
              <div className="text-sm sm:text-base">{o.departments?.name || '-'}</div>
              <div className="text-sm sm:text-base">Payment: <b>{o.payment_option}</b></div>
              <div className="text-sm sm:text-base font-medium">Total: ₦{Number(o.total_amount || 0).toLocaleString()}</div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <button className="px-3 py-1 border rounded text-sm whitespace-nowrap" onClick={() => startEdit(o)}>Edit</button>
              <button className="px-3 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-sm whitespace-nowrap" onClick={() => cancelOne(o.order_id)}>Cancel</button>
              <button className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm whitespace-nowrap" onClick={() => deleteOne(o.order_id)}>Delete</button>
              <button className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm whitespace-nowrap" onClick={() => postOne(o.order_id)}>Post</button>
            </div>

            <div className="overflow-x-auto mt-2">
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
                      <td className="p-1 sm:p-2 border">{l.items?.sku}</td>
                      <td className="p-1 sm:p-2 border">{l.items?.name}</td>
                      <td className="p-1 sm:p-2 border text-right">{l.qty}</td>
                      <td className="p-1 sm:p-2 border text-right">₦{Number(l.unit_price).toLocaleString()}</td>
                      <td className="p-1 sm:p-2 border text-right">₦{Number(l.amount).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-3">
          <div className="bg-white w-full max-w-2xl rounded p-3 sm:p-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base sm:text-lg font-semibold">Edit Order #{editing.order_id}</h3>
              <button onClick={() => setEditing(null)} className="px-2 text-lg">✕</button>
            </div>
            <div className="overflow-x-auto mb-3">
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
                  {editing.lines.map((l, idx) => (
                    <tr key={l.sku}>
                      <td className="p-1 sm:p-2 border">{l.sku}</td>
                      <td className="p-1 sm:p-2 border">{l.name}</td>
                      <td className="p-1 sm:p-2 border text-right">
                        <input type="number" min={0} value={l.qty} onChange={e=>setEditQty(idx, e.target.value)} className="border rounded px-2 py-1 w-16 sm:w-20 text-right text-xs sm:text-sm" />
                      </td>
                      <td className="p-1 sm:p-2 border text-right">₦{l.price.toLocaleString()}</td>
                      <td className="p-1 sm:p-2 border text-right">₦{(Number(l.qty) * l.price).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="sm:ml-auto text-center sm:text-right">
                <div className="text-sm text-gray-600">New Total</div>
                <div className="text-lg sm:text-xl font-semibold">₦{editedTotal.toLocaleString()}</div>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <button className="flex-1 sm:flex-none px-4 py-2 border rounded text-sm" onClick={() => setEditing(null)}>Cancel</button>
                <button className="flex-1 sm:flex-none px-4 py-2 bg-blue-600 text-white rounded text-sm" onClick={saveEdit}>Save</button>
              </div>
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