'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import ProtectedRoute from '../../components/ProtectedRoute'
import DraggableModal from '../../components/DraggableModal'

const Spinner = ({ className = 'h-4 w-4 text-white' }) => (
  <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
)

function RepDeliveredContent() {
  const { user, logout } = useAuth()

  const [orders, setOrders] = useState([])
  const [departments, setDepartments] = useState([])
  const [dept, setDept] = useState('')

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')

  const [msg, setMsg] = useState(null)
  const [loading, setLoading] = useState(false)
  const [pageSize] = useState(50)
  const [cursorStack, setCursorStack] = useState([null])
  const [pageIndex, setPageIndex] = useState(0)
  const [nextCursor, setNextCursor] = useState(null)

  const [excelLoading, setExcelLoading] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)

  const [viewOpen, setViewOpen] = useState(false)
  const [viewOrder, setViewOrder] = useState(null)

  const fetchCtl = useRef(null)

  const changeBranch = () => {
    if (confirm('Are you sure you want to change your branch? You will be logged out and redirected to the login page.')) {
      logout()
    }
  }

  useEffect(() => {
    if (user?.type !== 'rep' || !user?.authenticated) return
    ;(async () => {
      try {
        const res = await fetch('/api/departments/list', { cache: 'no-store' })
        const j = await res.json()
        if (j?.ok) setDepartments(j.departments || [])
      } catch {}
    })()
  }, [user])

  const resetPagination = () => {
    setCursorStack([null])
    setPageIndex(0)
    setNextCursor(null)
  }

  const fetchOrders = async (cursorOverride) => {
    if (fetchCtl.current) fetchCtl.current.abort()
    const ctl = new AbortController()
    fetchCtl.current = ctl
    setLoading(true)
    setMsg(null)
    try {
      const cursor = cursorOverride !== undefined ? cursorOverride : cursorStack[pageIndex] || null
      const qs = new URLSearchParams({ status: 'Delivered', limit: String(pageSize) })
      if (dept) qs.set('dept', dept)
      if (cursor) { qs.set('cursor', String(cursor)); qs.set('dir', 'next') }
      const res = await fetch(`/api/rep/orders/list?${qs.toString()}`, { cache: 'no-store', signal: ctl.signal })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Failed to load')
      setOrders(json.orders || [])
      setNextCursor(json.nextCursor || null)
    } catch (e) {
      if (e?.name !== 'AbortError') setMsg({ type: 'error', text: e?.message || 'Failed to load' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user?.type !== 'rep' || !user?.authenticated) return
    fetchOrders(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dept, user])

  useEffect(() => {
    return () => {
      if (fetchCtl.current) fetchCtl.current.abort()
    }
  }, [])

  const filteredOrders = useMemo(() => {
    const s = String(search || '').trim().toLowerCase()
    if (!s) return orders || []
    return (orders || []).filter((o) => {
      const hay = `${o.order_id} ${o.member_id} ${o.member_name_snapshot || ''}`.toLowerCase()
      return hay.includes(s)
    })
  }, [orders, search])

  const collectAllOrdersForExport = async () => {
    const base = new URLSearchParams({ status: 'Delivered', limit: '200' })
    if (dept) base.set('dept', dept)
    let cursor = null
    let all = []
    for (let page = 0; page < 100; page++) {
      const qs = new URLSearchParams(base)
      if (cursor) {
        qs.set('cursor', cursor)
        qs.set('dir', 'next')
      }
      const res = await fetch(`/api/rep/orders/list?${qs.toString()}`, { cache: 'no-store', headers: { Accept: 'application/json' } })
      const j = await res.json().catch(() => null)
      if (!res.ok || !j?.ok) throw new Error(j?.error || 'Failed to collect orders')
      all = all.concat(j.orders || [])
      if (!j.nextCursor) break
      cursor = j.nextCursor
    }
    return all
  }

  const exportExcel = async () => {
    if (excelLoading) return
    setExcelLoading(true)
    setMsg(null)
    try {
      const source = await collectAllOrdersForExport()
      const s = String(search || '').trim().toLowerCase()
      const filtered = !s
        ? source
        : source.filter((o) => `${o.order_id} ${o.member_id} ${o.member_name_snapshot || ''}`.toLowerCase().includes(s))

      const rows = filtered.flatMap((o) =>
        (o.order_lines || []).map((l) => ({
          ID: o.member_id,
          Order: o.order_id,
          PostedAt: o.posted_at,
          Member: o.member_name_snapshot,
          MemberBranch: o.member_branch?.name || '',
          Delivery: o.delivery?.name || '',
          Department: o.departments?.name || '',
          Payment: o.payment_option,
          Item: l.items?.name || '',
          Qty: Number(l.qty || 0),
          UnitPrice: Number(l.unit_price || 0),
          Amount: Number(l.amount || 0),
        }))
      )
      if (!rows.length) throw new Error('No rows to export')

      const ExcelJSMod = await import('exceljs')
      const ExcelJS = ExcelJSMod?.default ?? ExcelJSMod
      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet('Delivered')
      ws.addRow(['Food Distribution — Delivered Orders'])
      ws.addRow([`Generated: ${new Date().toLocaleString()}`])
      ws.addRow([dept ? `Department: ${dept}` : 'Department: All'])
      ws.addRow([])

      const headers = Object.keys(rows[0])
      ws.addRow(headers)
      for (const r of rows) ws.addRow(headers.map((h) => r[h]))

      const buffer = await wb.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `rep_delivered_${new Date().toISOString().slice(0, 10)}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setMsg({ type: 'error', text: e?.message || 'Export failed' })
    } finally {
      setExcelLoading(false)
    }
  }

  const exportPDF = async () => {
    if (pdfLoading) return
    setPdfLoading(true)
    setMsg(null)
    try {
      const source = await collectAllOrdersForExport()
      const s = String(search || '').trim().toLowerCase()
      const filtered = !s
        ? source
        : source.filter((o) => `${o.order_id} ${o.member_id} ${o.member_name_snapshot || ''}`.toLowerCase().includes(s))

      if (!filtered.length) throw new Error('No rows to export')
      const { jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

      doc.setFontSize(14)
      doc.text('Delivered Orders Manifest', 12, 12)
      doc.setFontSize(9)
      doc.text(`Generated: ${new Date().toLocaleString()}`, 12, 18)
      doc.text(`Department: ${dept || 'All'}`, 12, 24)

      const headers = ['ID', 'Order', 'Member', 'Dept', 'Pay', 'Item', 'Qty', 'Unit Price', 'Amount']
      const sanitize = (v) => String(v ?? '').replace(/\u20A6|₦/g, 'NGN ').replace(/[\u2013\u2014]/g, '-')
      const body = filtered.flatMap((o) =>
        (o.order_lines || []).map((l) => [
          sanitize(o.member_id),
          sanitize(o.order_id),
          sanitize(o.member_name_snapshot),
          sanitize(o.departments?.name),
          sanitize(o.payment_option),
          sanitize(l.items?.name),
          String(l.qty || 0),
          `NGN ${Number(l.unit_price || 0).toLocaleString()}`,
          `NGN ${Number(l.amount || 0).toLocaleString()}`,
        ])
      )

      autoTable(doc, {
        head: [headers],
        body,
        startY: 30,
        margin: { top: 28, left: 10, right: 10 },
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 1.5, overflow: 'linebreak', lineWidth: 0.1, lineColor: [0, 0, 0] },
        headStyles: { fillColor: [75, 85, 99], textColor: [255, 255, 255], fontSize: 9 },
        alternateRowStyles: { fillColor: [249, 250, 251] },
        columnStyles: {
          0: { cellWidth: 18 }, // ID
          1: { cellWidth: 14 }, // Order
          2: { cellWidth: 52 }, // Member
          3: { cellWidth: 28 }, // Dept
          4: { cellWidth: 16 }, // Pay
          5: { cellWidth: 72 }, // Item
          6: { cellWidth: 12, halign: 'right' }, // Qty
          7: { cellWidth: 24, halign: 'right' }, // Unit Price
          8: { cellWidth: 26, halign: 'right' }, // Amount
        },
      })

      doc.save(`rep_delivered_${new Date().toISOString().slice(0, 10)}.pdf`)
    } catch (e) {
      setMsg({ type: 'error', text: e?.message || 'Export failed' })
    } finally {
      setPdfLoading(false)
    }
  }

  const openView = (o) => {
    setViewOrder(o)
    setViewOpen(true)
  }

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-base sm:text-lg md:text-xl font-semibold break-words">Rep — Food Distribution — Delivered</h1>
          <div className="text-xs text-gray-500">Current Branch: {user?.branchCode || '—'}</div>
        </div>
        <button
          type="button"
          onClick={changeBranch}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm whitespace-nowrap"
        >
          Change Branch
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-4 mb-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-2">
          <select
            className="border-2 border-gray-200 rounded-xl px-3 py-2 text-xs sm:text-sm bg-white w-full lg:w-56"
            value={dept}
            onChange={(e) => {
              const v = e.target.value
              setDept(v)
              resetPagination()
              setOrders([])
            }}
          >
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          <div className="flex gap-2 flex-1 min-w-[220px]">
            <input
              className="border-2 border-gray-200 rounded-xl px-3 py-2 text-xs sm:text-sm flex-1 bg-white"
              placeholder="Search (Order / Member)"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setSearch(searchInput.trim())
              }}
            />
            <button
              type="button"
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs sm:text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm whitespace-nowrap"
              onClick={() => setSearch(searchInput.trim())}
              disabled={loading}
            >
              Search
            </button>
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-900 text-white text-xs sm:text-sm font-medium disabled:opacity-50 inline-flex items-center gap-2"
              onClick={() => exportExcel().catch(() => null)}
              disabled={excelLoading}
            >
              {excelLoading && <Spinner className="h-4 w-4 text-white" />}
              <span>{excelLoading ? 'Downloading…' : 'Download Excel'}</span>
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-medium disabled:opacity-50 inline-flex items-center gap-2"
              onClick={() => exportPDF().catch(() => null)}
              disabled={pdfLoading}
            >
              {pdfLoading && <Spinner className="h-4 w-4 text-white" />}
              <span>{pdfLoading ? 'Downloading…' : 'Download PDF'}</span>
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-medium disabled:opacity-50 inline-flex items-center gap-2"
              onClick={() => fetchOrders(undefined).catch(() => null)}
              disabled={loading}
            >
              {loading && <Spinner className="h-4 w-4 text-white" />}
              <span>{loading ? 'Refreshing…' : 'Refresh'}</span>
            </button>
          </div>
        </div>
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

      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="text-sm font-semibold">Delivered Orders</div>
          <div className="flex items-center gap-2 text-xs font-normal text-gray-700">
            <button
              type="button"
              className="px-2 py-1 rounded border bg-white hover:bg-gray-50 disabled:opacity-50"
              onClick={() => {
                if (pageIndex <= 0) return
                const prevIndex = pageIndex - 1
                setPageIndex(prevIndex)
                fetchOrders(cursorStack[prevIndex] || null).catch(() => null)
              }}
              disabled={loading || pageIndex <= 0}
            >
              Prev
            </button>
            <div>Page {pageIndex + 1}</div>
            <button
              type="button"
              className="px-2 py-1 rounded border bg-white hover:bg-gray-50 disabled:opacity-50"
              onClick={() => {
                if (!nextCursor) return
                const nextIndex = pageIndex + 1
                setCursorStack((prev) => {
                  const next = [...(prev || [])]
                  if (next.length <= nextIndex) next.push(nextCursor)
                  return next
                })
                setPageIndex(nextIndex)
                fetchOrders(nextCursor).catch(() => null)
              }}
              disabled={loading || !nextCursor}
            >
              Next
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left font-semibold text-gray-900">Order</th>
                <th className="px-3 py-3 text-left font-semibold text-gray-900">Member</th>
                <th className="px-3 py-3 text-left font-semibold text-gray-900">Department</th>
                <th className="px-3 py-3 text-left font-semibold text-gray-900">Payment</th>
                <th className="px-3 py-3 text-right font-semibold text-gray-900">Total + Int</th>
                <th className="px-3 py-3 text-left font-semibold text-gray-900">Date</th>
                <th className="px-3 py-3 text-right font-semibold text-gray-900">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading && filteredOrders.length === 0 ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={`sk_${i}`}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={`sk_${i}_${j}`} className="px-3 py-3">
                        <div className="h-4 w-full bg-gray-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-600">
                    No Delivered orders.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((o) => (
                  <tr key={o.order_id} className="hover:bg-gray-50">
                    <td className="px-3 py-3 font-medium text-gray-900">#{o.order_id}</td>
                    <td className="px-3 py-3">
                      <div className="text-gray-900">{o.member_name_snapshot}</div>
                      <div className="text-xs text-gray-500">{o.member_id}</div>
                    </td>
                    <td className="px-3 py-3">{o.departments?.name || '-'}</td>
                    <td className="px-3 py-3">{o.payment_option}</td>
                    <td className="px-3 py-3 text-right font-semibold">₦{Number(o.total_amount || 0).toLocaleString()}</td>
                    <td className="px-3 py-3">{new Date(o.posted_at || o.created_at).toLocaleString()}</td>
                    <td className="px-3 py-3 text-right">
                      <button
                        type="button"
                        className="px-3 py-1.5 rounded-lg bg-gray-900 hover:bg-black text-white text-xs font-semibold"
                        onClick={() => openView(o)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <DraggableModal open={viewOpen} onClose={() => setViewOpen(false)} title={viewOrder ? `Order #${viewOrder.order_id}` : 'Order'}>
        {!viewOrder ? (
          <div className="text-sm text-gray-600">No order selected.</div>
        ) : (
          <div className="space-y-3">
            <div className="text-sm">
              <div>
                <span className="text-gray-500">Member:</span> <span className="font-medium">{viewOrder.member_name_snapshot}</span>{' '}
                <span className="text-gray-500">({viewOrder.member_id})</span>
              </div>
              <div className="text-gray-600">
                {viewOrder.member_branch?.name ? `Member Branch: ${viewOrder.member_branch.name} • ` : ''}
                {viewOrder.delivery?.name ? `Delivery: ${viewOrder.delivery.name} • ` : ''}
                {viewOrder.departments?.name ? `Department: ${viewOrder.departments.name}` : 'Department: -'}
              </div>
              <div className="text-gray-600">
                Payment: <span className="font-medium">{viewOrder.payment_option}</span> • Total:{' '}
                <span className="font-semibold">₦{Number(viewOrder.total_amount || 0).toLocaleString()}</span>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left">SKU</th>
                      <th className="px-3 py-2 text-left">Item</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-right">Unit Price</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {(viewOrder.order_lines || []).map((l) => (
                      <tr key={l.id}>
                        <td className="px-3 py-2 font-mono text-xs">{l.items?.sku || ''}</td>
                        <td className="px-3 py-2">{l.items?.name || ''}</td>
                        <td className="px-3 py-2 text-right">{Number(l.qty || 0).toLocaleString()}</td>
                        <td className="px-3 py-2 text-right">₦{Number(l.unit_price || 0).toLocaleString()}</td>
                        <td className="px-3 py-2 text-right">₦{Number(l.amount || 0).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </DraggableModal>
    </div>
  )
}

export default function RepDeliveredPage() {
  return (
    <ProtectedRoute allowedRoles={['rep']}>
      <RepDeliveredContent />
    </ProtectedRoute>
  )
}

