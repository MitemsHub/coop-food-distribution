// app/admin/pending/page.jsx
'use client'
import { useEffect, useMemo, useState } from 'react'
import ProtectedRoute from '../../components/ProtectedRoute'

function PendingAdminPageContent() {
  const [orders, setOrders] = useState([])
  const [term, setTerm] = useState('')
  const [payment, setPayment] = useState('')
  const [branch, setBranch] = useState('')
  const [msg, setMsg] = useState(null)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [editing, setEditing] = useState(null)
  const [showModal, setShowModal] = useState(null)
  const [modalInput, setModalInput] = useState('')

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
  const selectAll = () => {
    if (selected.size === orders.length) {
      // If all are selected, deselect all
      setSelected(new Set())
    } else {
      // Otherwise, select all
      setSelected(new Set(orders.map(o => o.order_id)))
    }
  }

  const handleSearch = () => {
    fetchOrders()
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  // Actions with prompts
  const doPost = async (order_id) => {
    setShowModal({ type: 'post', orderId: order_id, title: 'Post Order', placeholder: 'Optional note for posting (leave blank if none)' })
    setModalInput('')
  }

  const handlePostSubmit = async () => {
    const { orderId } = showModal
    try {
      const res = await fetch('/api/admin/orders/post', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ orderId, adminId:'admin@coop', adminNote: modalInput || '' })
      })
      const json = await safeJson(res, '/api/admin/orders/post')
      if (!json.ok) throw new Error(json.error || 'Post failed')
      setMsg({ type:'success', text:`Order ${orderId} posted` })
      fetchOrders(); setSelected(new Set())
      setShowModal(null)
      setModalInput('')
    } catch (e) {
      setMsg({ type:'error', text:e.message })
    }
  }

  const postSelected = async () => {
    if (selected.size === 0) return
    setShowModal({ type: 'bulk-post', orderIds: Array.from(selected), title: 'Bulk Post Orders', placeholder: 'Optional note for posting these orders' })
    setModalInput('')
  }

  const handleBulkPostSubmit = async () => {
    const { orderIds } = showModal
    try {
      // First post in bulk
      const res = await fetch('/api/admin/orders/post-bulk', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ orderIds, adminId:'admin@coop' })
      })
      const json = await safeJson(res, '/api/admin/orders/post-bulk')
      if (!json.ok) throw new Error(json.error || 'Bulk post failed')

      // Then patch admin_note for posted ones if provided
      if (modalInput && Array.isArray(json.posted)) {
        await Promise.all(json.posted.map(id =>
          fetch('/api/admin/orders/post', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ orderId:id, adminId:'admin@coop', adminNote: modalInput })
          })
        ))
      }

      setMsg({ type:'success', text:`Posted ${json.posted?.length || 0} order(s)` })
      fetchOrders(); setSelected(new Set())
      setShowModal(null)
      setModalInput('')
    } catch (e) {
      setMsg({ type:'error', text:e.message })
    }
  }

  const doDelete = async (order_id) => {
    setShowModal({ 
      type: 'delete', 
      orderId: order_id, 
      title: 'Delete Order', 
      message: `Are you sure you want to delete order ${order_id}? This action cannot be undone.`,
      placeholder: 'Optional reason for deletion'
    })
    setModalInput('')
  }

  const handleDeleteSubmit = async () => {
    const { orderId } = showModal
    try {
      const res = await fetch('/api/admin/orders/delete', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ orderId, reason: modalInput || 'Deleted by admin' })
      })
      const json = await safeJson(res, '/api/admin/orders/delete')
      if (!json.ok) throw new Error(json.error || 'Delete failed')
      setMsg({ type:'success', text:`Order ${orderId} deleted` })
      fetchOrders(); setSelected(new Set())
      setShowModal(null)
      setModalInput('')
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
    <ProtectedRoute allowedRoles={['admin']}>
      <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
        <h1 className="text-base sm:text-lg md:text-xl font-semibold text-center sm:text-left break-words">Admin — Pending Orders</h1>

      </div>

      <div className="flex flex-col gap-3 mb-4">
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
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs sm:text-sm hover:bg-blue-700 transition-colors shadow-sm" onClick={fetchOrders}>{loading ? 'Loading…' : 'Refresh'}</button>
        <button className="px-4 py-2 bg-gray-600 text-white rounded-lg text-xs sm:text-sm hover:bg-gray-700 transition-colors shadow-sm" onClick={selectAll}>{selected.size === orders.length && orders.length > 0 ? 'Deselect All' : 'Select All'}</button>
        <button className="px-4 py-2 bg-green-600 text-white rounded-lg disabled:opacity-50 text-xs sm:text-sm hover:bg-green-700 transition-colors shadow-sm" disabled={selected.size===0} onClick={postSelected}>
          Post Selected ({selected.size})
        </button>
      </div>

      {msg && <div className={`mb-3 text-sm ${msg.type==='success'?'text-green-700':'text-red-700'}`}>{msg.text}</div>}

      <div className="border rounded divide-y">
        {orders.length === 0 && <div className="p-4 text-gray-600 text-center">No Pending orders.</div>}
        {orders.map(o => (
          <div key={o.order_id} className="p-3 sm:p-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                <input type="checkbox" checked={selected.has(o.order_id)} onChange={() => toggleSelect(o.order_id)} />
                <div className="font-medium text-sm sm:text-base">#{o.order_id}</div>
                <div className="text-xs sm:text-sm text-gray-600">{new Date(o.created_at).toLocaleString()}</div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs sm:text-sm">
                <div><span className="font-medium">Member:</span> {o.member_id} — {o.member_name_snapshot}</div>
                <div><span className="font-medium">Branch:</span> {o.member_branch?.name || '-'}</div>
                <div><span className="font-medium">Delivery:</span> {o.delivery?.name || '-'}</div>
                <div><span className="font-medium">Department:</span> {o.departments?.name || '-'}</div>
                <div><span className="font-medium">Payment:</span> <b>{o.payment_option}</b></div>
                <div><span className="font-medium">Total:</span> ₦{Number(o.total_amount || 0).toLocaleString()}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="px-2 py-1 sm:px-3 sm:py-1 bg-blue-600 text-white rounded text-xs sm:text-sm hover:bg-blue-700" onClick={() => startEdit(o)}>Edit</button>

                <button className="px-2 py-1 sm:px-3 sm:py-1 bg-green-600 text-white rounded text-xs sm:text-sm hover:bg-green-700" onClick={() => doPost(o.order_id)}>Post</button>
                <button className="px-2 py-1 sm:px-3 sm:py-1 bg-red-600 text-white rounded text-xs sm:text-sm hover:bg-red-700" onClick={() => doDelete(o.order_id)}>Delete</button>
              </div>
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

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-2xl rounded p-3 sm:p-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base sm:text-lg font-semibold">Edit Order #{editing.order_id}</h3>
              <button onClick={() => setEditing(null)} className="px-2 text-lg">✕</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm border mb-3">
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
                      <td className="p-1 sm:p-2 border text-xs">{l.sku}</td>
                      <td className="p-1 sm:p-2 border text-xs break-words">{l.name}</td>
                      <td className="p-1 sm:p-2 border text-right">
                        <input type="number" min={0} value={l.qty} onChange={e=>setEditQty(idx, e.target.value)} className="border rounded px-1 py-1 w-16 sm:w-20 text-right text-xs" />
                      </td>
                      <td className="p-1 sm:p-2 border text-right text-xs">₦{l.price.toLocaleString()}</td>
                      <td className="p-1 sm:p-2 border text-right text-xs">₦{(Number(l.qty) * l.price).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="sm:ml-auto text-center sm:text-right">
                <div className="text-xs sm:text-sm text-gray-600">New Total</div>
                <div className="text-lg sm:text-xl font-semibold">₦{editedTotal.toLocaleString()}</div>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <button className="flex-1 sm:flex-none px-3 py-2 border rounded text-sm" onClick={() => setEditing(null)}>Cancel</button>
                <button className="flex-1 sm:flex-none px-3 py-2 bg-blue-600 text-white rounded text-sm" onClick={saveEdit}>Save</button>
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
              {showModal.type === 'delete'
                ? showModal.message
                : showModal.type === 'post'
                ? `Post order ${showModal.orderId}?`
                : `Post ${showModal.orderIds?.length || 0} order(s)?`
              }
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
                 onClick={showModal.type === 'post' ? handlePostSubmit : showModal.type === 'delete' ? handleDeleteSubmit : handleBulkPostSubmit}
                 className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
               >
                 {showModal.type === 'post' ? 'Post Order' : showModal.type === 'delete' ? 'Delete Order' : 'Post Orders'}
               </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </ProtectedRoute>
  )
}

export default function PendingAdminPage() {
  return <PendingAdminPageContent />
}