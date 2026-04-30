'use client'

import { useEffect, useMemo, useState } from 'react'
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

function exportTableCsv(filename, rows) {
  if (!rows?.length) return
  const headers = Object.keys(rows[0])
  const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function downloadBase64({ filename, type, data }) {
  const byteCharacters = atob(data)
  const byteNumbers = new Array(byteCharacters.length)
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i)
  }
  const byteArray = new Uint8Array(byteNumbers)
  const blob = new Blob([byteArray], { type: type || 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || 'download'
  a.click()
  URL.revokeObjectURL(url)
}

function toApplicationExportRows(orders) {
  return (orders || []).map((o) => ({
    id: o.id,
    created_at: o.created_at,
    status: o.status,
    payment: o.payment_option,
    member_id: o.member_id,
    member_name: o.member?.full_name || '',
    delivery_location: o.delivery_location?.delivery_location || '',
    vendor_name: o.delivery_location?.name || '',
    vendor_phone: o.delivery_location?.phone || '',
    qty: Number(o.qty || 0),
    unit_price: Number(o.unit_price || 0),
    principal_amount: Number(o.principal_amount || 0),
    interest_amount: Number(o.interest_amount || 0),
    total_amount: Number(o.total_amount || 0),
    signature: '',
  }))
}

function computePaymentVendor(o) {
  const payment = String(o?.payment_option || '').trim()
  const principal = Number(o?.principal_amount || 0)
  if (payment !== 'Loan') return principal
  const interest = Number(o?.interest_amount || 0) || Math.round(principal * 0.06)
  return Math.max(0, principal - interest)
}

function Spinner({ className = '' }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  )
}

function toVendorPaymentExportRows(orders) {
  return (orders || []).map((o) => ({
    id: o.id,
    created_at: o.created_at,
    status: o.status,
    payment: o.payment_option,
    member_id: o.member_id,
    member_name: o.member?.full_name || '',
    delivery_location: o.delivery_location?.delivery_location || '',
    vendor_name: o.delivery_location?.name || '',
    vendor_phone: o.delivery_location?.phone || '',
    qty: Number(o.qty || 0),
    unit_price: Number(o.unit_price || 0),
    principal_amount: Number(o.principal_amount || 0),
    payment_vendor: computePaymentVendor(o),
  }))
}

function SummaryTable({ title, rows, pagination }) {
  const pageSize = Number(pagination?.pageSize || 0)
  const pageCount = pageSize ? Math.max(1, Math.ceil((rows?.length || 0) / pageSize)) : 1
  const safePage = pageSize ? Math.min(Math.max(1, Number(pagination?.page || 1)), pageCount) : 1
  const pagedRows = pageSize ? (rows || []).slice((safePage - 1) * pageSize, safePage * pageSize) : rows

  return (
    <div className="bg-white border rounded-lg overflow-hidden">
      <div className="px-3 py-2 border-b bg-gray-50 text-sm font-medium flex items-center justify-between gap-2">
        <div>{title}</div>
        {pageSize ? (
          <div className="flex items-center gap-2 text-xs font-normal text-gray-700">
            <button
              type="button"
              className="px-2 py-1 rounded border bg-white hover:bg-gray-50 disabled:opacity-50"
              onClick={() => pagination?.onChange?.(Math.max(1, safePage - 1))}
              disabled={safePage <= 1}
            >
              Prev
            </button>
            <div>
              Page {safePage} / {pageCount}
            </div>
            <button
              type="button"
              className="px-2 py-1 rounded border bg-white hover:bg-gray-50 disabled:opacity-50"
              onClick={() => pagination?.onChange?.(Math.min(pageCount, safePage + 1))}
              disabled={safePage >= pageCount}
            >
              Next
            </button>
          </div>
        ) : null}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-white">
            <tr>
              <th className="p-2 border-b text-left">Key</th>
              <th className="p-2 border-b text-right">Orders</th>
              <th className="p-2 border-b text-right">Rams</th>
              <th className="p-2 border-b text-right">Principal</th>
              <th className="p-2 border-b text-right">Interest</th>
            </tr>
          </thead>
          <tbody>
            {!rows?.length && (
              <tr>
                <td className="p-3 text-gray-600" colSpan={5}>
                  No data.
                </td>
              </tr>
            )}
            {(pagedRows || []).map((r) => (
              <tr key={r.key} className="hover:bg-gray-50">
                <td className="p-2 border-b">{r.key}</td>
                <td className="p-2 border-b text-right">{r.orders}</td>
                <td className="p-2 border-b text-right">{r.qty}</td>
                <td className="p-2 border-b text-right">{money(Math.max(0, Number(r.amount || 0) - Number(r.loan_interest || 0)))}</td>
                <td className="p-2 border-b text-right">{money(r.loan_interest)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function RamReportsContent() {
  const [summary, setSummary] = useState(null)
  const [deliveryLocations, setDeliveryLocations] = useState([])
  const [msg, setMsg] = useState(null)
  const [loading, setLoading] = useState(false)
  const [reportBusy, setReportBusy] = useState(false)
  const [byLocationPage, setByLocationPage] = useState(1)
  const [appsLocationId, setAppsLocationId] = useState('')
  const [appsStatus, setAppsStatus] = useState('')
  const [appsPayment, setAppsPayment] = useState('')
  const [appsFrom, setAppsFrom] = useState('')
  const [appsTo, setAppsTo] = useState('')
  const [appsExcelBusy, setAppsExcelBusy] = useState(false)
  const [appsPdfBusy, setAppsPdfBusy] = useState(false)
  const appsBusy = appsExcelBusy || appsPdfBusy

  const [packStatus, setPackStatus] = useState('')
  const [packPayment, setPackPayment] = useState('')
  const [packLocationId, setPackLocationId] = useState('')
  const [packFrom, setPackFrom] = useState('')
  const [packTo, setPackTo] = useState('')
  const [packExcelBusy, setPackExcelBusy] = useState(false)
  const [packPdfBusy, setPackPdfBusy] = useState(false)
  const packBusy = packExcelBusy || packPdfBusy
  const [packProgress, setPackProgress] = useState({ current: 0, total: 0 })

  const [deliveryPackLocationId, setDeliveryPackLocationId] = useState('')
  const [deliveryPackFrom, setDeliveryPackFrom] = useState('')
  const [deliveryPackTo, setDeliveryPackTo] = useState('')
  const [deliveryPackBusy, setDeliveryPackBusy] = useState(false)

  const safeJson = useMemo(() => safeJsonFactory(), [])

  const fetchLocations = async () => {
    try {
      const res = await fetch('/api/admin/ram/delivery-locations', { cache: 'no-store' })
      const json = await safeJson(res, '/api/admin/ram/delivery-locations')
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Failed to load locations')
      setDeliveryLocations(json.locations || [])
    } catch {
      setDeliveryLocations([])
    }
  }

  const fetchSummary = async () => {
    setLoading(true)
    setMsg(null)
    try {
      const res = await fetch('/api/admin/ram/summary', { cache: 'no-store' })
      const json = await safeJson(res, '/api/admin/ram/summary')
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Failed to load')
      setSummary(json)
    } catch (e) {
      setSummary(null)
      setMsg({ type: 'error', text: e?.message || 'Failed to load' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLocations()
    fetchSummary()
  }, [])

  const totals = summary?.totals || { orders: 0, qty: 0, amount: 0, loan_interest: 0 }
  const byStatus = summary?.byStatus || []
  const byPayment = summary?.byPayment || []
  const byCategory = summary?.byCategory || []
  const byLocation = summary?.byLocation || []
  const cashAgg = byPayment.find((r) => String(r?.key || '') === 'Cash') || { orders: 0, qty: 0, amount: 0, loan_interest: 0 }
  const savingsAgg = byPayment.find((r) => String(r?.key || '') === 'Savings') || { orders: 0, qty: 0, amount: 0, loan_interest: 0 }
  const loanAgg = byPayment.find((r) => String(r?.key || '') === 'Loan') || { orders: 0, qty: 0, amount: 0, loan_interest: 0 }
  const cashPrincipalAmount = Math.max(0, Number(cashAgg.amount || 0) - Number(cashAgg.loan_interest || 0))
  const savingsPrincipalAmount = Math.max(0, Number(savingsAgg.amount || 0) - Number(savingsAgg.loan_interest || 0))
  const loanPrincipalAmount = Math.max(0, Number(loanAgg.amount || 0) - Number(loanAgg.loan_interest || 0))
  const totalPrincipalAmount = Math.max(0, Number(totals.amount || 0) - Number(totals.loan_interest || 0))
  const locations = useMemo(
    () =>
      (deliveryLocations || [])
        .filter((l) => l.is_active !== false)
        .slice()
        .sort((a, b) => String(a.delivery_location || '').localeCompare(String(b.delivery_location || ''))),
    [deliveryLocations]
  )

  const refreshAll = () => {
    fetchLocations()
    fetchSummary()
  }

  useEffect(() => {
    const pageCount = Math.max(1, Math.ceil((byLocation?.length || 0) / 3))
    setByLocationPage((p) => Math.min(Math.max(1, p), pageCount))
  }, [byLocation])

  const downloadReport = async () => {
    if (!summary) return
    setReportBusy(true)
    setMsg(null)
    try {
      const { jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const sanitize = (s) => String(s ?? '').replace(/\u20A6|₦/g, 'NGN ').replace(/[\u2013\u2014]/g, '-')
      const asInt = (v) => Number(v || 0)
      const asMoney = (v) => `NGN ${asInt(v).toLocaleString()}`
      const asPrincipal = (r) => Math.max(0, asInt(r?.amount) - asInt(r?.loan_interest))

      doc.setFontSize(14)
      doc.text('Ram Sales — Report', 12, 12)
      doc.setFontSize(9)
      doc.text(`Generated: ${new Date().toLocaleString()}`, 12, 18)

      autoTable(doc, {
        head: [['Metric', 'Value', 'Note']],
        body: [
          ['Total Orders', String(totals.orders ?? 0), ''],
          ['Total Rams', String(totals.qty ?? 0), ''],
          ['Cash', asMoney(cashPrincipalAmount), `${Number(cashAgg.orders || 0)} order(s)`],
          ['Savings', asMoney(savingsPrincipalAmount), `${Number(savingsAgg.orders || 0)} order(s)`],
          ['Loan', asMoney(loanPrincipalAmount), `${Number(loanAgg.orders || 0)} order(s)`],
          ['Loan Interest', asMoney(totals.loan_interest), ''],
          ['Total', asMoney(totals.amount), ''],
        ].map((r) => r.map(sanitize)),
        startY: 22,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [75, 85, 99] },
        alternateRowStyles: { fillColor: [249, 250, 251] },
        margin: { left: 12, right: 12 },
      })

      const addSummarySection = (title, rows) => {
        const body = (rows || []).map((r) => [
          sanitize(r.key),
          String(r.orders ?? 0),
          String(r.qty ?? 0),
          sanitize(asMoney(asPrincipal(r))),
          sanitize(asMoney(r.loan_interest)),
        ])

        let startY = (doc.lastAutoTable?.finalY || 22) + 10
        if (startY > 180) {
          doc.addPage()
          startY = 22
        }
        doc.setFontSize(12)
        doc.text(title, 12, startY - 2)
        autoTable(doc, {
          head: [['Key', 'Orders', 'Rams', 'Principal', 'Interest']],
          body,
          startY,
          styles: { fontSize: 9 },
          headStyles: { fillColor: [75, 85, 99] },
          alternateRowStyles: { fillColor: [249, 250, 251] },
          columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
          margin: { left: 12, right: 12 },
        })
      }

      addSummarySection('By Status', byStatus)
      addSummarySection('By Payment', byPayment)
      addSummarySection('By Category', byCategory)
      addSummarySection('By Delivery Location', byLocation)

      doc.save(`ram_report_${new Date().toISOString().split('T')[0]}.pdf`)
    } catch (e) {
      setMsg({ type: 'error', text: e?.message || 'Download failed' })
    } finally {
      setReportBusy(false)
    }
  }

  const fetchApplications = async (opts) => {
    const qs = new URLSearchParams({ limit: String(opts?.limit || '1000') })
    if (opts?.status) qs.set('status', opts.status)
    if (opts?.payment) qs.set('payment', opts.payment)
    if (opts?.delivery_location_id) qs.set('delivery_location_id', String(opts.delivery_location_id))
    if (opts?.from) qs.set('from', opts.from)
    if (opts?.to) qs.set('to', opts.to)
    const res = await fetch(`/api/admin/ram-orders/list?${qs.toString()}`, { cache: 'no-store' })
    const json = await safeJson(res, '/api/admin/ram-orders/list')
    if (!res.ok || !json?.ok) throw new Error(json?.error || 'Failed to load applications')
    return json.orders || []
  }

  const exportApplicationsExcel = async () => {
    setAppsExcelBusy(true)
    setMsg(null)
    try {
      const orders = await fetchApplications({
        delivery_location_id: appsLocationId || undefined,
        status: appsStatus,
        payment: appsPayment,
        from: appsFrom,
        to: appsTo,
        limit: 10000,
      })
      const ExcelJSMod = await import('exceljs')
      const ExcelJS = ExcelJSMod?.default ?? ExcelJSMod
      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet('Applications')
      const locLabel = appsLocationId ? (locations.find((l) => String(l.id) === String(appsLocationId))?.delivery_location || String(appsLocationId)) : 'All delivery locations'
      ws.addRow(['Ram Sales — Applications'])
      ws.addRow([`Location: ${locLabel} | Status: ${appsStatus || 'All'} | Payment: ${appsPayment || 'All'} | From: ${appsFrom || 'Any'} | To: ${appsTo || 'Any'}`])
      const rows = toApplicationExportRows(orders)
      ws.addRow(Object.keys(rows[0] || { id: '' }))
      for (const r of rows) {
        ws.addRow(Object.keys(rows[0] || { id: '' }).map((k) => r[k]))
      }
      const buffer = await wb.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const slug = appsLocationId ? `location_${appsLocationId}` : 'all_locations'
      a.download = `ram_applications_${slug}_${new Date().toISOString().split('T')[0]}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setMsg({ type: 'error', text: e?.message || 'Download failed' })
    } finally {
      setAppsExcelBusy(false)
    }
  }

  const exportApplicationsPdf = async () => {
    setAppsPdfBusy(true)
    setMsg(null)
    try {
      const orders = await fetchApplications({
        delivery_location_id: appsLocationId || undefined,
        status: appsStatus,
        payment: appsPayment,
        from: appsFrom,
        to: appsTo,
        limit: 10000,
      })
      const { jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

      const sanitize = (s) => String(s ?? '').replace(/\u20A6|₦/g, 'NGN ').replace(/[\u2013\u2014]/g, '-')
      const locLabel = appsLocationId ? (locations.find((l) => String(l.id) === String(appsLocationId))?.delivery_location || String(appsLocationId)) : 'All delivery locations'
      const filters = [
        `Location: ${locLabel}`,
        `Status: ${appsStatus || 'All'}`,
        `Payment: ${appsPayment || 'All'}`,
        `From: ${appsFrom || 'Any'}`,
        `To: ${appsTo || 'Any'}`,
      ].join('  |  ')

      doc.setFontSize(14)
      doc.text('Ram Sales — Applications', 12, 12)
      doc.setFontSize(9)
      doc.text(`Generated: ${new Date().toLocaleString()}`, 12, 18)
      doc.text(`Filters: ${sanitize(filters)}`, 12, 24)

      const head = [
        [
          'OrderID',
          'CreatedAt',
          'Status',
          'Payment',
          'MemberID',
          'MemberName',
          'DeliveryLocation',
          'VendorName',
          'VendorPhone',
          'Qty',
          'Unit Price',
          'Principal',
          'Interest',
          'Total',
          'Signature',
        ],
      ]

      const body = (orders || []).map((o) => [
        String(o.id ?? ''),
        o.created_at ? new Date(o.created_at).toLocaleString() : '',
        sanitize(o.status || ''),
        sanitize(o.payment_option || ''),
        sanitize(o.member_id),
        sanitize(o.member?.full_name || ''),
        sanitize(o.delivery_location?.delivery_location || o.delivery_location?.name || ''),
        sanitize(o.delivery_location?.name || ''),
        sanitize(o.delivery_location?.phone || ''),
        String(Number(o.qty || 0)),
        `NGN ${Number(o.unit_price || 0).toLocaleString()}`,
        `NGN ${Number(o.principal_amount || 0).toLocaleString()}`,
        `NGN ${Number(o.interest_amount || 0).toLocaleString()}`,
        `NGN ${Number(o.total_amount || 0).toLocaleString()}`,
        '',
      ])

      const totals = (orders || []).reduce(
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
        '',
        '',
        '',
        String(totals.qty.toLocaleString()),
        '',
        `NGN ${totals.principal.toLocaleString()}`,
        `NGN ${totals.interest.toLocaleString()}`,
        `NGN ${totals.total.toLocaleString()}`,
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
          9: { halign: 'right' },
          10: { halign: 'right' },
          11: { halign: 'right' },
          12: { halign: 'right' },
          13: { halign: 'right' },
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.row.index === totalsRowIndex) {
            data.cell.styles.fontStyle = 'bold'
            data.cell.styles.fillColor = [243, 244, 246]
          }
        },
        margin: { left: 12, right: 12 },
      })

      const slug = appsLocationId ? `location_${appsLocationId}` : 'all_locations'
      doc.save(`ram_applications_${slug}_${new Date().toISOString().split('T')[0]}.pdf`)
    } catch (e) {
      setMsg({ type: 'error', text: e?.message || 'Download failed' })
    } finally {
      setAppsPdfBusy(false)
    }
  }

  const exportVendorPaymentsPackExcel = async () => {
    if (!locations.length) return
    setPackExcelBusy(true)
    const selectedLocations = packLocationId ? locations.filter((l) => String(l.id) === String(packLocationId)) : locations
    setPackProgress({ current: 0, total: selectedLocations.length })
    setMsg(null)
    try {
      const ExcelJSMod = await import('exceljs')
      const ExcelJS = ExcelJSMod?.default ?? ExcelJSMod
      const wb = new ExcelJS.Workbook()
      const safeName = (name) => String(name || 'Sheet').replace(/[\\/?*\[\]]/g, ' ').slice(0, 31) || 'Sheet'

      let i = 0
      for (const loc of selectedLocations) {
        i += 1
        setPackProgress({ current: i, total: selectedLocations.length })
        const orders = await fetchApplications({
          delivery_location_id: loc.id,
          status: packStatus,
          payment: packPayment,
          from: packFrom,
          to: packTo,
          limit: 10000,
        })
        const ws = wb.addWorksheet(safeName(loc.delivery_location || loc.name || `Location ${loc.id}`))
        ws.addRow(['Ram Sales — Payment to Vendors'])
        ws.addRow([`Location: ${loc.delivery_location || loc.name || `Location ${loc.id}`}`])
        ws.addRow([`Filters: Status ${packStatus || 'All'} | Payment ${packPayment || 'All'} | From ${packFrom || 'Any'} | To ${packTo || 'Any'}`])
        const rows = toVendorPaymentExportRows(orders)
        const headers = Object.keys(rows[0] || { id: '' })
        ws.addRow(headers)
        for (const r of rows) {
          ws.addRow(headers.map((h) => r[h]))
        }
      }

      const buffer = await wb.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const slug = packLocationId ? `location_${packLocationId}` : 'all_locations'
      a.download = `ram_payment_to_vendors_${slug}_${new Date().toISOString().split('T')[0]}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setMsg({ type: 'error', text: e?.message || 'Download failed' })
    } finally {
      setPackExcelBusy(false)
      setPackProgress({ current: 0, total: 0 })
    }
  }

  const exportVendorPaymentsPackPdf = async () => {
    if (!locations.length) return
    setPackPdfBusy(true)
    const selectedLocations = packLocationId ? locations.filter((l) => String(l.id) === String(packLocationId)) : locations
    setPackProgress({ current: 0, total: selectedLocations.length })
    setMsg(null)
    try {
      const { jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const sanitize = (s) => String(s ?? '').replace(/\u20A6|₦/g, 'NGN ').replace(/[\u2013\u2014]/g, '-')

      doc.setFontSize(14)
      doc.text('Ram Sales — Payment to Vendors', 12, 12)
      doc.setFontSize(9)
      doc.text(`Generated: ${new Date().toLocaleString()}`, 12, 18)
      doc.text(
        `Filters: Status ${sanitize(packStatus || 'All')}  |  Payment ${sanitize(packPayment || 'All')}  |  From ${sanitize(packFrom || 'Any')}  |  To ${sanitize(packTo || 'Any')}`,
        12,
        24
      )

      let i = 0
      for (const loc of selectedLocations) {
        i += 1
        setPackProgress({ current: i, total: selectedLocations.length })
        const orders = await fetchApplications({
          delivery_location_id: loc.id,
          status: packStatus,
          payment: packPayment,
          from: packFrom,
          to: packTo,
          limit: 10000,
        })
        const rows = toVendorPaymentExportRows(orders)
        const locTitle = sanitize(loc.delivery_location || loc.name || `Location ${loc.id}`)
        let y = (doc.lastAutoTable?.finalY || 0) ? (doc.lastAutoTable.finalY + 8) : 32
        if (y > 180) {
          doc.addPage()
          y = 32
        }
        doc.setFontSize(11)
        doc.text(`Location: ${locTitle}`, 12, y)

        const head = [[
          'id',
          'created_at',
          'status',
          'payment',
          'member_id',
          'member_name',
          'delivery_location',
          'vendor_name',
          'vendor_phone',
          'qty',
          'unit_price',
          'principal_amount',
          'payment_vendor',
        ]]

        const body = rows.map((r) => [
          String(r.id ?? ''),
          r.created_at ? new Date(r.created_at).toLocaleString() : '',
          sanitize(r.status || ''),
          sanitize(r.payment || ''),
          sanitize(r.member_id || ''),
          sanitize(r.member_name || ''),
          sanitize(r.delivery_location || ''),
          sanitize(r.vendor_name || ''),
          sanitize(r.vendor_phone || ''),
          String(Number(r.qty || 0)),
          `NGN ${Number(r.unit_price || 0).toLocaleString()}`,
          `NGN ${Number(r.principal_amount || 0).toLocaleString()}`,
          `NGN ${Number(r.payment_vendor || 0).toLocaleString()}`,
        ])

        const totals = rows.reduce(
          (acc, r) => {
            acc.qty += Number(r.qty || 0)
            acc.principal += Number(r.principal_amount || 0)
            acc.pay += Number(r.payment_vendor || 0)
            return acc
          },
          { qty: 0, principal: 0, pay: 0 }
        )
        const totalsRowIndex = body.length
        body.push([
          'TOTAL',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          String(totals.qty.toLocaleString()),
          '',
          `NGN ${totals.principal.toLocaleString()}`,
          `NGN ${totals.pay.toLocaleString()}`,
        ])

        autoTable(doc, {
          head,
          body,
          startY: y + 6,
          styles: { fontSize: 7 },
          headStyles: { fillColor: [75, 85, 99] },
          alternateRowStyles: { fillColor: [249, 250, 251] },
          columnStyles: { 9: { halign: 'right' }, 10: { halign: 'right' }, 11: { halign: 'right' }, 12: { halign: 'right' } },
          didParseCell: (data) => {
            if (data.section === 'body' && data.row.index === totalsRowIndex) {
              data.cell.styles.fontStyle = 'bold'
              data.cell.styles.fillColor = [243, 244, 246]
            }
          },
          margin: { left: 12, right: 12 },
        })
      }

      const slug = packLocationId ? `location_${packLocationId}` : 'all_locations'
      doc.save(`ram_payment_to_vendors_${slug}_${new Date().toISOString().split('T')[0]}.pdf`)
    } catch (e) {
      setMsg({ type: 'error', text: e?.message || 'Download failed' })
    } finally {
      setPackPdfBusy(false)
      setPackProgress({ current: 0, total: 0 })
    }
  }

  const downloadDeliveryPack = async () => {
    setDeliveryPackBusy(true)
    setMsg(null)
    try {
      const qs = new URLSearchParams()
      if (deliveryPackLocationId) qs.set('delivery_location_id', deliveryPackLocationId)
      if (deliveryPackFrom) qs.set('from', deliveryPackFrom)
      if (deliveryPackTo) qs.set('to', deliveryPackTo)

      const res = await fetch(`/api/admin/ram/reports/delivery-pack?${qs.toString()}`, { cache: 'no-store' })
      const json = await safeJson(res, '/api/admin/ram/reports/delivery-pack')
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Download failed')
      downloadBase64(json)
    } catch (e) {
      setMsg({ type: 'error', text: e?.message || 'Download failed' })
    } finally {
      setDeliveryPackBusy(false)
    }
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h1 className="text-base sm:text-lg md:text-xl font-semibold break-words">Admin — Ram Sales — Report</h1>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm" onClick={refreshAll}>
            Refresh
          </button>
          <button
            className="px-4 py-2 bg-gray-700 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-gray-800 transition-colors shadow-sm disabled:opacity-50"
            onClick={downloadReport}
            disabled={!summary || reportBusy}
          >
            {reportBusy ? (
              <span className="inline-flex items-center gap-2">
                <Spinner className="w-4 h-4" />
                Preparing…
              </span>
            ) : (
              'Download Report'
            )}
          </button>
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-3 mb-4">
        <div className="bg-white border rounded-lg p-4">
          <div className="text-xs text-gray-500">Total Orders</div>
          <div className="text-lg font-semibold">{loading ? '...' : totals.orders}</div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="text-xs text-gray-500">Total Rams</div>
          <div className="text-lg font-semibold">{loading ? '...' : totals.qty}</div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="text-xs text-gray-500">Cash</div>
          <div className="text-lg font-semibold">{loading ? '...' : money(cashPrincipalAmount)}</div>
          <div className="text-xs text-gray-500 mt-1">{loading ? '' : `${Number(cashAgg.orders || 0)} order(s)`}</div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="text-xs text-gray-500">Savings</div>
          <div className="text-lg font-semibold">{loading ? '...' : money(savingsPrincipalAmount)}</div>
          <div className="text-xs text-gray-500 mt-1">{loading ? '' : `${Number(savingsAgg.orders || 0)} order(s)`}</div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="text-xs text-gray-500">Loan</div>
          <div className="text-lg font-semibold">{loading ? '...' : money(loanPrincipalAmount)}</div>
          <div className="text-xs text-gray-500 mt-1">{loading ? '' : `${Number(loanAgg.orders || 0)} order(s)`}</div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="text-xs text-gray-500">Loan Interest</div>
          <div className="text-lg font-semibold">{loading ? '...' : money(totals.loan_interest)}</div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="text-xs text-gray-500">Total</div>
          <div className="text-lg font-semibold">{loading ? '...' : money(totals.amount)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SummaryTable title="By Status" rows={byStatus} />
        <SummaryTable title="By Payment" rows={byPayment} />
        <SummaryTable title="By Category" rows={byCategory} />
        <SummaryTable title="By Delivery Location" rows={byLocation} pagination={{ page: byLocationPage, pageSize: 3, onChange: setByLocationPage }} />
      </div>

      <div className="mt-6 bg-white border rounded-lg p-3 sm:p-4">
        <div className="text-sm font-semibold text-gray-900">Applications by Delivery Location</div>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
          <select className="border rounded px-3 py-2 text-xs sm:text-sm w-full" value={appsLocationId} onChange={(e) => setAppsLocationId(e.target.value)}>
            <option value="">All delivery locations</option>
            {locations.map((l) => (
              <option key={l.id} value={String(l.id)}>
                {l.delivery_location || l.name}
              </option>
            ))}
          </select>

          <select className="border rounded px-3 py-2 text-xs sm:text-sm w-full" value={appsStatus} onChange={(e) => setAppsStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Cancelled">Cancelled</option>
          </select>

          <select className="border rounded px-3 py-2 text-xs sm:text-sm w-full" value={appsPayment} onChange={(e) => setAppsPayment(e.target.value)}>
            <option value="">All payments</option>
            <option value="Cash">Cash</option>
            <option value="Loan">Loan</option>
            <option value="Savings">Savings</option>
          </select>

          <input type="date" className="border rounded px-3 py-2 text-xs sm:text-sm w-full" value={appsFrom} onChange={(e) => setAppsFrom(e.target.value)} />
          <input type="date" className="border rounded px-3 py-2 text-xs sm:text-sm w-full" value={appsTo} onChange={(e) => setAppsTo(e.target.value)} />
        </div>

        <div className="mt-3 flex flex-col sm:flex-row gap-2">
          <button
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
            onClick={exportApplicationsExcel}
            disabled={appsBusy}
          >
            {appsExcelBusy ? (
              <span className="inline-flex items-center gap-2">
                <Spinner className="w-4 h-4" />
                Preparing…
              </span>
            ) : (
              'Download Excel'
            )}
          </button>
          <button
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
            onClick={exportApplicationsPdf}
            disabled={appsBusy}
          >
            {appsPdfBusy ? (
              <span className="inline-flex items-center gap-2">
                <Spinner className="w-4 h-4" />
                Preparing…
              </span>
            ) : (
              'Download PDF'
            )}
          </button>
        </div>
      </div>

      <div className="mt-4 bg-white border rounded-lg p-3 sm:p-4">
        <div className="text-sm font-semibold text-gray-900">Applications Pack by Payment to Vendors</div>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
          <select className="border rounded px-3 py-2 text-xs sm:text-sm w-full" value={packLocationId} onChange={(e) => setPackLocationId(e.target.value)}>
            <option value="">All delivery locations</option>
            {locations.map((l) => (
              <option key={l.id} value={String(l.id)}>
                {l.delivery_location || l.name}
              </option>
            ))}
          </select>
          <select className="border rounded px-3 py-2 text-xs sm:text-sm w-full" value={packStatus} onChange={(e) => setPackStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Cancelled">Cancelled</option>
          </select>
          <select className="border rounded px-3 py-2 text-xs sm:text-sm w-full" value={packPayment} onChange={(e) => setPackPayment(e.target.value)}>
            <option value="">All payments</option>
            <option value="Cash">Cash</option>
            <option value="Loan">Loan</option>
            <option value="Savings">Savings</option>
          </select>
          <input type="date" className="border rounded px-3 py-2 text-xs sm:text-sm w-full" value={packFrom} onChange={(e) => setPackFrom(e.target.value)} />
          <input type="date" className="border rounded px-3 py-2 text-xs sm:text-sm w-full" value={packTo} onChange={(e) => setPackTo(e.target.value)} />
        </div>

        <div className="mt-3 flex flex-col sm:flex-row items-start sm:items-center gap-2">
          <button
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
            onClick={exportVendorPaymentsPackExcel}
            disabled={packBusy || !locations.length}
          >
            {packExcelBusy ? (
              <span className="inline-flex items-center gap-2">
                <Spinner className="w-4 h-4" />
                Preparing…
              </span>
            ) : (
              'Download Excel'
            )}
          </button>
          <button
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
            onClick={exportVendorPaymentsPackPdf}
            disabled={packBusy || !locations.length}
          >
            {packPdfBusy ? (
              <span className="inline-flex items-center gap-2">
                <Spinner className="w-4 h-4" />
                Preparing…
              </span>
            ) : (
              'Download PDF'
            )}
          </button>
          {packBusy && packProgress?.total ? (
            <div className="text-xs sm:text-sm text-gray-600">
              {packProgress.current}/{packProgress.total}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-4 bg-white border rounded-lg p-3 sm:p-4">
        <div className="text-sm font-semibold text-gray-900">Delivery Pack (Master/Cash/Loan/Savings)</div>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          <select
            className="border rounded px-3 py-2 text-xs sm:text-sm w-full"
            value={deliveryPackLocationId}
            onChange={(e) => setDeliveryPackLocationId(e.target.value)}
          >
            <option value="">All delivery locations</option>
            {locations.map((l) => (
              <option key={l.id} value={String(l.id)}>
                {l.delivery_location || l.name}
              </option>
            ))}
          </select>
          <input type="date" className="border rounded px-3 py-2 text-xs sm:text-sm w-full" value={deliveryPackFrom} onChange={(e) => setDeliveryPackFrom(e.target.value)} />
          <input type="date" className="border rounded px-3 py-2 text-xs sm:text-sm w-full" value={deliveryPackTo} onChange={(e) => setDeliveryPackTo(e.target.value)} />
        </div>
        <div className="mt-3">
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            onClick={downloadDeliveryPack}
            disabled={deliveryPackBusy}
          >
            {deliveryPackBusy ? (
              <span className="inline-flex items-center gap-2">
                <Spinner className="w-4 h-4" />
                Preparing…
              </span>
            ) : (
              'Download Delivery Pack'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function RamReportsPage() {
  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <RamReportsContent />
    </ProtectedRoute>
  )
}
