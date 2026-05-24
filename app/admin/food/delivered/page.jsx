'use client'

import { useEffect, useRef, useState } from 'react'
import ProtectedRoute from '../../../components/ProtectedRoute'
import DraggableModal from '../../../components/DraggableModal'

function DeliveredPageContent() {
  const [orders, setOrders] = useState([])
  const [msg, setMsg] = useState(null)
  const [term, setTerm] = useState('')
  const [payment, setPayment] = useState('')
  const [pageSize, setPageSize] = useState(50)
  const [cursorStack, setCursorStack] = useState([null])
  const [pageIndex, setPageIndex] = useState(0)
  const [nextCursor, setNextCursor] = useState(null)
  const [summary, setSummary] = useState(null)
  const [selected, setSelected] = useState(new Set())
  const [loading, setLoading] = useState(false)
  const [rollingBack, setRollingBack] = useState(false)
  const [showModal, setShowModal] = useState(null)
  const [modalInput, setModalInput] = useState('')
  const [viewing, setViewing] = useState(null)
  const fetchCtl = useRef(null)

  const safeJson = async (res, label) => {
    const ct = res.headers.get('content-type') || ''
    if (ct.includes('application/json')) return await res.json()
    const text = await res.text()
    throw new Error(`Non-JSON response from ${label} (${res.status}): ${text.slice(0, 300)}`)
  }

  const money = (n) => `₦${Number(n || 0).toLocaleString()}`
  const orderQty = (o) => (o?.order_lines || []).reduce((s, l) => s + Number(l?.qty || 0), 0)

  const fetchOrders = async (cursorOverride) => {
    setLoading(true)
    setMsg(null)
    try {
      if (fetchCtl.current) fetchCtl.current.abort()
      const ctl = new AbortController()
      fetchCtl.current = ctl
      const cursor = cursorOverride !== undefined ? cursorOverride : cursorStack[pageIndex] || null
      const qs = new URLSearchParams({ status: 'Delivered', limit: String(pageSize) })
      if (term) qs.set('term', term)
      if (payment) qs.set('payment', payment)
      if (cursor) qs.set('cursor', String(cursor))
      const res = await fetch(`/api/admin/food/orders/list?${qs.toString()}`, { headers: { Accept: 'application/json' }, cache: 'no-store', signal: ctl.signal })
      const json = await safeJson(res, '/api/admin/food/orders/list (delivered)')
      if (!res.ok || !json.ok) throw new Error(json.error || 'Failed to load')
      setOrders(json.orders || [])
      setNextCursor(json.nextCursor || null)
      setSummary(json.summary || null)
      setSelected(new Set())
    } catch (e) {
      if (e?.name !== 'AbortError') setMsg({ type: 'error', text: e?.message || 'Failed to load' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders(null)
    return () => {
      if (fetchCtl.current) fetchCtl.current.abort()
    }
  }, [])

  const resetPagination = () => {
    setCursorStack([null])
    setPageIndex(0)
    setNextCursor(null)
  }

  const handleSearch = () => {
    resetPagination()
    fetchOrders(null)
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') handleSearch()
  }

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectAll = () => {
    if (selected.size === orders.length) setSelected(new Set())
    else setSelected(new Set(orders.map((o) => o.order_id)))
  }

  const rollbackOne = async (order_id) => {
    setShowModal({
      type: 'rollback',
      orderId: order_id,
      title: 'Rollback Order',
      message: `Rollback order ${order_id} back to Posted?`,
      placeholder: 'Optional reason for rollback',
      toStatus: 'Posted',
    })
    setModalInput('')
  }

  const rollbackSelected = async () => {
    if (selected.size === 0) return
    setShowModal({
      type: 'rollbackMultiple',
      selectedIds: Array.from(selected),
      title: 'Rollback Selected Orders',
      message: `Rollback ${selected.size} selected order(s) back to Posted?`,
      placeholder: 'Optional reason for rollback',
      toStatus: 'Posted',
    })
    setModalInput('')
  }

  const handleRollbackSubmit = async () => {
    const ids = showModal?.type === 'rollbackMultiple' ? showModal?.selectedIds : [showModal?.orderId]
    const orderIds = (ids || []).map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0)
    if (!orderIds.length) return
    setRollingBack(true)
    try {
      const ctl = new AbortController()
      const timer = setTimeout(() => ctl.abort(), 8000)
      const res = await fetch('/api/admin/food/orders/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ orderIds, toStatus: 'Posted', adminId: 'admin@coop', note: modalInput || '' }),
        signal: ctl.signal,
      })
      const json = await safeJson(res, '/api/admin/food/orders/rollback')
      try { clearTimeout(timer) } catch {}
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Rollback failed')
      const okCount = Number(json?.rolledBack?.length || 0)
      const failCount = Number(json?.failed?.length || 0)
      setMsg({
        type: 'success',
        text: failCount ? `Rolled back ${okCount} order(s), ${failCount} failed` : `Rolled back ${okCount} order(s)`,
      })
      fetchOrders()
      setSelected(new Set())
      setModalInput('')
      setShowModal(null)
    } catch (e) {
      if (e.name === 'AbortError') {
        setMsg({ type: 'error', text: 'Rollback timed out after 8s. Please check network and try again.' })
      } else {
        setMsg({ type: 'error', text: e?.message || 'Rollback failed' })
      }
    } finally {
      setRollingBack(false)
    }
  }

  const fetchAllForExport = async () => {
    const all = []
    let cursor = null
    let guard = 0
    while (guard < 200) {
      guard += 1
      const qs = new URLSearchParams({ status: 'Delivered', limit: '1000' })
      if (term) qs.set('term', term)
      if (payment) qs.set('payment', payment)
      if (cursor) qs.set('cursor', String(cursor))
      const res = await fetch(`/api/admin/food/orders/list?${qs.toString()}`, { cache: 'no-store' })
      const json = await safeJson(res, '/api/admin/food/orders/list (delivered export)')
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Failed to load orders for export')
      const chunk = json.orders || []
      all.push(...chunk)
      if (!json.nextCursor) break
      cursor = json.nextCursor
    }
    return all
  }

  const exportExcel = async () => {
    const srcOrders = await fetchAllForExport().catch(() => [])
    const rows = srcOrders.flatMap((o) => (o.order_lines || []).map((l) => ({
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
      amount: l.amount,
    })))
    if (!rows.length) { alert('No rows to export') ; return }

    const ExcelJSMod = await import('exceljs')
    const ExcelJS = ExcelJSMod?.default ?? ExcelJSMod
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Delivered')

    const headers = Object.keys(rows[0])
    ws.addRow(['Food Distribution — Delivered Orders (Admin)'])
    ws.addRow([`Search: ${term || 'All'} | Payment: ${payment || 'All'}`])
    ws.addRow(headers)
    for (const r of rows) ws.addRow(headers.map((h) => r[h]))

    const buffer = await wb.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `admin_food_delivered_${new Date().toISOString().split('T')[0]}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportPDF = async () => {
    const all = await fetchAllForExport().catch(() => [])
    if (!all.length) {
      alert('No rows to export')
      return
    }
    const { jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

    const sanitize = (s) => String(s ?? '').replace(/\u20A6|₦/g, 'NGN ').replace(/[\u2013\u2014]/g, '-')

    doc.setFontSize(14)
    doc.text('Delivered Orders Manifest (Admin)', 12, 12)
    doc.setFontSize(9)
    doc.text(`Generated: ${new Date().toLocaleString()}`, 12, 18)
    doc.text(`Search: ${term || 'All'}  |  Payment: ${payment || 'All'}`, 12, 24)

    const headers = ['Order', 'Member', 'Dept', 'Pay', 'SKU', 'Item', 'Qty', 'Unit Price', 'Amount']
    const rows = all.flatMap((o) =>
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

    doc.save(`admin_delivered_manifest_${new Date().toISOString().split('T')[0]}.pdf`)
  }

  const downloadReceipt = (orderId, memberId) => {
    window.open(`/shop/success/${orderId}?mid=${memberId}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
        <h1 className="text-base sm:text-lg md:text-xl font-semibold break-words">Admin — Food Distribution — Delivered</h1>
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

      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-4 mb-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-2">
          <div className="flex gap-2 flex-1 min-w-[220px]">
            <input
              className="border-2 border-gray-200 rounded-xl px-3 py-2 text-xs sm:text-sm flex-1 bg-white"
              placeholder="Search (Order / Member / Branch)"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              onKeyDown={handleKeyPress}
            />
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs sm:text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
              onClick={handleSearch}
              disabled={loading}
            >
              Search
            </button>
          </div>

          <select
            className="border-2 border-gray-200 rounded-xl px-3 py-2 text-xs sm:text-sm bg-white"
            value={payment}
            onChange={(e) => setPayment(e.target.value)}
            disabled={loading}
          >
            <option value="">All payments</option>
            <option value="Savings">Savings</option>
            <option value="Loan">Loan</option>
            <option value="Cash">Cash</option>
          </select>

          <button
            className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-800 text-white text-xs sm:text-sm font-semibold disabled:opacity-50"
            onClick={() => exportExcel().catch((e) => setMsg({ type: 'error', text: e?.message || 'Export failed' }))}
            disabled={loading}
          >
            Download Excel
          </button>

          <button
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-semibold disabled:opacity-50"
            onClick={() => exportPDF().catch((e) => setMsg({ type: 'error', text: e?.message || 'Export failed' }))}
            disabled={loading}
          >
            Download PDF
          </button>
        </div>

        <div className="mt-3 text-xs sm:text-sm text-gray-600">
          Orders: {summary?.count ?? orders.length} · Total: {money(summary?.totalAmount ?? 0)} · Selected: {selected.size}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold">Delivered Orders</div>
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
            <button
              className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold shadow-sm disabled:opacity-50 ${
                selected.size === 0 || rollingBack ? 'bg-gray-400 text-white' : 'bg-amber-600 text-white hover:bg-amber-700'
              }`}
              disabled={selected.size === 0 || rollingBack}
              onClick={rollbackSelected}
            >
              {rollingBack ? 'Rolling back…' : `Rollback Selected (${selected.size})`}
            </button>
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
                    No Delivered orders.
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
                      <div className="text-gray-500 text-xs">{new Date(o.posted_at || o.created_at).toLocaleString()}</div>
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
                          if (v === 'rollback') rollbackOne(o.order_id)
                          if (v === 'receipt') downloadReceipt(o.order_id, o.member_id)
                        }}
                        disabled={loading}
                      >
                        <option value="" disabled>
                          Actions
                        </option>
                        <option value="view">View items</option>
                        <option value="rollback">Rollback</option>
                        <option value="receipt">Receipt</option>
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <DraggableModal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing ? `Order #${viewing.order_id} items` : 'Order items'}
        widthClass="max-w-4xl w-full mx-4"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm border">
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
                  <td className="p-2 border">{l.items?.sku}</td>
                  <td className="p-2 border break-words">{l.items?.name}</td>
                  <td className="p-2 border text-right">{l.qty}</td>
                  <td className="p-2 border text-right">{money(l.unit_price)}</td>
                  <td className="p-2 border text-right">{money(l.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DraggableModal>

      <DraggableModal
        open={!!showModal}
        onClose={() => {
          setShowModal(null)
          setModalInput('')
        }}
        title={showModal?.title || 'Confirm'}
        overlayClassName="bg-white/10 backdrop-blur-sm"
        widthClass="max-w-md w-full mx-4"
        footer={
          <div className="flex gap-2 justify-end">
            <button
              className="px-4 py-2 border rounded hover:bg-gray-50"
              onClick={() => {
                setShowModal(null)
                setModalInput('')
              }}
              disabled={rollingBack}
            >
              Cancel
            </button>
            <button
              className="px-4 py-2 rounded text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50"
              onClick={handleRollbackSubmit}
              disabled={rollingBack}
            >
              {rollingBack ? 'Rolling back…' : 'Rollback'}
            </button>
          </div>
        }
      >
        <p className="text-gray-600 mb-4">{showModal?.message}</p>
        <input
          type="text"
          value={modalInput}
          onChange={(e) => setModalInput(e.target.value)}
          placeholder={showModal?.placeholder || ''}
          className="w-full p-2 border rounded"
          autoFocus
        />
      </DraggableModal>
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
