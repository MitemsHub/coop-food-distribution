// app/rep/posted/page.jsx
'use client'

import { useEffect, useMemo, useState } from 'react'
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

function RepPostedPageContent() {
  const [orders, setOrders] = useState([])
  const [departments, setDepartments] = useState([])
  const [dept, setDept] = useState('') // '' = All
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [msg, setMsg] = useState(null)
  const [loading, setLoading] = useState(false)
  const [didLoadOnce, setDidLoadOnce] = useState(false)
  const [deliveringOrder, setDeliveringOrder] = useState(null) // Track which order is being delivered
  const [pageSize] = useState(50)
  const [cursorStack, setCursorStack] = useState([null])
  const [pageIndex, setPageIndex] = useState(0)
  const [nextCursor, setNextCursor] = useState(null)
  const [showModal, setShowModal] = useState(null)
  const [modalInput, setModalInput] = useState('')
  const [itemsPackLoading, setItemsPackLoading] = useState(false)
  const [excelLoading, setExcelLoading] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)
  const [viewOrder, setViewOrder] = useState(null)
  const { user } = useAuth()

  const safeJson = async (res, label) => {
    const ct = res.headers.get('content-type') || ''
    if (ct.includes('application/json')) return await res.json()
    const text = await res.text()
    throw new Error(`Non-JSON response from ${label} (${res.status}): ${text.slice(0, 300)}`)
  }

  const filteredOrders = useMemo(() => {
    const s = String(search || '').trim().toLowerCase()
    if (!s) return orders || []
    return (orders || []).filter((o) => {
      const hay = `${o.order_id} ${o.member_id} ${o.member_name_snapshot || ''}`.toLowerCase()
      return hay.includes(s)
    })
  }, [orders, search])

  const openView = (o) => {
    setViewOrder(o)
    setViewOpen(true)
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

  useEffect(() => { 
    if (user?.type !== 'rep' || !user?.authenticated) return
    fetchOrders(null) 
  }, [dept, user])

  const resetPagination = () => {
    setCursorStack([null])
    setPageIndex(0)
    setNextCursor(null)
  }

  const fetchOrders = async (cursorOverride) => {
    setLoading(true); setMsg(null)
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), 5000)
    try {
      const cursor = cursorOverride !== undefined ? cursorOverride : cursorStack[pageIndex] || null
      const qs = new URLSearchParams({ status: 'Posted', limit: String(pageSize) })
      if (dept) qs.set('dept', dept)
      if (cursor) { qs.set('cursor', String(cursor)); qs.set('dir', 'next') }
      const res = await fetch(`/api/rep/orders/list?${qs.toString()}`, { cache: 'no-store', headers:{ 'Accept':'application/json' }, signal: ctl.signal })
      const json = await safeJson(res, '/api/rep/orders/list')
      if (!res.ok || !json.ok) throw new Error(json.error || 'Failed')
      setOrders(json.orders || [])
      setNextCursor(json.nextCursor || null)
    } catch (e) {
      if (e.name !== 'AbortError') setMsg({ type:'error', text:e.message })
    } finally {
      clearTimeout(timer)
      setLoading(false)
      setDidLoadOnce(true)
    }
  }

  // Collect all posted orders for current filters (used by exports to avoid pagination truncation)
  const collectAllOrdersForExport = async () => {
    const base = new URLSearchParams({ status: 'Posted', limit: '200' })
    if (dept) base.set('dept', dept)
    let cursor = null
    let all = []
    for (let page = 0; page < 100; page++) { // hard cap to prevent infinite loops
      const qs = new URLSearchParams(base)
      if (cursor) { qs.set('cursor', cursor); qs.set('dir', 'next') }
      const res = await fetch(`/api/rep/orders/list?${qs.toString()}`, { cache: 'no-store', headers:{ 'Accept':'application/json' } })
      const j = await safeJson(res, '/api/rep/orders/list')
      if (!res.ok || !j.ok) throw new Error(j.error || 'Failed to collect orders for export')
      all = all.concat(j.orders || [])
      if (!j.nextCursor) break
      cursor = j.nextCursor
    }
    return all
  }

  const deliverOne = async (id) => {
    setShowModal({ 
      type: 'deliver', 
      orderId: id, 
      title: 'Deliver Order', 
      message: `Mark order ${id} as delivered?`,
      placeholder: 'Delivered by (name or rep)'
    })
    setModalInput('rep')
  }

  const handleDeliverSubmit = async () => {
    const { orderId } = showModal
    const deliveredBy = modalInput.trim() || 'rep'
    setDeliveringOrder(orderId)
    try {
      const ctl = new AbortController()
      const timer = setTimeout(() => ctl.abort(), 8000)
      const res = await fetch('/api/rep/orders/deliver', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', 'Accept':'application/json' },
        credentials: 'include',
        body: JSON.stringify({ orderId, deliveredBy }),
        signal: ctl.signal
      })
      const j = await safeJson(res, '/api/rep/orders/deliver')
      if (!res.ok || !j.ok) throw new Error(j.error || 'Deliver failed')
      setOrders(orders.filter(o => o.order_id !== orderId))
      setMsg({ type:'success', text:`Order ${orderId} delivered successfully` })
      setModalInput('')
    } catch (e) {
      if (e.name === 'AbortError') {
        setMsg({ type:'error', text:'Delivery request timed out after 8s. Please check network and try again.' })
      } else {
        setMsg({ type:'error', text:e.message })
      }
    } finally {
      try { clearTimeout(timer) } catch {}
      setDeliveringOrder(null)
      // Always close the modal after finishing (success or error)
      setShowModal(null)
    }
  }

  const exportPDF = async () => {
    // Load all pages to prevent partial exports
    const sourceOrders = await collectAllOrdersForExport()
    if (!sourceOrders.length) return alert('No rows to export')
    setPdfLoading(true)
    try {
      const { jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')
      // Use A4 landscape to give more horizontal room for 11 columns
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

    // Determine delivery branch from filtered data
    const filteredForHeader = !search ? sourceOrders : sourceOrders.filter(o => {
      const s = search.toLowerCase()
      return String(o.order_id).toLowerCase().includes(s) || String(o.member_id).toLowerCase().includes(s)
    })
    const branchSet = new Set(filteredForHeader.map(o => o?.delivery?.name).filter(Boolean))
    const branchLabel = branchSet.size === 1 ? [...branchSet][0] : (branchSet.size > 1 ? 'Multiple Delivery Branches' : 'All Delivery Branches')

    // Header (first page)
    doc.setFontSize(14)
    doc.text('Posted Orders Manifest', 12, 12)
    doc.setFontSize(9)
    doc.text(`Generated: ${new Date().toLocaleString()}`, 12, 18)
    doc.text(`Delivery Branch: ${branchLabel}${dept ? '  |  Department: ' + dept : ''}`, 12, 24)

    // Build table rows
    const headers = ['ID','Order','Member','Dept','Pay','Item','Qty','Unit Price','Amount','Remarks','Sign']
    const sanitize = (s) => String(s ?? '').replace(/\u20A6|₦/g, 'NGN ').replace(/[\u2013\u2014]/g, '-')
    const filtered = !search ? sourceOrders : sourceOrders.filter(o => {
      const s = search.toLowerCase()
      return String(o.order_id).toLowerCase().includes(s) || String(o.member_id).toLowerCase().includes(s)
    })
    const rows = filtered.flatMap(o => (o.order_lines || [])
      .filter(l => {
        if (!dept) return true
        const orderDeptName = o.departments?.name
        const itemDeptId = l?.items?.department_id
        const orderMatches = String(orderDeptName || '').trim().toLowerCase() === String(dept).trim().toLowerCase()
        return orderMatches || Boolean(itemDeptId)
      })
      .map(l => ([
      sanitize(o.member_id),
      sanitize(o.order_id),
      sanitize(o.member_name_snapshot),
      sanitize(o.departments?.name),
      sanitize(o.payment_option),
      sanitize(l.items?.name),
      String(l.qty || 0),
      `NGN ${Number(l.unit_price || 0).toLocaleString()}`,
      `NGN ${Number(l.amount || 0).toLocaleString()}`,
      '',
      '',
    ])))

    // Compute totals for Qty and Amount
    const lineItems = filtered.flatMap(o => (o.order_lines || [])
      .filter(l => {
        if (!dept) return true
        const orderDeptName = o.departments?.name
        const itemDeptId = l?.items?.department_id
        const orderMatches = String(orderDeptName || '').trim().toLowerCase() === String(dept).trim().toLowerCase()
        return orderMatches || Boolean(itemDeptId)
      }))
    const totalQty = lineItems.reduce((acc, l) => acc + Number(l?.qty || 0), 0)
    const totalAmount = lineItems.reduce((acc, l) => acc + Number(l?.amount || 0), 0)
    // Create a foot row: label under Item, totals under Qty and Amount
    const footRow = headers.map((_, i) => {
      if (i === 5) return 'TOTAL'
      if (i === 6) return String(totalQty)
      if (i === 8) return `NGN ${Number(totalAmount).toLocaleString()}`
      return ''
    })

    autoTable(doc, {
      head: [headers],
      body: rows,
      foot: [footRow],
      showFoot: 'lastPage',
      startY: 30,
      margin: { top: 28, left: 10, right: 10 },
      styles: { fontSize: 8, cellPadding: 1.5, overflow: 'linebreak', lineWidth: 0.1, lineColor: [0, 0, 0] },
      theme: 'grid',
      headStyles: { fillColor: [75, 85, 99], fontSize: 9, halign: 'center', valign: 'middle', textColor: [255,255,255] },
      // Stronger, high-contrast styles for the totals row (match body font size)
      footStyles: { fillColor: [75, 85, 99], textColor: [255,255,255], fontStyle: 'bold', fontSize: 8, halign: 'right', lineWidth: 0.1 },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      columnStyles: {
        0: { cellWidth: 16 },   // ID
        1: { cellWidth: 14 },   // Order
        2: { cellWidth: 40 },   // Member
        3: { cellWidth: 28 },   // Dept
        4: { cellWidth: 16 },   // Pay
        5: { cellWidth: 45 },   // Item
        6: { cellWidth: 12, halign: 'right' },   // Qty
        7: { cellWidth: 22, halign: 'right' },   // Unit Price
        8: { cellWidth: 24, halign: 'right' },   // Amount
        9: { cellWidth: 36 },   // Remarks
        10: { cellWidth: 14 },  // Signature
      },
      // Ensure label and numeric cells are aligned appropriately in the foot
      didParseCell: (data) => {
        if (data.section === 'foot') {
          if (data.column.index === 5) {
            data.cell.styles.halign = 'center' // TOTAL label under Item
          }
          if (data.column.index === 6 || data.column.index === 8) {
            data.cell.styles.halign = 'right' // Qty and Amount totals
          }
        }
      },
      didDrawPage: (data) => {
        // Repeat header on subsequent pages
        if (data.pageNumber > 1) {
          doc.setFontSize(14)
          doc.text('Posted Orders Manifest', 12, 12)
          doc.setFontSize(9)
          doc.text(`Generated: ${new Date().toLocaleString()}`, 12, 18)
          doc.text(`Delivery Branch: ${branchLabel}${dept ? '  |  Department: ' + dept : ''}`, 12, 24)
        }
      }
    })
    // Footer rows appended after main table
    const makeRow = (mapper) => headers.map((_, i) => mapper(i))
    const sigDateRow = makeRow(i => i === 4 ? 'DATE' : (i === 5 ? 'SIGNATURE' : ''))
    const issuedRow = makeRow(i => i === 2 ? 'ITEMS ISSUED BY' : '')
    const receivedRow = makeRow(i => i === 2 ? 'ITEMS RECEIVED BY' : '')
    autoTable(doc, {
      head: [],
      body: [sigDateRow, issuedRow, receivedRow],
      startY: (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY + 6 : undefined,
      styles: { fontSize: 9, lineWidth: 0.1, lineColor: [0,0,0], cellPadding: 2 },
      theme: 'grid'
    })
    doc.save('rep_posted_manifest.pdf')
    } catch (error) {
      console.error('Error exporting PDF:', error)
      alert(`PDF export failed: ${error.message}`)
    } finally {
      setPdfLoading(false)
    }
  }

  const exportExcel = async () => {
    setExcelLoading(true)
    // Load all pages to prevent partial exports
    const sourceOrders = await collectAllOrdersForExport()
    const filtered = !search ? sourceOrders : sourceOrders.filter(o => {
      const s = search.toLowerCase()
      return String(o.order_id).toLowerCase().includes(s) || String(o.member_id).toLowerCase().includes(s)
    })
    const rows = filtered.flatMap(o => (o.order_lines || [])
      .filter(l => {
        if (!dept) return true
        const orderDeptName = o.departments?.name
        const itemDeptId = l?.items?.department_id
        const orderMatches = String(orderDeptName || '').trim().toLowerCase() === String(dept).trim().toLowerCase()
        return orderMatches || Boolean(itemDeptId)
      })
      .map(l => ({
        id:o.member_id,
        order:o.order_id,
        member:o.member_name_snapshot,
        dept:o.departments?.name||'',
        pay:o.payment_option,
        item:l.items?.name,
        qty:Number(l.qty||0),
        unit_price:Number(l.unit_price||0),
        amount:Number(l.amount||0),
        remarks:'',
        signature:''
      })))
    if (!rows.length) return alert('No rows to export')

    try {
      const ExcelJSMod = await import('exceljs')
      const ExcelJS = ExcelJSMod?.default ?? ExcelJSMod
      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet('Posted Orders')

      const heading = 'Posted Orders Manifest'
      ws.addRow([heading])
      ws.mergeCells('A1','K1')
      ws.getRow(1).font = { bold: true, size: 14 }
      ws.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' }

      // Derive delivery branch from filtered rows
      const branchSet = new Set(filtered.map(o => o?.delivery?.name).filter(Boolean))
      const branchLabel = branchSet.size === 1 ? [...branchSet][0] : (branchSet.size > 1 ? 'Multiple Delivery Branches' : 'All Delivery Branches')
      const details = `Delivery Branch: ${branchLabel}${dept ? '  |  Department: ' + dept : ''}`
      ws.addRow([details])
      ws.mergeCells('A2','K2')
      ws.getRow(2).font = { italic: true }
      ws.getRow(2).alignment = { vertical: 'middle', horizontal: 'center' }

      const headers = ['ID','Order','Member','Dept','Pay','Item','Qty','Unit Price','Amount','Remarks','Sign']
      const headerRow = ws.addRow(headers)
      headerRow.font = { bold: true }
      headerRow.eachCell(cell => {
        cell.border = { top: {style: 'thin'}, left: {style: 'thin'}, bottom: {style: 'thin'}, right: {style: 'thin'} }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } }
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
      })

      rows.forEach(r => {
        const row = ws.addRow([r.id, r.order, r.member, r.dept, r.pay, r.item, r.qty, r.unit_price, r.amount, r.remarks, r.signature])
        row.eachCell(cell => {
          cell.border = { top: {style: 'thin'}, left: {style: 'thin'}, bottom: {style: 'thin'}, right: {style: 'thin'} }
        })
      })

      const totalQty = rows.reduce((acc, r) => acc + Number(r.qty||0), 0)
      const totalAmount = rows.reduce((acc, r) => acc + Number(r.amount||0), 0)
      const totalsRow = ws.addRow(['', '', 'TOTAL', '', '', '', totalQty, '', totalAmount, '', ''])
      totalsRow.eachCell(cell => {
        cell.border = { top: {style: 'thin'}, left: {style: 'thin'}, bottom: {style: 'thin'}, right: {style: 'thin'} }
        cell.font = { bold: true }
      })

      const totalsRowNumber = ws.rowCount

      ws.columns = [
        { width: 10 }, // ID
        { width: 10 }, // Order
        { width: 26 }, // Member
        { width: 18 }, // Dept
        { width: 10 }, // Pay
        { width: 26 }, // Item
        { width: 8 },  // Qty
        { width: 12 }, // Unit Price
        { width: 14 }, // Amount
        { width: 18 }, // Remarks
        { width: 14 }, // Signature
      ]

      for (let r = 3; r <= totalsRowNumber; r++) {
        ws.getCell(`G${r}`).numFmt = '#,##0'
        ws.getCell(`H${r}`).numFmt = '#,##0'
        ws.getCell(`I${r}`).numFmt = '#,##0'
      }

      // Footer rows: place labels under Column C and move DATE/SIGNATURE closer (E/F)
      const footerSigDate = ['', '', '', '', 'DATE', 'SIGNATURE', '', '', '', '', '']
      const footerIssued = ['', '', 'ITEMS ISSUED BY', '', '', '', '', '', '', '', '']
      const footerReceived = ['', '', 'ITEMS RECEIVED BY', '', '', '', '', '', '', '', '']
      const fsr1 = ws.addRow(footerSigDate)
      const fsr2 = ws.addRow(footerIssued)
      const fsr3 = ws.addRow(footerReceived)
      ;[fsr1, fsr2, fsr3].forEach(r => {
        r.eachCell(cell => {
          cell.border = { top: {style: 'thin'}, left: {style: 'thin'}, bottom: {style: 'thin'}, right: {style: 'thin'} }
        })
      })

      const buf = await wb.xlsx.writeBuffer()
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'rep_posted_manifest.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting Excel:', error)
      alert(`Excel export failed: ${error.message}`)
    } finally {
      setExcelLoading(false)
    }
  }

  const exportItemsPack = async () => {
    try {
      setItemsPackLoading(true)
      const qs = new URLSearchParams()
      if (dept) qs.set('dept', dept)
      const res = await fetch(`/api/rep/items-pack?${qs.toString()}`, { cache: 'no-store' })
      const ct = res.headers.get('content-type') || ''
      if (!ct.includes('application/json')) throw new Error(`Unexpected response (${res.status})`)
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || 'Failed to load items pack')

      const ExcelJSMod = await import('exceljs')
      const ExcelJS = ExcelJSMod?.default ?? ExcelJSMod
      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet('Items Pack')

      const branchLabel = json.branch?.name || json.branch?.code || (user?.branchCode || 'Branch')
      const title = `Summary of Items from ${branchLabel}${dept ? ' — ' + dept : ''}`
      const headers = ['SN','Items','Category','Price','Quantity','Amount']

      ws.addRow([title])
      ws.addRow(headers)

      let sn = 0
      let totalQty = 0
      let totalAmount = 0

      const sorted = [...(json.rows || [])].sort((a,b)=>{
        const ac = String(a.category||'').toLowerCase()
        const bc = String(b.category||'').toLowerCase()
        if (ac < bc) return -1
        if (ac > bc) return 1
        const ai = String(a.items||'').toLowerCase()
        const bi = String(b.items||'').toLowerCase()
        if (ai < bi) return -1
        if (ai > bi) return 1
        return 0
      })

      for (const r of sorted) {
        sn += 1
        const original = Number(r.original_price || 0)
        const markup = Number(r.markup || 0)
        const qty = Number(r.quantity || 0)
        const price = original + markup
        const amount = price * qty
        totalQty += qty
        totalAmount += amount
        ws.addRow([sn, r.items, r.category || '', price, qty, amount])
      }

      // Totals row
      ws.addRow(['','TOTAL','','', totalQty, totalAmount])

      // Record the row number of totals to control numeric formatting
      const totalsRowNumber = ws.rowCount

      // Footer rows: SIGNATURE/DATE at right, move Issued/Received under column C
      ws.addRow(['', '', '', '', 'SIGNATURE', 'DATE'])
      ws.addRow(['', '', 'ITEMS ISSUED BY', '', '', ''])
      ws.addRow(['', '', 'ITEMS RECEIVED BY', '', '', ''])

      ws.mergeCells('A1','F1')
      ws.columns = [
        { key:'sn', width:6 },
        { key:'items', width:28 },
        { key:'category', width:18 },
        { key:'price', width:14 },
        { key:'qty', width:10 },
        { key:'amount', width:18 },
      ]
      const titleCell = ws.getCell('A1')
      titleCell.font = { bold:true, size:13 }
      titleCell.alignment = { horizontal:'center' }
      const headerRow = ws.getRow(2)
      headerRow.font = { bold:true }
      headerRow.alignment = { horizontal:'center' }
      const lastRow = ws.rowCount
      for (let r = 2; r <= lastRow; r++) {
        for (let c = 1; c <= 6; c++) {
          const cell = ws.getRow(r).getCell(c)
          cell.border = { top:{style:'thick'}, left:{style:'thick'}, bottom:{style:'thick'}, right:{style:'thick'} }
          // Apply numeric formats only for data and totals rows, not footer rows
          if (r >= 3 && r <= totalsRowNumber && c >= 4) {
            if (c === 5) cell.numFmt = '0'; else cell.numFmt = '#,##0'
          }
        }
      }

      const buffer = await wb.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Items_Pack_${branchLabel}_${dept || 'ALL_DEPTS'}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('Rep Items Pack export failed:', e)
      alert(`Items Pack export failed: ${e.message}`)
    } finally {
      setItemsPackLoading(false)
    }
  }

  const exportItemsPackPDF = async () => {
    try {
      const qs = new URLSearchParams()
      if (dept) qs.set('dept', dept)
      const res = await fetch(`/api/rep/items-pack?${qs.toString()}`, { cache: 'no-store' })
      const ct = res.headers.get('content-type') || ''
      if (!ct.includes('application/json')) throw new Error(`Unexpected response (${res.status})`)
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || 'Failed to load items pack')

      const { jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

      const branchLabel = json.branch?.name || json.branch?.code || (user?.branchCode || 'Branch')
      const title = `Summary of Items from ${branchLabel}${dept ? ' — ' + dept : ''}`
      doc.setFontSize(16); doc.text(title, 14, 22)
      doc.setFontSize(10); doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30)

      const headers = ['SN','Items','Category','Price','Quantity','Amount']
      const sanitize = s => String(s ?? '').replace(/\u20A6|₦/g, 'NGN ')
      const sorted = [...(json.rows || [])].sort((a,b)=>{
        const ac = String(a.category||'').toLowerCase()
        const bc = String(b.category||'').toLowerCase()
        if (ac < bc) return -1
        if (ac > bc) return 1
        const ai = String(a.items||'').toLowerCase()
        const bi = String(b.items||'').toLowerCase()
        if (ai < bi) return -1
        if (ai > bi) return 1
        return 0
      })

      let sn = 0
      let totalQty = 0
      let totalAmount = 0
      const body = sorted.map(r => {
        sn += 1
        const original = Number(r.original_price || 0)
        const markup = Number(r.markup || 0)
        const qty = Number(r.quantity || 0)
        const price = original + markup
        const amount = price * qty
        totalQty += qty
        totalAmount += amount
        return [
          String(sn),
          sanitize(r.items),
          sanitize(r.category || ''),
          `NGN ${Number(price).toLocaleString()}`,
          Number(qty).toLocaleString(),
          `NGN ${Number(amount).toLocaleString()}`
        ]
      })

      const totalsRow = [ '', 'TOTAL', '', '', Number(totalQty).toLocaleString(), `NGN ${Number(totalAmount).toLocaleString()}` ]
      const tableData = [...body, totalsRow]

      autoTable(doc, {
        head: [headers],
        body: tableData,
        startY: 36,
        styles: { fontSize: 9, lineWidth: 0.1, lineColor: [0,0,0], cellPadding: 2, overflow: 'linebreak' },
        headStyles: { fillColor: [75, 85, 99], textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [249, 250, 251] },
        theme: 'grid',
        columnStyles: {
          0: { cellWidth: 12, halign: 'right' }, // SN
          1: { cellWidth: 92 }, // Items
          2: { cellWidth: 46 }, // Category
          3: { cellWidth: 26, halign: 'right' }, // Price
          4: { cellWidth: 26, halign: 'right' }, // Quantity
          5: { cellWidth: 32, halign: 'right' }, // Amount
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.row.index === tableData.length - 1) {
            data.cell.styles.fillColor = [75, 85, 99]
            data.cell.styles.textColor = [255, 255, 255]
            data.cell.styles.fontStyle = 'bold'
          }
        },
      })

      // Footer rows
      const makeRow = (mapper) => headers.map((_, i) => mapper(i))
      const sigDateRow = makeRow(i => i === headers.length - 2 ? 'SIGNATURE' : (i === headers.length - 1 ? 'DATE' : ''))
      const issuedRow = makeRow(i => i === 2 ? 'ITEMS ISSUED BY' : '')
      const receivedRow = makeRow(i => i === 2 ? 'ITEMS RECEIVED BY' : '')
      autoTable(doc, {
        head: [],
        body: [sigDateRow, issuedRow, receivedRow],
        startY: (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY + 6 : undefined,
        styles: { fontSize: 9, lineWidth: 0.1, lineColor: [0,0,0], cellPadding: 2 },
        theme: 'grid'
      })

      doc.save(`Items_Pack_${branchLabel}_${dept || 'ALL_DEPTS'}.pdf`)
    } catch (e) {
      console.error('Rep Items Pack PDF export failed:', e)
      alert(`Items Pack PDF export failed: ${e.message}`)
    }
  }

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-base sm:text-lg md:text-xl font-semibold break-words">Rep — Food Distribution — Posted</h1>
          <div className="text-xs text-gray-500">Current Branch: {user?.branchCode || '—'}</div>
        </div>
        <button
          type="button"
          className="px-4 py-2 rounded-lg bg-gray-900 hover:bg-black text-white text-xs sm:text-sm font-medium disabled:opacity-50 inline-flex items-center gap-2 shadow-sm whitespace-nowrap"
          disabled={itemsPackLoading}
          onClick={exportItemsPack}
          aria-busy={itemsPackLoading}
        >
          {itemsPackLoading && <Spinner className="h-4 w-4 text-white" />}
          <span>{itemsPackLoading ? 'Downloading…' : 'Items Pack'}</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-4 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="border-2 border-gray-200 rounded-xl px-3 py-2 text-xs sm:text-sm bg-white w-full sm:w-56 shrink-0"
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

          <div className="flex items-center gap-2 flex-1 min-w-[240px] sm:max-w-[560px]">
            <input
              className="border-2 border-gray-200 rounded-xl px-3 py-2 text-xs sm:text-sm flex-1 min-w-0 bg-white"
              placeholder="Search (Order / Member)"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setSearch(searchInput.trim())
              }}
            />
            <button
              type="button"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-medium transition-colors shadow-sm whitespace-nowrap disabled:opacity-50 shrink-0"
              onClick={() => setSearch(searchInput.trim())}
              disabled={loading}
            >
              Search
            </button>
          </div>

            <button
              type="button"
              className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-900 text-white text-xs sm:text-sm font-medium disabled:opacity-50 inline-flex items-center gap-2"
              onClick={() => exportExcel().catch(() => null)}
              disabled={excelLoading}
              aria-busy={excelLoading}
            >
              {excelLoading && <Spinner className="h-4 w-4 text-white" />}
              <span>{excelLoading ? 'Downloading…' : 'Download Excel'}</span>
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-medium disabled:opacity-50 inline-flex items-center gap-2"
              onClick={() => exportPDF().catch(() => null)}
              disabled={pdfLoading}
              aria-busy={pdfLoading}
            >
              {pdfLoading && <Spinner className="h-4 w-4 text-white" />}
              <span>{pdfLoading ? 'Downloading…' : 'Download PDF'}</span>
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-medium disabled:opacity-50 inline-flex items-center gap-2"
              onClick={() => fetchOrders(undefined).catch(() => null)}
              disabled={loading}
              aria-busy={loading}
            >
              {loading && <Spinner className="h-4 w-4 text-white" />}
              <span>{loading ? 'Refreshing…' : 'Refresh'}</span>
            </button>
        </div>
      </div>

      {msg && <div className={`mb-3 text-sm ${msg.type==='error'?'text-red-700':'text-green-700'}`}>{msg.text}</div>}

      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="text-sm font-semibold">Posted Orders</div>
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
                <th className="px-3 py-3 text-right font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {!didLoadOnce || (loading && filteredOrders.length === 0) ? (
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
                    No Posted orders.
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
                      <select
                        defaultValue=""
                        className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs sm:text-sm bg-white disabled:opacity-50"
                        onChange={(e) => {
                          const v = e.target.value
                          e.target.value = ''
                          if (!v) return
                          if (v === 'view') openView(o)
                          if (v === 'deliver') deliverOne(o.order_id)
                        }}
                        disabled={deliveringOrder === o.order_id}
                      >
                        <option value="" disabled>
                          Actions
                        </option>
                        <option value="view">View</option>
                        <option value="deliver">Deliver</option>
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
        open={viewOpen}
        onClose={() => setViewOpen(false)}
        title={viewOrder ? `Order #${viewOrder.order_id}` : 'Order'}
        widthClass="w-[94vw] max-w-4xl mx-4"
      >
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

            <div className="ui-card overflow-hidden">
              <div className="max-h-[60vh] overflow-auto">
                <table className="w-full text-xs sm:text-sm min-w-[560px]">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2 text-left w-40 hidden md:table-cell">SKU</th>
                      <th className="px-3 py-2 text-left">Item</th>
                      <th className="px-3 py-2 text-right w-20">Qty</th>
                      <th className="px-3 py-2 text-right w-28">Unit Price</th>
                      <th className="px-3 py-2 text-right w-28">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {(viewOrder.order_lines || []).length ? (
                      (viewOrder.order_lines || []).map((l) => (
                        <tr key={l.id}>
                          <td className="px-3 py-2 font-mono text-xs break-all hidden md:table-cell">{l.items?.sku || ''}</td>
                          <td className="px-3 py-2 whitespace-normal break-words min-w-[220px]">{l.items?.name || ''}</td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">{Number(l.qty || 0).toLocaleString()}</td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">₦{Number(l.unit_price || 0).toLocaleString()}</td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">₦{Number(l.amount || 0).toLocaleString()}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="px-3 py-3 text-gray-600" colSpan={5}>
                          No items found for this order.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </DraggableModal>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-white/10 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">{showModal.title}</h3>
            <p className="text-gray-600 mb-4">{showModal.message}</p>
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
                className="px-4 py-2 border rounded hover:bg-gray-50"
                onClick={() => { setShowModal(null); setModalInput('') }}
              >
                Cancel
              </button>
              <button
                className={`px-4 py-2 rounded transition-all duration-200 ${
                  deliveringOrder === showModal.orderId 
                    ? 'bg-gray-400 text-white cursor-not-allowed' 
                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                }`}
                onClick={handleDeliverSubmit}
                disabled={deliveringOrder === showModal.orderId}
              >
                {deliveringOrder === showModal.orderId ? (
                  <div className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-1 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Delivering...
                  </div>
                ) : (
                  'Deliver'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Simple button-only loader (no overlay) */}
    </div>
  )
}

export default function RepPostedPage() {
  return (
    <ProtectedRoute allowedRoles={['rep']}>
      <RepPostedPageContent />
    </ProtectedRoute>
  )
}
