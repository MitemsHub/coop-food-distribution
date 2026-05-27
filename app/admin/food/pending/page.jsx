// app/admin/pending/page.jsx
'use client'
import { useEffect, useMemo, useState, useRef } from 'react'
import ProtectedRoute from '../../../components/ProtectedRoute'
import DraggableModal from '../../../components/DraggableModal'

export function FoodOrdersAdminPageContent({ status = 'Pending' }) {
  const [orders, setOrders] = useState([])
  const [branches, setBranches] = useState([])
  const [term, setTerm] = useState('')
  const [payment, setPayment] = useState('')
  const [deliveryBranch, setDeliveryBranch] = useState('')
  const [memberCategory, setMemberCategory] = useState('')
  const [msg, setMsg] = useState(null)
  const [loading, setLoading] = useState(false)
  const [pageSize, setPageSize] = useState(50)
  const [cursorStack, setCursorStack] = useState([null])
  const [pageIndex, setPageIndex] = useState(0)
  const [nextCursor, setNextCursor] = useState(null)
  const [summary, setSummary] = useState(null)
  const [postingOrder, setPostingOrder] = useState(null) // Track which order is being posted
  const [postingBulk, setPostingBulk] = useState(false) // Track bulk posting
  const [savingEdit, setSavingEdit] = useState(false) // Track edit saving
  const [selected, setSelected] = useState(new Set())
  const [editing, setEditing] = useState(null)
  const [showModal, setShowModal] = useState(null)
  const [modalInput, setModalInput] = useState('')
  const [cancellingOrder, setCancellingOrder] = useState(false)
  const [restoringOrders, setRestoringOrders] = useState(false)
  const [viewing, setViewing] = useState(null)
  const fetchCtl = useRef(null)
  // Draggable modal now handled by reusable component

  const safeJson = async (res, label) => {
    const ct = res.headers.get('content-type') || ''
    if (ct.includes('application/json')) return await res.json()
    const text = await res.text()
    throw new Error(`Non-JSON response from ${label} (${res.status}): ${text.slice(0, 300)}`)
  }

  useEffect(() => {
    const loadBranches = async () => {
      try {
        const res = await fetch('/api/branches/list', { cache: 'no-store' })
        const json = await safeJson(res, '/api/branches/list')
        if (json?.ok) setBranches(Array.isArray(json.branches) ? json.branches : [])
      } catch {
        setBranches([])
      }
    }
    loadBranches()
  }, [])

  const normalizeMemberCategory = (raw) => {
    const s = String(raw || '').trim().toLowerCase()
    if (!s) return ''
    if (s === 'a' || s.includes('active')) return 'A'
    if (s === 'r' || s.includes('retire')) return 'R'
    if (s === 'p' || s.includes('pension')) return 'P'
    if (s === 'e' || s.includes('staff')) return 'E'
    return ''
  }

  const fetchOrders = async (cursorOverride, overrides = null) => {
    setLoading(true); setMsg(null)
    try {
      if (fetchCtl.current) fetchCtl.current.abort()
      const ctl = new AbortController()
      fetchCtl.current = ctl
      const effTerm = overrides && typeof overrides.term === 'string' ? overrides.term : term
      const effPayment = overrides && typeof overrides.payment === 'string' ? overrides.payment : payment
      const effDeliveryBranch = overrides && typeof overrides.deliveryBranch === 'string' ? overrides.deliveryBranch : deliveryBranch
      const effMemberCategory = overrides && typeof overrides.memberCategory === 'string' ? overrides.memberCategory : memberCategory
      const cursor = cursorOverride !== undefined ? cursorOverride : cursorStack[pageIndex] || null
      const qs = new URLSearchParams({
        status,
        limit: String(pageSize),
        ...(effTerm ? { term: effTerm } : {}),
        ...(effPayment ? { payment: effPayment } : {}),
      })
      if (status === 'Cancelled') {
        if (effDeliveryBranch) qs.set('branch', String(effDeliveryBranch).trim().toUpperCase())
        const cat = normalizeMemberCategory(effMemberCategory)
        if (cat) qs.set('member_category', cat)
      }
      if (cursor) qs.set('cursor', String(cursor))
      const res = await fetch(`/api/admin/food/orders/list?${qs.toString()}`, { cache: 'no-store', signal: ctl.signal })
      const json = await safeJson(res, '/api/admin/food/orders/list')
      if (!json.ok) throw new Error(json.error || 'Failed to load')
      setOrders(json.orders || [])
      setNextCursor(json.nextCursor || null)
      setSummary(json.summary || null)
      setSelected(new Set())
    } catch (e) {
      if (e.name === 'AbortError') {
        // Ignore aborted fetches triggered by navigation or refresh
      } else {
        setMsg({ type:'error', text:e.message })
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchOrders(null) }, []) // first load

  const resetPagination = () => {
    setCursorStack([null])
    setPageIndex(0)
    setNextCursor(null)
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

  const handleSearch = () => {
    resetPagination()
    fetchOrders(null)
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const money = (n) => `₦${Number(n || 0).toLocaleString()}`
  const orderQty = (o) => (o?.order_lines || []).reduce((s, l) => s + Number(l?.qty || 0), 0)

  const fetchAllForExport = async () => {
    if (status !== 'Pending') return []
    const all = []
    let cursor = null
    let guard = 0
    while (guard < 200) {
      guard += 1
      const qs = new URLSearchParams({
        status,
        limit: '1000',
        ...(term ? { term } : {}),
        ...(payment ? { payment } : {}),
      })
      if (cursor) qs.set('cursor', String(cursor))
      const res = await fetch(`/api/admin/food/orders/list?${qs.toString()}`, { cache: 'no-store' })
      const json = await safeJson(res, '/api/admin/food/orders/list (export)')
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Failed to load orders for export')
      const chunk = json.orders || []
      all.push(...chunk)
      if (!json.nextCursor) break
      cursor = json.nextCursor
    }
    return all
  }

  // Actions with prompts
  const doPost = async (order_id) => {
    if (status !== 'Pending') return
    setShowModal({ type: 'post', orderId: order_id, title: 'Post Order', placeholder: 'Optional note for posting (leave blank if none)' })
    setModalInput('')
  }

  const handlePostSubmit = async () => {
    const { orderId } = showModal
    setPostingOrder(orderId)
    try {
      const ctl = new AbortController()
      const timer = setTimeout(() => ctl.abort(), 8000)
      const res = await fetch('/api/admin/food/orders/post', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', 'Accept':'application/json' },
        body: JSON.stringify({ orderId, adminId:'admin@coop', adminNote: modalInput || '' }),
        signal: ctl.signal
      })
      const json = await safeJson(res, '/api/admin/food/orders/post')
      if (!json.ok) throw new Error(json.error || 'Post failed')
      setMsg({ type:'success', text:`Order ${orderId} posted` })
      fetchOrders(); setSelected(new Set())
      setModalInput('')
    } catch (e) {
      if (e.name === 'AbortError') {
        setMsg({ type:'error', text:'Post timed out after 8s. Please check network and try again.' })
      } else {
        setMsg({ type:'error', text:e.message })
      }
    } finally {
      try { clearTimeout(timer) } catch {}
      setPostingOrder(null)
      setShowModal(null)
    }
  }

  const postSelected = async () => {
    if (status !== 'Pending') return
    if (selected.size === 0) return
    setShowModal({ type: 'bulk-post', orderIds: Array.from(selected), title: 'Bulk Post Orders', placeholder: 'Optional note for posting these orders' })
    setModalInput('')
  }

  const handleBulkPostSubmit = async () => {
    const { orderIds } = showModal
    setPostingBulk(true)
    try {
      // Use optimized bulk post API
      const ctl = new AbortController()
      const timer = setTimeout(() => ctl.abort(), 8000)
      const res = await fetch('/api/admin/food/orders/post-bulk', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', 'Accept':'application/json' },
        body: JSON.stringify({ orderIds, adminId:'admin@coop' }),
        signal: ctl.signal
      })
      const json = await safeJson(res, '/api/admin/food/orders/post-bulk')
      if (!json.ok) throw new Error(json.error || 'Bulk post failed')

      // Handle admin notes for successfully posted orders
      if (modalInput && Array.isArray(json.posted) && json.posted.length > 0) {
        // Update admin notes in parallel for better performance
        const notePromises = json.posted.map(id =>
          fetch('/api/admin/food/orders/post', {
            method:'POST',
            headers:{ 'Content-Type':'application/json', 'Accept':'application/json' },
            body: JSON.stringify({ orderId:id, adminId:'admin@coop', adminNote: modalInput })
          })
        )
        await Promise.all(notePromises)
      }

      // Show detailed results
      let message = `Posted ${json.posted?.length || 0} order(s)`
      if (json.failed?.length > 0) {
        const reasons = json.failed.slice(0, 5).map(f => `#${f.order_id}: ${f.error}`).join('; ')
        message += `, ${json.failed.length} failed — ${reasons}`
      }

      setMsg({ type:'success', text: message })
      fetchOrders(); setSelected(new Set())
      setModalInput('')
    } catch (e) {
      if (e.name === 'AbortError') {
        setMsg({ type:'error', text:'Bulk post timed out after 8s. Please check network and try again.' })
      } else {
        setMsg({ type:'error', text:e.message })
      }
    } finally {
      try { clearTimeout(timer) } catch {}
      setPostingBulk(false)
      setShowModal(null)
    }
  }

  const openCancelModal = async (orderIds) => {
    const ids = (Array.isArray(orderIds) ? orderIds : []).filter((n) => Number.isFinite(Number(n)) && Number(n) > 0).map((n) => Number(n))
    if (!ids.length) return
    setShowModal({ 
      type: 'cancel', 
      orderIds: ids,
      title: ids.length > 1 ? 'Cancel Orders' : 'Cancel Order', 
      message: ids.length > 1
        ? `Cancel ${ids.length} order(s)? Cancelled orders will be excluded from reports and exports.`
        : `Cancel order ${ids[0]}? Cancelled orders will be excluded from reports and exports.`,
      placeholder: 'Optional reason for cancellation'
    })
    setModalInput('')
  }

  const doCancel = async (order_id) => {
    if (status !== 'Pending') return
    openCancelModal([order_id])
  }

  const cancelSelected = async () => {
    if (status !== 'Pending') return
    if (selected.size === 0) return
    openCancelModal(Array.from(selected))
  }

  const handleCancelSubmit = async () => {
    const ids = Array.isArray(showModal?.orderIds) ? showModal.orderIds : []
    if (!ids.length) return
    setCancellingOrder(true)
    try {
      const res = await fetch('/api/admin/food/orders/cancel', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ orderIds: ids, reason: modalInput || 'Cancelled by admin' })
      })
      const json = await safeJson(res, '/api/admin/food/orders/cancel')
      if (!json.ok) throw new Error(json.error || 'Cancel failed')
      const cancelled = Array.isArray(json.cancelled) ? json.cancelled : []
      setMsg({ type:'success', text: `Cancelled ${cancelled.length} order(s)` })
      fetchOrders(); setSelected(new Set())
      setShowModal(null)
      setModalInput('')
    } catch (e) {
      setMsg({ type:'error', text:e.message })
    } finally {
      setCancellingOrder(false)
    }
  }

  const openRestoreModal = async (orderIds) => {
    const ids = (Array.isArray(orderIds) ? orderIds : []).filter((n) => Number.isFinite(Number(n)) && Number(n) > 0).map((n) => Number(n))
    if (!ids.length) return
    setShowModal({
      type: 'restore',
      orderIds: ids,
      title: ids.length > 1 ? 'Restore Orders' : 'Restore Order',
      message: ids.length > 1
        ? `Restore ${ids.length} order(s) back to Pending?`
        : `Restore order ${ids[0]} back to Pending?`,
      placeholder: 'Optional note (not saved)'
    })
    setModalInput('')
  }

  const doRestore = async (order_id) => {
    if (status !== 'Cancelled') return
    openRestoreModal([order_id])
  }

  const restoreSelected = async () => {
    if (status !== 'Cancelled') return
    if (selected.size === 0) return
    openRestoreModal(Array.from(selected))
  }

  const handleRestoreSubmit = async () => {
    const ids = Array.isArray(showModal?.orderIds) ? showModal.orderIds : []
    if (!ids.length) return
    setRestoringOrders(true)
    try {
      const res = await fetch('/api/admin/food/orders/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIds: ids }),
      })
      const json = await safeJson(res, '/api/admin/food/orders/restore')
      if (!json.ok) throw new Error(json.error || 'Restore failed')
      const restored = Array.isArray(json.restored) ? json.restored : []
      setMsg({ type: 'success', text: `Restored ${restored.length} order(s)` })
      fetchOrders()
      setSelected(new Set())
      setShowModal(null)
      setModalInput('')
    } catch (e) {
      setMsg({ type: 'error', text: e.message })
    } finally {
      setRestoringOrders(false)
    }
  }

  // Edit modal logic (unchanged)
  const startEdit = (o) => {
    if (status !== 'Pending') return
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
    setSavingEdit(true)
    try {
      const payload = editing.lines.filter(l => Number(l.qty) > 0).map(l => ({ sku: l.sku, qty: Number(l.qty) }))
      if (!payload.length) throw new Error('At least one line qty > 0 required')
      const res = await fetch('/api/admin/food/orders/update-lines', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ orderId: editing.order_id, lines: payload })
      })
      const json = await safeJson(res, '/api/admin/food/orders/update-lines')
      if (!json.ok) throw new Error(json.error || 'Update failed')
      setMsg({ type:'success', text:`Order ${editing.order_id} updated` })
      setEditing(null)
      fetchOrders()
    } catch (e) {
      setMsg({ type:'error', text:e.message })
    } finally {
      setSavingEdit(false)
    }
  }

  const exportExcel = async () => {
    const srcOrders = await fetchAllForExport().catch(() => [])
    const rows = srcOrders.flatMap((o) => (o.order_lines || []).map((l) => ({
      order_id: o.order_id,
      created_at: o.created_at,
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
      amount: l.amount,
    })))
    if (!rows.length) { alert('No rows to export') ; return }
    const ExcelJSMod = await import('exceljs')
    const ExcelJS = ExcelJSMod?.default ?? ExcelJSMod
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Pending')

    const headers = Object.keys(rows[0])
    ws.addRow(['Food Distribution — Pending Orders (Admin)'])
    ws.addRow([`Search: ${term || 'All'} | Payment: ${payment || 'All'}`])
    ws.addRow(headers)
    for (const r of rows) ws.addRow(headers.map((h) => r[h]))

    const buffer = await wb.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `admin_food_pending_${new Date().toISOString().split('T')[0]}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Export PDF manifest including Unit Price and Amount
  const exportPDF = async () => {
    const srcOrders = await fetchAllForExport().catch(() => [])
    if (!srcOrders.length) {
      alert('No rows to export')
      return
    }
    const { jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

    const sanitize = (s) => String(s ?? '').replace(/\u20A6|₦/g, 'NGN ').replace(/[\u2013\u2014]/g, '-')

    doc.setFontSize(14)
    doc.text('Pending Orders Manifest (Admin)', 12, 12)
    doc.setFontSize(9)
    doc.text(`Generated: ${new Date().toLocaleString()}`, 12, 18)
    doc.text(`Search: ${term || 'All'}  |  Payment: ${payment || 'All'}`, 12, 24)

    const headers = ['Order', 'Member', 'Dept', 'Pay', 'SKU', 'Item', 'Qty', 'Unit Price', 'Amount']
    const rows = srcOrders.flatMap((o) =>
      (o.order_lines || []).map((l) => [
        sanitize(o.order_id),
        sanitize(o.member_name_snapshot || ''),
        sanitize(o.departments?.name || ''),
        sanitize(o.payment_option || ''),
        sanitize(l.items?.sku || ''),
        sanitize(l.items?.name || ''),
        String(l.qty || 0),
        `NGN ${Number(l.unit_price || 0).toLocaleString()}`,
        `NGN ${Number(l.amount || 0).toLocaleString()}`,
      ])
    )

    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: 30,
      margin: { top: 28, left: 10, right: 10 },
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 1.5, overflow: 'linebreak', lineWidth: 0.1, lineColor: [0, 0, 0] },
      headStyles: { fillColor: [75, 85, 99], textColor: [255, 255, 255], fontSize: 9 },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      columnStyles: {
        0: { cellWidth: 14 }, // Order
        1: { cellWidth: 40 }, // Member
        2: { cellWidth: 28 }, // Dept
        3: { cellWidth: 16 }, // Pay
        4: { cellWidth: 20 }, // SKU
        5: { cellWidth: 58 }, // Item
        6: { cellWidth: 12, halign: 'right' }, // Qty
        7: { cellWidth: 24, halign: 'right' }, // Unit Price
        8: { cellWidth: 26, halign: 'right' }, // Amount
      },
    })

    doc.save(`admin_pending_manifest_${new Date().toISOString().split('T')[0]}.pdf`)
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h1 className="text-base sm:text-lg md:text-xl font-semibold break-words">Admin — Food Distribution — {status}</h1>
      </div>

      {!!msg && (
        <div
          className={`mb-4 rounded-lg border p-3 text-sm ${
            msg.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'
          }`}
        >
          {msg.text}
        </div>
      )}

      <div className="ui-card p-4 mb-4">
        <div className="flex flex-col gap-2">
          <div className="flex flex-col lg:flex-row gap-2 lg:items-center lg:justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <input
                className="w-full max-w-[420px] min-w-0 border-2 border-gray-200 rounded-xl px-3 py-2 text-xs sm:text-sm bg-white"
                placeholder="Search (Order / Member / Branch)"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                onKeyDown={handleKeyPress}
              />
              <button
                type="button"
                className="shrink-0 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs sm:text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
                onClick={handleSearch}
                disabled={loading}
              >
                Search
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                className="border-2 border-gray-200 rounded-xl px-3 py-2 text-xs sm:text-sm bg-white"
                value={payment}
                onChange={(e) => {
                  const next = e.target.value
                  setPayment(next)
                  resetPagination()
                  fetchOrders(null, { payment: next })
                }}
                disabled={loading}
              >
                <option value="">All payments</option>
                <option value="Savings">Savings</option>
                <option value="Loan">Loan</option>
                <option value="Cash">Cash</option>
              </select>

              {status === 'Cancelled' && (
                <>
                  <select
                    className="border-2 border-gray-200 rounded-xl px-3 py-2 text-xs sm:text-sm bg-white"
                    value={deliveryBranch}
                    onChange={(e) => {
                      const next = e.target.value
                      setDeliveryBranch(next)
                      resetPagination()
                      fetchOrders(null, { deliveryBranch: next })
                    }}
                    disabled={loading}
                  >
                    <option value="">All delivery branches</option>
                    {(branches || []).map((b) => (
                      <option key={b.code} value={String(b.code || '').toUpperCase()}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                  <input
                    className="border-2 border-gray-200 rounded-xl px-3 py-2 text-xs sm:text-sm bg-white"
                    placeholder="Member category (e.g. Pensioner)"
                    value={memberCategory}
                    onChange={(e) => {
                      const next = e.target.value
                      setMemberCategory(next)
                      resetPagination()
                      fetchOrders(null, { memberCategory: next })
                    }}
                    disabled={loading}
                  />
                </>
              )}

              {status === 'Pending' && (
                <>
                  <button
                    type="button"
                    className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-800 text-white text-xs sm:text-sm font-semibold disabled:opacity-50"
                    onClick={() => exportExcel().catch((e) => setMsg({ type: 'error', text: e?.message || 'Export failed' }))}
                    disabled={loading || !orders.length}
                  >
                    Download Excel
                  </button>

                  <button
                    type="button"
                    className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-semibold disabled:opacity-50"
                    onClick={() => exportPDF().catch((e) => setMsg({ type: 'error', text: e?.message || 'Export failed' }))}
                    disabled={loading || !orders.length}
                  >
                    Download PDF
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="mt-3 text-xs sm:text-sm text-gray-600">
          Orders: {summary?.count ?? orders.length} · Total: {money(summary?.totalAmount ?? 0)} · Selected: {selected.size}
        </div>
      </div>

      <div className="ui-card overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold">{status} Orders</div>
            <button
              type="button"
              className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs sm:text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-2"
              onClick={() => fetchOrders(null)}
              disabled={loading}
            >
              {loading && (
                <svg className="animate-spin h-3.5 w-3.5 text-gray-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              )}
              <span>{loading ? 'Loading…' : 'Refresh'}</span>
            </button>
            <button
              type="button"
              className="px-3 py-1.5 rounded-lg border text-xs sm:text-sm bg-white hover:bg-gray-50 disabled:opacity-50"
              onClick={selectAll}
              disabled={loading || !orders.length}
            >
              {selected.size === orders.length && orders.length > 0 ? 'Deselect All' : 'Select All'}
            </button>
            {status === 'Pending' && (
              <button
                className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs sm:text-sm font-semibold disabled:opacity-50"
                disabled={selected.size === 0 || postingBulk}
                onClick={postSelected}
              >
                {postingBulk ? 'Posting…' : `Post Selected (${selected.size})`}
              </button>
            )}
            {status === 'Pending' ? (
              <button
                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-semibold disabled:opacity-50"
                disabled={selected.size === 0 || cancellingOrder}
                onClick={cancelSelected}
              >
                {cancellingOrder ? 'Cancelling…' : `Cancel Selected (${selected.size})`}
              </button>
            ) : (
              <button
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold disabled:opacity-50"
                disabled={selected.size === 0 || restoringOrders}
                onClick={restoreSelected}
              >
                {restoringOrders ? 'Restoring…' : `Restore Selected (${selected.size})`}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <select
              className="border rounded px-2 py-1 text-xs sm:text-sm bg-white"
              value={pageSize}
              onChange={(e) => {
                const next = Number(e.target.value) || 50
                setPageSize(next)
                resetPagination()
                fetchOrders(null)
              }}
              disabled={loading}
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>

            <button
              type="button"
              className="px-3 py-1.5 rounded border text-xs sm:text-sm bg-white hover:bg-gray-50 disabled:opacity-50"
              onClick={() => {
                if (pageIndex <= 0) return
                const nextIndex = pageIndex - 1
                const prevCursor = cursorStack[nextIndex] || null
                setPageIndex(nextIndex)
                setSelected(new Set())
                fetchOrders(prevCursor)
              }}
              disabled={pageIndex <= 0 || loading}
            >
              Prev
            </button>
            <div className="text-xs sm:text-sm text-gray-700">Page {pageIndex + 1}</div>
            <button
              type="button"
              className="px-3 py-1.5 rounded border text-xs sm:text-sm bg-white hover:bg-gray-50 disabled:opacity-50"
              onClick={() => {
                if (!nextCursor) return
                const nextIndex = pageIndex + 1
                const nextStack = cursorStack.slice(0, pageIndex + 1).concat([nextCursor])
                setCursorStack(nextStack)
                setPageIndex(nextIndex)
                setSelected(new Set())
                fetchOrders(nextCursor)
              }}
              disabled={!nextCursor || loading}
            >
              Next
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-xs sm:text-sm">
            <thead className="bg-white sticky top-0 z-10">
              <tr className="text-left border-b">
                <th className="p-3 w-10">
                  <input
                    type="checkbox"
                    checked={orders.length > 0 && selected.size === orders.length}
                    onChange={selectAll}
                    disabled={loading || !orders.length}
                    className="h-4 w-4"
                  />
                </th>
                <th className="p-3">Order</th>
                <th className="p-3">Member</th>
                <th className="p-3">Delivery</th>
                <th className="p-3">Payment</th>
                <th className="p-3 text-right">Qty</th>
                <th className="p-3 text-right">Total + Int</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    <td className="p-3">
                      <div className="h-4 w-4 bg-gray-100 rounded animate-pulse" />
                    </td>
                    <td className="p-3">
                      <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
                      <div className="mt-2 h-3 w-32 bg-gray-100 rounded animate-pulse" />
                    </td>
                    <td className="p-3">
                      <div className="h-4 w-40 bg-gray-100 rounded animate-pulse" />
                    </td>
                    <td className="p-3">
                      <div className="h-4 w-36 bg-gray-100 rounded animate-pulse" />
                    </td>
                    <td className="p-3">
                      <div className="h-4 w-16 bg-gray-100 rounded animate-pulse" />
                    </td>
                    <td className="p-3 text-right">
                      <div className="ml-auto h-4 w-10 bg-gray-100 rounded animate-pulse" />
                    </td>
                    <td className="p-3 text-right">
                      <div className="ml-auto h-4 w-20 bg-gray-100 rounded animate-pulse" />
                    </td>
                    <td className="p-3 text-right">
                      <div className="ml-auto h-8 w-24 bg-gray-100 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-gray-600">
                    No {status} orders.
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.order_id} className="border-b hover:bg-gray-50/40">
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={selected.has(o.order_id)}
                        onChange={() => toggleSelect(o.order_id)}
                        className="h-4 w-4"
                      />
                    </td>
                    <td className="p-3">
                      <div className="font-medium">#{o.order_id}</div>
                      <div className="text-gray-500 text-xs">{new Date(o.created_at).toLocaleString()}</div>
                      {status === 'Cancelled' ? (
                        <>
                          <div className="text-gray-500 text-xs">
                            Cancelled: {o.cancelled_at ? new Date(o.cancelled_at).toLocaleString() : '—'}
                          </div>
                          <div className="text-gray-500 text-xs break-words">
                            Reason: {String(o.cancelled_reason || '').trim() || '—'}
                          </div>
                        </>
                      ) : null}
                    </td>
                    <td className="p-3">
                      <div className="font-medium">{o.member_id}</div>
                      <div className="text-gray-600">{o.member_name_snapshot}</div>
                      <div className="text-gray-500 text-xs">{o.member_branch?.name || '-'}</div>
                    </td>
                    <td className="p-3">
                      <div className="text-gray-900">{o.delivery?.name || '-'}</div>
                      <div className="text-gray-500 text-xs">{o.departments?.name || '-'}</div>
                    </td>
                    <td className="p-3">{o.payment_option}</td>
                    <td className="p-3 text-right">{orderQty(o)}</td>
                    <td className="p-3 text-right font-medium">{money(o.total_amount)}</td>
                    <td className="p-3 text-right">
                      <select
                        className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs sm:text-sm bg-white disabled:opacity-50"
                        defaultValue=""
                        onChange={(e) => {
                          const v = e.target.value
                          e.target.value = ''
                          if (v === 'view') setViewing(o)
                          if (v === 'edit') startEdit(o)
                          if (v === 'post') doPost(o.order_id)
                          if (v === 'cancel') doCancel(o.order_id)
                          if (v === 'restore') doRestore(o.order_id)
                        }}
                        disabled={loading}
                      >
                        <option value="" disabled>
                          Actions
                        </option>
                        <option value="view">View items</option>
                        {status === 'Pending' ? (
                          <>
                            <option value="edit">Edit</option>
                            <option value="post">Post</option>
                            <option value="cancel">Cancel</option>
                          </>
                        ) : (
                          <option value="restore">Restore</option>
                        )}
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit modal (consistent draggable style) */}
      {editing && (
        <DraggableModal
          open={!!editing}
          title={`Edit Order #${editing.order_id}`}
          onClose={() => setEditing(null)}
          overlayClassName="bg-white/10 backdrop-blur-sm"
          widthClass="max-w-2xl w-full mx-4"
          footer={(
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setEditing(null)}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                className={`px-4 py-2 rounded text-white ${savingEdit ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                onClick={saveEdit}
                disabled={savingEdit}
              >
                {savingEdit ? (
                  <div className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-1 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </div>
                ) : 'Save'}
              </button>
            </div>
          )}
        >
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
          <div className="flex items-center justify-end gap-2">
            <div className="text-xs sm:text-sm text-gray-600">New Total</div>
            <div className="text-lg sm:text-xl font-semibold">₦{editedTotal.toLocaleString()}</div>
          </div>
        </DraggableModal>
      )}
      
      {/* Modal for input prompts */}
      {showModal && (
        <DraggableModal
          open={!!showModal}
          title={showModal.title}
          onClose={() => { setShowModal(null); setModalInput('') }}
          overlayClassName="bg-white/10 backdrop-blur-sm"
          footer={(
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowModal(null); setModalInput('') }}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={
                  showModal.type === 'post'
                    ? handlePostSubmit
                    : showModal.type === 'bulk-post'
                      ? handleBulkPostSubmit
                      : showModal.type === 'cancel'
                        ? handleCancelSubmit
                        : handleRestoreSubmit
                }
                className={`px-4 py-2 rounded text-white ${
                  showModal.type === 'post'
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : showModal.type === 'bulk-post'
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : showModal.type === 'cancel'
                        ? 'bg-red-600 hover:bg-red-700'
                        : 'bg-blue-600 hover:bg-blue-700'
                }`}
                disabled={
                  showModal.type === 'post'
                    ? postingOrder === showModal.orderId
                    : showModal.type === 'bulk-post'
                      ? postingBulk
                      : showModal.type === 'cancel'
                        ? cancellingOrder
                        : restoringOrders
                }
              >
                {showModal.type === 'post' ? (
                  postingOrder === showModal.orderId ? (
                    <div className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-1 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Posting...
                    </div>
                  ) : 'Post Order'
                ) : showModal.type === 'bulk-post' ? (
                  postingBulk ? (
                    <div className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-1 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Posting...
                    </div>
                  ) : 'Post Orders'
                ) : showModal.type === 'cancel' ? (
                  cancellingOrder ? (
                    <div className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-1 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Cancelling...
                    </div>
                  ) : 'Cancel'
                ) : (
                  restoringOrders ? (
                    <div className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-1 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Restoring...
                    </div>
                  ) : 'Restore'
                )}
              </button>
            </div>
          )}
        >
          <p className="text-gray-600 mb-4">
            {showModal.message ||
              (showModal.type === 'post'
                ? `Post order ${showModal.orderId}?`
                : showModal.type === 'bulk-post'
                  ? `Post ${showModal.orderIds?.length || 0} order(s)?`
                  : showModal.type === 'cancel'
                    ? `Cancel ${showModal.orderIds?.length || 0} order(s)?`
                    : `Restore ${showModal.orderIds?.length || 0} order(s)?`)}
          </p>
          <input
            type="text"
            value={modalInput}
            onChange={(e) => setModalInput(e.target.value)}
            placeholder={showModal.placeholder}
            className="w-full p-2 border rounded"
            autoFocus
          />
        </DraggableModal>
      )}
      <DraggableModal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing ? `Order #${viewing.order_id} items` : 'Order items'}
        widthClass="max-w-4xl w-full mx-4"
      >
        <div className="max-h-[60vh] overflow-auto">
          <table className="w-full text-xs sm:text-sm border min-w-[560px]">
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
              {(viewing?.order_lines || []).map((l) => (
                <tr key={l.id}>
                  <td className="p-2 border font-mono text-xs break-all">{l.items?.sku}</td>
                  <td className="p-2 border break-words min-w-[220px]">{l.items?.name}</td>
                  <td className="p-2 border text-right whitespace-nowrap">{l.qty}</td>
                  <td className="p-2 border text-right whitespace-nowrap">{money(l.unit_price)}</td>
                  <td className="p-2 border text-right whitespace-nowrap">{money(l.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DraggableModal>
    </div>
  )
}

export default function PendingAdminPage() {
  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <FoodOrdersAdminPageContent status="Pending" />
    </ProtectedRoute>
  )
}
