'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import ProtectedRoute from '../../../components/ProtectedRoute'
import DraggableModal from '../../../components/DraggableModal'

function safeJsonFactory() {
  return async (res, label) => {
    const ct = res.headers.get('content-type') || ''
    if (ct.includes('application/json')) return await res.json()
    const text = await res.text()
    throw new Error(`Non-JSON response from ${label} (${res.status}): ${text.slice(0, 300)}`)
  }
}

function money(n) {
  return `₦${Number(n || 0).toLocaleString()}`
}

function RamPendingContent() {
  const [orders, setOrders] = useState([])
  const [locations, setLocations] = useState([])
  const [term, setTerm] = useState('')
  const [payment, setPayment] = useState('')
  const [memberId, setMemberId] = useState('')
  const [memberGrade, setMemberGrade] = useState('')
  const [locationId, setLocationId] = useState('')
  const [msg, setMsg] = useState(null)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [pageSize, setPageSize] = useState(50)
  const [page, setPage] = useState(1)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [showModal, setShowModal] = useState(null)
  const [editQty, setEditQty] = useState('')
  const [editLocationId, setEditLocationId] = useState('')
  const [editBusy, setEditBusy] = useState(false)
  const fetchCtl = useRef(null)
  const safeJson = useMemo(() => safeJsonFactory(), [])

  const fetchOrders = async () => {
    setLoading(true)
    setMsg(null)
    try {
      if (fetchCtl.current) fetchCtl.current.abort()
      const ctl = new AbortController()
      fetchCtl.current = ctl
      const qs = new URLSearchParams({
        status: 'Pending',
        limit: '500',
        ...(term ? { term } : {}),
        ...(payment ? { payment } : {}),
        ...(memberId ? { member_id: memberId.toUpperCase().trim() } : {}),
        ...(memberGrade ? { member_grade: memberGrade.trim() } : {}),
      })
      const res = await fetch(`/api/admin/ram-orders/list?${qs.toString()}`, { cache: 'no-store', signal: ctl.signal })
      const json = await safeJson(res, '/api/admin/ram-orders/list')
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Failed to load')
      let rows = json.orders || []
      if (locationId) rows = rows.filter((o) => String(o.delivery_location?.id || '') === String(locationId))
      setOrders(rows)
      setSelected(new Set())
      setPage(1)
    } catch (e) {
      if (e?.name !== 'AbortError') setMsg({ type: 'error', text: e?.message || 'Failed to load' })
    } finally {
      setLoading(false)
    }
  }

  const fetchLocations = async () => {
    try {
      const res = await fetch('/api/admin/ram/delivery-locations', { cache: 'no-store' })
      const json = await safeJson(res, '/api/admin/ram/delivery-locations')
      if (json?.ok) setLocations(json.locations || [])
    } catch {
      setLocations([])
    }
  }

  useEffect(() => {
    fetchLocations()
    fetchOrders()
    return () => {
      if (fetchCtl.current) fetchCtl.current.abort()
    }
  }, [])

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const pageCount = useMemo(() => Math.max(1, Math.ceil((orders?.length || 0) / Math.max(1, pageSize))), [orders, pageSize])
  const safePage = Math.min(Math.max(1, page), pageCount)
  const startIndex = (safePage - 1) * pageSize
  const pagedOrders = useMemo(() => (orders || []).slice(startIndex, startIndex + pageSize), [orders, startIndex, pageSize])

  useEffect(() => {
    if (page !== safePage) setPage(safePage)
  }, [page, safePage])

  useEffect(() => {
    setSelected(new Set())
  }, [pageSize, safePage])

  const selectAll = () => {
    const ids = (pagedOrders || []).map((o) => o.id)
    if (!ids.length) return
    const allSelected = ids.every((id) => selected.has(id))
    setSelected(allSelected ? new Set() : new Set(ids))
  }

  const exportCSV = () => {
    const rows = orders.map((o) => ({
      id: o.id,
      created_at: o.created_at,
      member_id: o.member_id,
      member_name: o.member?.full_name || '',
      member_category: o.member_category || '',
      member_grade: o.member_grade || '',
      payment: o.payment_option || '',
      delivery_location: o.delivery_location?.delivery_location || '',
      delivery_contact: o.delivery_location?.name || '',
      delivery_phone: o.delivery_location?.phone || '',
      qty: o.qty,
      unit_price: o.unit_price,
      total_amount: o.total_amount,
      loan_interest: o.loan_interest,
      status: o.status,
      signature: '',
    }))
    if (!rows.length) return
    const headers = Object.keys(rows[0])
    const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'ram_pending_orders.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportPDF = async () => {
    if (!orders.length) return
    const { jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

    const sanitize = (s) => String(s ?? '').replace(/\u20A6|₦/g, 'NGN ').replace(/[\u2013\u2014]/g, '-')
    const locationLabel = locationId
      ? filteredLocations.find((l) => String(l.id) === String(locationId))?.delivery_location || String(locationId)
      : 'All'
    const filters = [
      `Location: ${locationLabel}`,
      `Payment: ${payment || 'All'}`,
      `Member: ${memberId ? memberId.toUpperCase().trim() : 'All'}`,
      `Grade: ${memberGrade ? memberGrade.trim() : 'All'}`,
      `Search: ${term || 'All'}`,
    ].join('  |  ')

    doc.setFontSize(14)
    doc.text('Ram Sales — Pending Orders', 12, 12)
    doc.setFontSize(9)
    doc.text(`Generated: ${new Date().toLocaleString()}`, 12, 18)
    doc.text(`Filters: ${sanitize(filters)}`, 12, 24)

    const head = [
      [
        'OrderID',
        'CreatedAt',
        'MemberID',
        'MemberName',
        'Payment',
        'Qty',
        'Unit Price',
        'Principal',
        'Interest',
        'Total',
        'Delivery',
        'Signature',
      ],
    ]

    const body = orders.map((o) => [
      String(o.id ?? ''),
      o.created_at ? new Date(o.created_at).toLocaleString() : '',
      sanitize(o.member_id),
      sanitize(o.member?.full_name || ''),
      sanitize(o.payment_option || ''),
      String(Number(o.qty || 0)),
      `NGN ${Number(o.unit_price || 0).toLocaleString()}`,
      `NGN ${Number(o.principal_amount || 0).toLocaleString()}`,
      `NGN ${Number(o.interest_amount || 0).toLocaleString()}`,
      `NGN ${Number(o.total_amount || 0).toLocaleString()}`,
      sanitize([o.delivery_location?.delivery_location || '', o.delivery_location?.name || '', o.delivery_location?.phone || ''].filter(Boolean).join('\n')),
      '',
    ])

    const totals = orders.reduce(
      (acc, o) => {
        acc.qty += Number(o.qty || 0)
        acc.principal += Number(o.principal_amount || 0)
        acc.interest += Number(o.interest_amount || 0)
        acc.total += Number(o.total_amount || 0)
        return acc
      },
      { qty: 0, principal: 0, interest: 0, total: 0 }
    )

    const totalsRowIndex = body.length
    body.push([
      'TOTAL',
      '',
      '',
      '',
      '',
      String(totals.qty.toLocaleString()),
      '',
      `NGN ${totals.principal.toLocaleString()}`,
      `NGN ${totals.interest.toLocaleString()}`,
      `NGN ${totals.total.toLocaleString()}`,
      '',
      '',
    ])

    autoTable(doc, {
      head,
      body,
      startY: 30,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [75, 85, 99] },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      columnStyles: {
        5: { halign: 'right' },
        6: { halign: 'right' },
        7: { halign: 'right' },
        8: { halign: 'right' },
        9: { halign: 'right' },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.row.index === totalsRowIndex) {
          data.cell.styles.fontStyle = 'bold'
          data.cell.styles.fillColor = [243, 244, 246]
        }
      },
      margin: { left: 12, right: 12 },
    })

    doc.save(`ram_pending_orders_${new Date().toISOString().split('T')[0]}.pdf`)
  }

  const openBulkModal = (nextStatus) => {
    if (!selected.size) return
    const ids = Array.from(selected)
    setShowModal({ type: 'bulk', ids, nextStatus })
  }

  const openDeleteModal = (ids) => {
    const list = Array.isArray(ids) ? ids : []
    const cleaned = list.filter((v) => Number.isFinite(Number(v)) && Number(v) > 0).map((v) => Number(v))
    if (!cleaned.length) return
    setShowModal({ type: 'delete', ids: cleaned })
  }

  const openEditModal = (order) => {
    if (!order?.id) return
    setEditQty(String(order.qty || 1))
    setEditLocationId(String(order.delivery_location?.id || order.ram_delivery_location_id || ''))
    setShowModal({ type: 'edit', id: order.id })
  }

  const submitBulk = async () => {
    const ids = showModal?.ids || []
    const nextStatus = showModal?.nextStatus
    if (!ids.length || !nextStatus) return
    setBulkBusy(true)
    setMsg(null)
    try {
      const res = await fetch('/api/admin/ram-orders/update-status-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ ids, status: nextStatus }),
      })
      const json = await safeJson(res, '/api/admin/ram-orders/update-status-bulk')
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Bulk update failed')
      setMsg({ type: 'success', text: `Updated ${json.updated?.length || 0} order(s) to ${nextStatus}` })
      setShowModal(null)
      fetchOrders()
    } catch (e) {
      setMsg({ type: 'error', text: e?.message || 'Bulk update failed' })
    } finally {
      setBulkBusy(false)
    }
  }

  const submitDelete = async () => {
    const ids = showModal?.ids || []
    if (!ids.length) return
    setBulkBusy(true)
    setMsg(null)
    try {
      const res = await fetch('/api/admin/ram-orders/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ ids }),
      })
      const json = await safeJson(res, '/api/admin/ram-orders/delete')
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Delete failed')
      const deleted = Array.isArray(json.deleted) ? json.deleted : ids
      setOrders((prev) => (prev || []).filter((o) => !deleted.includes(o.id)))
      setSelected(new Set())
      setShowModal(null)
      setMsg({ type: 'success', text: `Deleted ${deleted.length} order(s)` })
    } catch (e) {
      setMsg({ type: 'error', text: e?.message || 'Delete failed' })
    } finally {
      setBulkBusy(false)
    }
  }

  const submitEdit = async () => {
    const id = showModal?.id
    const qty = Number(editQty)
    const deliveryLocationId = Number(editLocationId)
    if (!Number.isFinite(id) || id <= 0) return
    if (!Number.isFinite(qty) || qty <= 0) return
    if (!Number.isFinite(deliveryLocationId) || deliveryLocationId <= 0) return

    setEditBusy(true)
    setMsg(null)
    try {
      const res = await fetch('/api/admin/ram-orders/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ id, qty, delivery_location_id: deliveryLocationId }),
      })
      const json = await safeJson(res, '/api/admin/ram-orders/update')
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Update failed')
      const updated = json.order
      const loc = (locations || []).find((l) => String(l.id) === String(updated?.ram_delivery_location_id)) || null
      setOrders((prev) =>
        (prev || []).map((o) => {
          if (o.id !== id) return o
          return {
            ...o,
            ...updated,
            loan_interest: Number(updated?.interest_amount || 0),
            delivery_location: loc
              ? {
                  id: loc.id,
                  delivery_location: loc.delivery_location || '',
                  name: loc.name || '',
                  phone: loc.phone || '',
                  address: loc.address || '',
                  is_active: loc.is_active,
                }
              : o.delivery_location,
          }
        })
      )
      setShowModal(null)
      setMsg({ type: 'success', text: `Order #${id} updated` })
    } catch (e) {
      setMsg({ type: 'error', text: e?.message || 'Update failed' })
    } finally {
      setEditBusy(false)
    }
  }

  const filteredLocations = useMemo(() => (locations || []).filter((l) => l.is_active !== false), [locations])

  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
        <h1 className="text-base sm:text-lg md:text-xl font-semibold text-center sm:text-left break-words">Admin — Ram Sales — Pending</h1>
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

      <div className="space-y-2 mb-4">
        <div className="flex gap-2">
          <input
            className="border rounded px-3 py-2 text-xs sm:text-sm flex-1"
            placeholder="Search (ID or member ID)"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
          <button className="px-4 py-2 bg-blue-600 text-white rounded text-xs sm:text-sm hover:bg-blue-700 transition-colors" onClick={fetchOrders}>
            Search
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <select className="border rounded px-3 py-2 text-xs sm:text-sm w-full" value={payment} onChange={(e) => setPayment(e.target.value)}>
            <option value="">All payments</option>
            <option value="Cash">Cash</option>
            <option value="Savings">Savings</option>
            <option value="Loan">Loan</option>
          </select>

          <select className="border rounded px-3 py-2 text-xs sm:text-sm w-full" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
            <option value="">All delivery locations</option>
            {filteredLocations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.delivery_location}
              </option>
            ))}
          </select>

          <input
            className="border rounded px-3 py-2 text-xs sm:text-sm w-full"
            placeholder="Member grade (e.g. Retiree)"
            value={memberGrade}
            onChange={(e) => setMemberGrade(e.target.value)}
          />

          <div className="flex gap-2">
            <input
              className="border rounded px-3 py-2 text-xs sm:text-sm flex-1"
              placeholder="Member ID"
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
            />
            <button className="px-4 py-2 bg-blue-600 text-white rounded text-xs sm:text-sm hover:bg-blue-700 transition-colors" onClick={fetchOrders}>
              Filter
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 mb-3">
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm" onClick={fetchOrders}>
          Refresh
        </button>
        <button className="px-4 py-2 bg-gray-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-gray-700 transition-colors shadow-sm" onClick={selectAll}>
          Select All
        </button>
        <button
          className="px-4 py-2 bg-green-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-green-700 transition-colors shadow-sm disabled:opacity-50"
          onClick={() => openBulkModal('Approved')}
          disabled={!selected.size || bulkBusy}
        >
          Approve Selected ({selected.size})
        </button>
        <button
          className="px-4 py-2 bg-red-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-red-700 transition-colors shadow-sm disabled:opacity-50"
          onClick={() => openDeleteModal(Array.from(selected))}
          disabled={!selected.size || bulkBusy}
        >
          Delete Selected ({selected.size})
        </button>
        <button className="px-4 py-2 bg-gray-700 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-gray-800 transition-colors shadow-sm" onClick={exportCSV}>
          Download CSV
        </button>
        <button className="px-4 py-2 bg-red-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-red-700 transition-colors shadow-sm" onClick={exportPDF}>
          Download PDF
        </button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
        <div className="text-xs sm:text-sm text-gray-700">
          Showing {orders.length ? startIndex + 1 : 0}–{Math.min(startIndex + pageSize, orders.length)} of {orders.length}
        </div>
        <div className="flex items-center gap-2">
          <select
            className="border rounded px-2 py-1 text-xs sm:text-sm bg-white"
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value) || 50)}
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <button
            type="button"
            className="px-3 py-1.5 rounded border text-xs sm:text-sm bg-white hover:bg-gray-50 disabled:opacity-50"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage <= 1}
          >
            Prev
          </button>
          <div className="text-xs sm:text-sm text-gray-700">
            Page {safePage} / {pageCount}
          </div>
          <button
            type="button"
            className="px-3 py-1.5 rounded border text-xs sm:text-sm bg-white hover:bg-gray-50 disabled:opacity-50"
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            disabled={safePage >= pageCount}
          >
            Next
          </button>
        </div>
      </div>

      <div className="overflow-x-auto border rounded bg-white">
        <table className="w-full text-xs">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 border text-left w-10">
                <input
                  type="checkbox"
                  checked={pagedOrders.length > 0 && pagedOrders.every((o) => selected.has(o.id))}
                  onChange={selectAll}
                />
              </th>
              <th className="p-2 border text-left">Order</th>
              <th className="p-2 border text-left">Member</th>
              <th className="p-2 border text-left">Delivery</th>
              <th className="p-2 border text-left">Payment</th>
              <th className="p-2 border text-right">Qty</th>
              <th className="p-2 border text-right">Unit</th>
              <th className="p-2 border text-right">Total</th>
              <th className="p-2 border text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className="p-3 text-gray-600" colSpan={9}>
                  Loading...
                </td>
              </tr>
            )}
            {!loading && orders.length === 0 && (
              <tr>
                <td className="p-3 text-gray-600" colSpan={9}>
                  No Pending ram orders.
                </td>
              </tr>
            )}
            {pagedOrders.map((o) => (
              <tr key={o.id} className="hover:bg-gray-50">
                <td className="p-2 border">
                  <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggleSelect(o.id)} />
                </td>
                <td className="p-2 border">
                  <div className="font-medium">#{o.id}</div>
                  <div className="text-gray-600">{new Date(o.created_at).toLocaleString()}</div>
                </td>
                <td className="p-2 border">
                  <div className="font-medium">{o.member_id}</div>
                  <div className="text-gray-600 break-words">{o.member?.full_name || '-'}</div>
                  <div className="text-gray-600">
                    {o.member_category || '-'}
                    {o.member_grade ? ` (${o.member_grade})` : ''}
                  </div>
                </td>
                <td className="p-2 border">
                  <div className="font-medium">{o.delivery_location?.delivery_location || '-'}</div>
                  <div className="text-gray-600">{o.delivery_location?.name || ''}</div>
                  <div className="text-gray-600">{o.delivery_location?.phone || ''}</div>
                </td>
                <td className="p-2 border">{o.payment_option || '-'}</td>
                <td className="p-2 border text-right">{o.qty || 0}</td>
                <td className="p-2 border text-right">{money(o.unit_price)}</td>
                <td className="p-2 border text-right">
                  <div className="font-medium">{money(o.total_amount)}</div>
                </td>
                <td className="p-2 border">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded bg-blue-600 text-white text-xs hover:bg-blue-700 disabled:opacity-50"
                      onClick={() => openEditModal(o)}
                      disabled={bulkBusy || editBusy}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded bg-red-600 text-white text-xs hover:bg-red-700 disabled:opacity-50"
                      onClick={() => openDeleteModal([o.id])}
                      disabled={bulkBusy}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <DraggableModal
        open={!!showModal}
        onClose={() => (bulkBusy || editBusy ? null : setShowModal(null))}
        title={
          showModal?.type === 'edit'
            ? `Edit Order #${showModal?.id}`
            : showModal?.type === 'delete'
              ? 'Delete Orders'
              : 'Approve Selected Orders'
        }
        footer={
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              className="px-4 py-2 rounded bg-gray-100 hover:bg-gray-200 text-sm"
              onClick={() => setShowModal(null)}
              disabled={bulkBusy || editBusy}
            >
              Close
            </button>
            <button
              type="button"
              className={`px-4 py-2 rounded text-white text-sm ${
                showModal?.type === 'edit'
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : showModal?.type === 'delete'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-green-600 hover:bg-green-700'
              } disabled:opacity-50`}
              onClick={showModal?.type === 'edit' ? submitEdit : showModal?.type === 'delete' ? submitDelete : submitBulk}
              disabled={bulkBusy || editBusy}
            >
              {bulkBusy || editBusy ? 'Working...' : showModal?.type === 'delete' ? 'Delete' : 'Confirm'}
            </button>
          </div>
        }
      >
        {showModal?.type === 'edit' ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="text-xs font-medium text-gray-700 mb-1">Delivery Location</div>
                <select
                  className="w-full border rounded px-3 py-2 text-sm bg-white"
                  value={editLocationId}
                  onChange={(e) => setEditLocationId(e.target.value)}
                  disabled={editBusy || bulkBusy}
                >
                  <option value="">Select...</option>
                  {filteredLocations.map((l) => (
                    <option key={l.id} value={String(l.id)}>
                      {l.delivery_location}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div className="text-xs font-medium text-gray-700 mb-1">Qty</div>
                <input
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={editQty}
                  onChange={(e) => setEditQty(e.target.value)}
                  inputMode="numeric"
                  disabled={editBusy || bulkBusy}
                />
              </div>
            </div>
            <div className="text-xs text-gray-600">Loan is limited to 2 rams.</div>
          </div>
        ) : showModal?.type === 'delete' ? (
          <div className="text-sm text-gray-700">
            Delete <b>{showModal?.ids?.length || 0}</b> order(s)? This action cannot be undone.
          </div>
        ) : (
          <div className="text-sm text-gray-700">
            Update <b>{showModal?.ids?.length || 0}</b> order(s) to <b>{showModal?.nextStatus}</b>?
          </div>
        )}
      </DraggableModal>
    </div>
  )
}

export default function RamPendingPage() {
  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <RamPendingContent />
    </ProtectedRoute>
  )
}
