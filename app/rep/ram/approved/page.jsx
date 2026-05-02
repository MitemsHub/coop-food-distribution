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

function Spinner({ className = '' }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}

function RepRamApprovedContent() {
  const [orders, setOrders] = useState([])
  const [term, setTerm] = useState('')
  const [payment, setPayment] = useState('')
  const [memberId, setMemberId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
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
        limit: '1000',
        ...(term ? { term } : {}),
        ...(payment ? { payment } : {}),
        ...(memberId ? { member_id: memberId.toUpperCase().trim() } : {}),
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
      })
      const res = await fetch(`/api/rep/ram-orders/list?${qs.toString()}`, { cache: 'no-store', signal: ctl.signal })
      const json = await safeJson(res, '/api/rep/ram-orders/list')
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Failed to load')
      setOrders(json.orders || [])
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payment, from, to])

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
      const ws = wb.addWorksheet('Approved')

      ws.addRow(['Ram Sales — Approved Orders (Rep)'])
      ws.addRow([
        `Payment: ${payment || 'All'} | Member: ${memberId ? memberId.toUpperCase().trim() : 'All'} | Search: ${
          term || 'All'
        } | From: ${from || 'Any'} | To: ${to || 'Any'}`,
      ])

      const headers = Object.keys(rows[0] || { id: '' })
      ws.addRow(headers)
      for (const r of rows) ws.addRow(headers.map((h) => r[h]))

      const buffer = await wb.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `rep_ram_approved_${new Date().toISOString().split('T')[0]}.xlsx`
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
        `Payment: ${payment || 'All'}`,
        `Member: ${memberId ? memberId.toUpperCase().trim() : 'All'}`,
        `Search: ${term || 'All'}`,
        `From: ${from || 'Any'}`,
        `To: ${to || 'Any'}`,
      ].join('  |  ')

      doc.setFontSize(14)
      doc.text('Ram Sales — Approved Orders', 12, 12)
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

      doc.save(`rep_ram_approved_${new Date().toISOString().split('T')[0]}.pdf`)
    } catch (e) {
      setMsg({ type: 'error', text: e?.message || 'Download failed' })
    } finally {
      setDownloadingPdf(false)
    }
  }

  const pageCount = useMemo(() => Math.max(1, Math.ceil((orders?.length || 0) / Math.max(1, pageSize))), [orders, pageSize])
  const safePage = Math.min(Math.max(1, page), pageCount)
  const startIndex = (safePage - 1) * pageSize
  const pagedOrders = useMemo(() => (orders || []).slice(startIndex, startIndex + pageSize), [orders, startIndex, pageSize])

  useEffect(() => {
    if (page !== safePage) setPage(safePage)
  }, [page, safePage])

  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
        <h1 className="text-base sm:text-lg md:text-xl font-semibold text-center sm:text-left break-words">Rep — Ram Sales — Approved</h1>
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
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            className="border rounded px-3 py-2 text-xs sm:text-sm flex-1 sm:flex-[2] min-w-[180px]"
            placeholder="Search (Order ID)"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') fetchOrders()
            }}
          />
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded text-xs sm:text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 inline-flex items-center gap-2 justify-center"
            onClick={fetchOrders}
            disabled={loading}
          >
            {loading ? (
              <>
                <Spinner className="w-4 h-4" />
                Searching…
              </>
            ) : (
              'Search'
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <select className="border rounded px-3 py-2 text-xs sm:text-sm w-full" value={payment} onChange={(e) => setPayment(e.target.value)}>
            <option value="">All payments</option>
            <option value="Cash">Cash</option>
            <option value="Savings">Savings</option>
            <option value="Loan">Loan</option>
          </select>

          <input
            className="border rounded px-3 py-2 text-xs sm:text-sm w-full"
            placeholder="Member ID"
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
          />

          <div className="flex items-center gap-2">
            <label className="text-xs sm:text-sm text-gray-600 whitespace-nowrap">From</label>
            <input type="date" className="border rounded px-2 py-1 text-xs sm:text-sm flex-1" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs sm:text-sm text-gray-600 whitespace-nowrap">To</label>
            <input type="date" className="border rounded px-2 py-1 text-xs sm:text-sm flex-1" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 inline-flex items-center gap-2 justify-center"
          onClick={fetchOrders}
          disabled={loading}
        >
          {loading ? (
            <>
              <Spinner className="w-4 h-4" />
              Refreshing…
            </>
          ) : (
            'Refresh'
          )}
        </button>
        <button
          className="px-4 py-2 bg-gray-700 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-gray-800 transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
          onClick={exportExcel}
          disabled={!orders.length || downloadingExcel || downloadingPdf}
        >
          {downloadingExcel ? (
            <>
              <Spinner className="w-4 h-4" />
              Preparing…
            </>
          ) : (
            'Download Excel'
          )}
        </button>
        <button
          className="px-4 py-2 bg-red-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-red-700 transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
          onClick={exportPDF}
          disabled={!orders.length || downloadingExcel || downloadingPdf}
        >
          {downloadingPdf ? (
            <>
              <Spinner className="w-4 h-4" />
              Preparing…
            </>
          ) : (
            'Download PDF'
          )}
        </button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
        <div className="text-xs sm:text-sm text-gray-700">
          Showing {orders.length ? startIndex + 1 : 0}–{Math.min(startIndex + pageSize, orders.length)} of {orders.length}
        </div>
        <div className="flex items-center gap-2">
          <select className="border rounded px-2 py-1 text-xs sm:text-sm bg-white" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value) || 50)}>
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

      <div className="bg-white border rounded-lg overflow-hidden">
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
              {!pagedOrders.length && (
                <tr>
                  <td className="p-3 text-gray-600" colSpan={6}>
                    {loading ? 'Loading…' : 'No Approved orders.'}
                  </td>
                </tr>
              )}
              {pagedOrders.map((o) => (
                <tr key={o.id} className="border-b last:border-b-0 hover:bg-gray-50">
                  <td className="p-2">
                    <div className="font-medium">#{o.id}</div>
                    <div className="text-gray-600">{o.created_at ? new Date(o.created_at).toLocaleString() : ''}</div>
                  </td>
                  <td className="p-2">
                    <div className="font-medium">{o.member_id}</div>
                    <div className="text-gray-600">{o.member?.full_name || ''}</div>
                    <div className="text-gray-600">{o.member?.phone || ''}</div>
                  </td>
                  <td className="p-2 whitespace-pre-line">
                    <div>{o.delivery_location?.delivery_location || ''}</div>
                    <div className="text-gray-600">{o.delivery_location?.name || ''}</div>
                    <div className="text-gray-600">{o.delivery_location?.phone || ''}</div>
                  </td>
                  <td className="p-2">{o.payment_option || ''}</td>
                  <td className="p-2 text-right">{Number(o.qty || 0).toLocaleString()}</td>
                  <td className="p-2 text-right">
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

export default function RepRamApprovedPage() {
  return (
    <ProtectedRoute allowedRoles={['rep']}>
      <RepRamApprovedContent />
    </ProtectedRoute>
  )
}
