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
  const [postingOrder, setPostingOrder] = useState(null) // Track which order is being posted
  const [editing, setEditing] = useState(null)
  const [showModal, setShowModal] = useState(null)
  const [modalInput, setModalInput] = useState('')
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
    setShowModal({ type: 'post', orderId: id, title: 'Post Order', placeholder: 'Optional note for posting (leave blank if none)' })
    setModalInput('')
  }

  const handlePostSubmit = async () => {
    const { orderId } = showModal
    setPostingOrder(orderId)
    try {
      const res = await fetch('/api/rep/orders/post', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ orderId, note: modalInput || '' })
      })
      const j = await res.json()
      if (!res.ok || !j.ok) throw new Error(j.error || 'Failed')
      
      // Refresh data from server instead of just filtering local state
      fetchOrders()
      setMsg({ type:'success', text:`Order ${orderId} posted successfully` })
      setShowModal(null)
      setModalInput('')
    } catch (e) {
      setMsg({ type:'error', text:e.message })
    } finally {
      setPostingOrder(null)
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
      
      // Use batch API to get item IDs efficiently
      const skus = filteredLines.map(l => l.sku)
      const itemsRes = await fetch('/api/items/batch', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skus }),
        cache: 'no-store' 
      })
      const itemsJson = await safeJson(itemsRes, '/api/items/batch')
      if (!itemsJson.ok) throw new Error('Failed to load items: ' + itemsJson.error)
      
      if (itemsJson.missing_count > 0) {
        throw new Error(`Items not found: ${itemsJson.missing_skus.join(', ')}`)
      }
      
      // Convert to the format expected by rep API
      const orderLines = filteredLines.map(l => ({
        item_id: itemsJson.items[l.sku]?.id,
        qty: Number(l.qty)
      }))
      
      // Validate all items were found
      const invalidLines = orderLines.filter(l => !l.item_id)
      if (invalidLines.length > 0) {
        throw new Error('Some items could not be resolved')
      }
      
      const res = await fetch('/api/rep/orders/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: editing.order_id, orderLines })
      })
      const json = await safeJson(res, '/api/rep/orders/update')
      if (!json.ok) throw new Error(json.error || 'Update failed')
      
      setMsg({ type: 'success', text: `Order ${editing.order_id} updated successfully` })
      setEditing(null)
      fetchOrders()
    } catch (e) {
      setMsg({ type: 'error', text: e.message })
    }
  }

  const deleteOne = async (id) => {
    setShowModal({ 
      type: 'delete', 
      orderId: id, 
      title: 'Delete Order', 
      message: `Are you sure you want to delete order ${id}? This action cannot be undone.`,
      placeholder: 'Optional reason for deletion'
    })
    setModalInput('')
  }

  const handleDeleteSubmit = async () => {
    const { orderId } = showModal
    try {
      const res = await fetch('/api/rep/orders/delete', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ orderId, reason: modalInput || 'Deleted by rep' })
      })
      const j = await res.json()
      if (!res.ok || !j.ok) throw new Error(j.error || 'Failed')
      setOrders(orders.filter(o => o.order_id !== orderId))
      setMsg({ type:'success', text:`Order ${orderId} deleted successfully` })
      setShowModal(null)
      setModalInput('')
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

        
        <h1 className="text-lg sm:text-xl md:text-2xl font-semibold mb-4">Rep — Pending Orders</h1>
        
        {/* Branch Code Display */}
        <div className="mb-6 p-3 sm:p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
            <div className="flex items-center">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <div>
                <div className="text-xs sm:text-sm text-blue-600 font-medium">Current Branch</div>
                <div className="text-sm sm:text-lg font-bold text-blue-800">{user?.branchCode || 'Unknown'}</div>
              </div>
            </div>
            <div className="flex justify-start sm:justify-end">
              <button 
                onClick={changeBranch}
                className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center text-xs sm:text-sm whitespace-nowrap"
              >
                <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                Change Branch
              </button>
            </div>
          </div>
        </div>

      <div className="mb-4">
        <div className="mb-3">
          <select className="border rounded px-3 py-2 text-xs sm:text-sm w-full" value={dept} onChange={e=>setDept(e.target.value)}>
            <option value="">All departments</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button className="px-2 py-2 bg-gray-700 text-white rounded text-xs sm:text-sm whitespace-nowrap" onClick={exportCSV}>Export CSV</button>
          <button className="px-2 py-2 bg-emerald-600 text-white rounded text-xs sm:text-sm whitespace-nowrap" onClick={exportPDF}>Export PDF</button>
          <button className="px-2 py-2 bg-blue-600 text-white rounded text-xs sm:text-sm whitespace-nowrap" onClick={()=>fetchOrders(true)}>{loading ? 'Loading…' : 'Refresh'}</button>
        </div>
      </div>

      {msg && <div className={`mb-3 text-sm ${msg.type==='error'?'text-red-700':'text-green-700'}`}>{msg.text}</div>}

      <div className="border rounded divide-y">
        {orders.length === 0 && <div className="p-4 text-gray-600">No Pending orders.</div>}
        {orders.map(o => (
          <div key={o.order_id} className="p-3 sm:p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-3">
              <div className="font-medium text-xs sm:text-sm">#{o.order_id}</div>
              <div className="text-xs sm:text-sm">{new Date(o.created_at).toLocaleString()}</div>
              <div className="text-xs sm:text-sm">{o.member_id} — {o.member_name_snapshot}</div>
              <div className="text-xs sm:text-sm">Member: {o.member_branch?.name || '-'}</div>
              <div className="text-xs sm:text-sm">Delivery: {o.delivery?.name || '-'}</div>
              <div className="text-xs sm:text-sm">{o.departments?.name || '-'}</div>
              <div className="text-xs sm:text-sm">Payment: <b>{o.payment_option}</b></div>
              <div className="text-xs sm:text-sm font-medium">Total: ₦{Number(o.total_amount || 0).toLocaleString()}</div>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {/* Edit and Delete buttons disabled for reps - only admin can perform these actions */}
              {/* <button className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs sm:text-sm whitespace-nowrap" onClick={() => startEdit(o)}>Edit</button> */}
              {/* <button className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs sm:text-sm whitespace-nowrap" onClick={() => deleteOne(o.order_id)}>Delete</button> */}
              <button 
                className={`px-3 py-1 rounded text-xs sm:text-sm whitespace-nowrap transition-all duration-200 ${
                  postingOrder === o.order_id 
                    ? 'bg-gray-400 text-white cursor-not-allowed' 
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
                onClick={() => postOne(o.order_id)}
                disabled={postingOrder === o.order_id}
              >
                {postingOrder === o.order_id ? (
                  <div className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-1 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Posting...
                  </div>
                ) : (
                  'Post'
                )}
              </button>
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
      
      {/* Modal for input prompts */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">{showModal.title}</h3>
            <p className="text-gray-600 mb-4">
              {showModal.message || (
                showModal.type === 'post' 
                  ? `Post order ${showModal.orderId}? This will make it available for delivery.`
                  : `Process order ${showModal.orderId}?`
              )}
            </p>
            <input
              type="text"
              value={modalInput}
              onChange={(e) => setModalInput(e.target.value)}
              placeholder={showModal.placeholder}
              className="w-full p-2 border rounded mb-4"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowModal(null)
                  setModalInput('')
                }}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (showModal.type === 'post') {
                    handlePostSubmit()
                  } else if (showModal.type === 'delete') {
                    handleDeleteSubmit()
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                {showModal.type === 'post' ? 'Post Order' : showModal.type === 'delete' ? 'Delete Order' : 'Confirm'}
              </button>
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