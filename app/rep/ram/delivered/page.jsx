'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import ProtectedRoute from '../../../components/ProtectedRoute'

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

function RepRamDeliveredContent() {
  const [orders, setOrders] = useState([])
  const [term, setTerm] = useState('')
  const [deliveryLocationId, setDeliveryLocationId] = useState('')
  const [locationOptions, setLocationOptions] = useState([])
  const [msg, setMsg] = useState(null)
  const [loading, setLoading] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [downloadingExcel, setDownloadingExcel] = useState(false)
  const [pageSize, setPageSize] = useState(50)
  const [page, setPage] = useState(1)
  const fetchCtl = useRef(null)
  const didInitRef = useRef(false)
  const safeJson = useMemo(() => safeJsonFactory(), [])

  const fetchOrders = async () => {
    setLoading(true)
    setMsg(null)
    try {
      if (fetchCtl.current) fetchCtl.current.abort()
      const ctl = new AbortController()
      fetchCtl.current = ctl
      const qs = new URLSearchParams({
        status: 'Delivered',
        limit: '1000',
        ...(term ? { term } : {}),
        ...(deliveryLocationId ? { delivery_location_id: deliveryLocationId } : {}),
      })
      const res = await fetch(`/api/rep/ram/orders/list?${qs.toString()}`, { cache: 'no-store', signal: ctl.signal })
      const json = await safeJson(res, '/api/rep/ram/orders/list')
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Failed to load')
      const nextOrders = json.orders || []
      setOrders(nextOrders)
      setLocationOptions((prev) => {
        const byId = new Map((prev || []).map((l) => [Number(l.id), l]))
        for (const o of nextOrders || []) {
          const loc = o?.delivery_location
          const id = Number(loc?.id ?? o?.ram_delivery_location_id)
          if (!Number.isFinite(id) || id <= 0) continue
          const title = String(loc?.delivery_location || '').trim()
          const name = String(loc?.name || '').trim()
          const label = [title, name].filter(Boolean).join(' — ')
          if (!byId.has(id)) byId.set(id, { id, label: label || `Location ${id}` })
        }
        return Array.from(byId.values()).sort((a, b) => a.label.localeCompare(b.label))
      })
      setPage(1)
    } catch (e) {
      if (e?.name !== 'AbortError') setMsg({ type: 'error', text: e?.message || 'Failed to load' })
      setOrders([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()
    didInitRef.current = true
    return () => {
      if (fetchCtl.current) fetchCtl.current.abort()
    }
  }, [])

  useEffect(() => {
    if (!didInitRef.current) return
    fetchOrders()
  }, [deliveryLocationId])

  const selectedLocationLabel = useMemo(() => {
    const id = Number(deliveryLocationId)
    if (!Number.isFinite(id) || id <= 0) return ''
    return locationOptions.find((l) => Number(l.id) === id)?.label || ''
  }, [deliveryLocationId, locationOptions])

  const exportExcel = async () => {
    if (!orders.length) return
    setDownloadingExcel(true)
    setMsg(null)
    try {
      const rows = orders.map((o) => ({
        id: o.id,
        created_at: o.created_at,
        member_id: o.member_id,
        member_name: o.member?.full_name || '',
        member_phone: o.member?.phone || '',
        payment: o.payment_option || '',
        qty: o.qty,
        unit_price: o.unit_price,
        principal_amount: o.principal_amount,
        interest_amount: o.interest_amount,
        total_amount: o.total_amount,
        delivery_location: o.delivery_location?.delivery_location || '',
        vendor_name: o.delivery_location?.name || '',
        vendor_phone: o.delivery_location?.phone || '',
        status: o.status,
        signature: '',
      }))
      const ExcelJSMod = await import('exceljs')
      const ExcelJS = ExcelJSMod?.default ?? ExcelJSMod
      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet('Delivered')

      ws.addRow(['Ram Sales — Delivered Orders (Rep)'])
      ws.addRow([`Delivery Location: ${selectedLocationLabel || 'All'} | Search: ${term || 'All'}`])

      const headers = Object.keys(rows[0] || { id: '' })
      ws.addRow(headers)
      for (const r of rows) ws.addRow(headers.map((h) => r[h]))

      const buffer = await wb.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `rep_ram_delivered_${new Date().toISOString().split('T')[0]}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setMsg({ type: 'error', text: e?.message || 'Download failed' })
    } finally {
      setDownloadingExcel(false)
    }
  }

  const exportPDF = async () => {
    if (!orders.length) return
    setDownloadingPdf(true)
    setMsg(null)
    try {
      const { jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

      const sanitize = (s) => String(s ?? '').replace(/\u20A6|₦/g, 'NGN ').replace(/[\u2013\u2014]/g, '-')
      const filters = [
        `Delivery: ${selectedLocationLabel || 'All'}`,
        `Search: ${term || 'All'}`,
      ].join('  |  ')

      doc.setFontSize(14)
      doc.text('Ram Sales — Delivered Orders', 12, 12)
      doc.setFontSize(9)
      doc.text(`Generated: ${new Date().toLocaleString()}`, 12, 18)
      doc.text(`Filters: ${sanitize(filters)}`, 12, 24)

      const head = [
        [
          'OrderID',
          'CreatedAt',
          'MemberID',
          'MemberName',
          'MemberPhone',
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
        sanitize(o.member?.phone || ''),
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
          6: { halign: 'right' },
          7: { halign: 'right' },
          8: { halign: 'right' },
          9: { halign: 'right' },
          10: { halign: 'right' },
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.row.index === totalsRowIndex) {
            data.cell.styles.fontStyle = 'bold'
            data.cell.styles.fillColor = [243, 244, 246]
          }
        },
        margin: { left: 12, right: 12 },
      })

      doc.save(`rep_ram_delivered_${new Date().toISOString().split('T')[0]}.pdf`)
    } catch (e) {
      setMsg({ type: 'error', text: e?.message || 'Download failed' })
    } finally {
      setDownloadingPdf(false)
    }
  }

  const pageCount = useMemo(() => Math.max(1, Math.ceil((orders?.length || 0) / Math.max(1, pageSize))), [orders, pageSize])
  const safePage = Math.min(Math.max(1, page), pageCount)
  const startIndex = (safePage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const pageRows = useMemo(() => (orders || []).slice(startIndex, endIndex), [endIndex, orders, startIndex])

  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-base sm:text-lg md:text-xl font-semibold break-words">Rep — Ram Sales (Delivered)</h1>
          <div className="text-xs sm:text-sm text-gray-600">Delivered ram orders for your delivery location(s).</div>
        </div>
      </div>

      {!!msg && (
        <div
          className={`mb-4 rounded-xl border p-3 text-sm ${
            msg.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'
          }`}
        >
          {msg.text}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-4 mb-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col lg:flex-row gap-2 lg:items-center lg:justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <input
                className="w-full max-w-[420px] border-2 border-gray-200 rounded-xl px-3 py-2 text-sm"
              placeholder="Search (Order ID / Member ID / Name)"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') fetchOrders()
              }}
            />
            <button type="button" onClick={fetchOrders} className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold">
              Search
            </button>
          </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="border-2 border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                value={deliveryLocationId}
                onChange={(e) => setDeliveryLocationId(e.target.value)}
              >
                <option value="">All locations</option>
                {locationOptions.map((l) => (
                  <option key={l.id} value={String(l.id)}>
                    {l.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={exportExcel}
                disabled={!orders.length || downloadingExcel || downloadingPdf}
                className="px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-900 text-white text-sm font-semibold disabled:opacity-50"
              >
                {downloadingExcel ? 'Preparing…' : 'Download Excel'}
              </button>
              <button
                type="button"
                onClick={exportPDF}
                disabled={!orders.length || downloadingExcel || downloadingPdf}
                className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-50"
              >
                {downloadingPdf ? 'Preparing…' : 'Download PDF'}
              </button>
            </div>
          </div>
          <div className="text-xs text-gray-600">Orders: {orders.length.toLocaleString()}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-semibold">Delivered Orders</div>
            <button
              type="button"
              onClick={fetchOrders}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs sm:text-sm font-semibold disabled:opacity-50"
            >
              {loading ? 'Loading…' : 'Refresh'}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <select
              className="border-2 border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value) || 50)}
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <button
              type="button"
              className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-xs sm:text-sm font-semibold text-gray-700 disabled:opacity-50"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
            >
              Prev
            </button>
            <div className="text-xs text-gray-500">
              Page {safePage} / {pageCount}
            </div>
            <button
              type="button"
              className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-xs sm:text-sm font-semibold text-gray-700 disabled:opacity-50"
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={safePage >= pageCount}
            >
              Next
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-2 text-left">Order</th>
                <th className="p-2 text-left">Member</th>
                <th className="p-2 text-left">Delivery</th>
                <th className="p-2 text-left">Payment</th>
                <th className="p-2 text-right">Qty</th>
                <th className="p-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {!pageRows.length && (
                <tr>
                  <td className="p-3 text-gray-600" colSpan={6}>
                    {loading ? 'Loading…' : 'No delivered orders.'}
                  </td>
                </tr>
              )}
              {pageRows.map((o) => (
                <tr key={o.id} className="border-b last:border-b-0 hover:bg-gray-50">
                  <td className="p-2 align-top">
                    <div className="font-medium">#{o.id}</div>
                    <div className="text-gray-600">{o.created_at ? new Date(o.created_at).toLocaleString() : ''}</div>
                  </td>
                  <td className="p-2 align-top">
                    <div className="font-medium">{o.member_id}</div>
                    <div className="text-gray-600">{o.member?.full_name || ''}</div>
                    <div className="text-gray-600">{o.member?.phone || ''}</div>
                  </td>
                  <td className="p-2 align-top whitespace-pre-line">
                    <div>{o.delivery_location?.delivery_location || ''}</div>
                    <div className="text-gray-600">{o.delivery_location?.name || ''}</div>
                    <div className="text-gray-600">{o.delivery_location?.phone || ''}</div>
                  </td>
                  <td className="p-2 align-top">{o.payment_option || ''}</td>
                  <td className="p-2 align-top text-right">{Number(o.qty || 0).toLocaleString()}</td>
                  <td className="p-2 align-top text-right">
                    <div className="font-medium">{money(o.total_amount)}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default function RepRamDeliveredPage() {
  return (
    <ProtectedRoute allowedRoles={['rep']}>
      <RepRamDeliveredContent />
    </ProtectedRoute>
  )
}
