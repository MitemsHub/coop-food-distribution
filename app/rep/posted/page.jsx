// app/rep/posted/page.jsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../contexts/AuthContext'
import ProtectedRoute from '../../components/ProtectedRoute'

function RepPostedPageContent() {
  const [orders, setOrders] = useState([])
  const [departments, setDepartments] = useState([])
  const [dept, setDept] = useState('') // '' = All
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [msg, setMsg] = useState(null)
  const [loading, setLoading] = useState(false)
  const [deliveringOrder, setDeliveringOrder] = useState(null) // Track which order is being delivered
  const [nextCursor, setNextCursor] = useState(null)
  const [showModal, setShowModal] = useState(null)
  const [modalInput, setModalInput] = useState('')
  const [itemsPackLoading, setItemsPackLoading] = useState(false)
  const { user, logout } = useAuth()
  const router = useRouter()

  const safeJson = async (res, label) => {
    const ct = res.headers.get('content-type') || ''
    if (ct.includes('application/json')) return await res.json()
    const text = await res.text()
    throw new Error(`Non-JSON response from ${label} (${res.status}): ${text.slice(0, 300)}`)
  }

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

  useEffect(() => { 
    if (user?.type !== 'rep' || !user?.authenticated) return
    fetchOrders(true) 
  }, [dept, user])

  const fetchOrders = async (reset = true) => {
    setLoading(true); setMsg(null)
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), 5000)
    try {
      const qs = new URLSearchParams({ status: 'Posted', limit: '50' })
      if (dept) qs.set('dept', dept)
      if (!reset && nextCursor) { qs.set('cursor', nextCursor); qs.set('dir', 'next') }
      const res = await fetch(`/api/rep/orders/list?${qs.toString()}`, { cache: 'no-store', headers:{ 'Accept':'application/json' }, signal: ctl.signal })
      const json = await safeJson(res, '/api/rep/orders/list')
      if (!res.ok || !json.ok) throw new Error(json.error || 'Failed')
      setOrders(reset ? (json.orders || []) : [...orders, ...(json.orders || [])])
      setNextCursor(json.nextCursor || null)
    } catch (e) {
      if (e.name !== 'AbortError') setMsg({ type:'error', text:e.message })
    } finally {
      clearTimeout(timer)
      setLoading(false)
    }
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

  const exportCSV = () => {
    const filtered = !search ? orders : orders.filter(o => {
      const s = search.toLowerCase()
      return String(o.order_id).toLowerCase().includes(s) || String(o.member_id).toLowerCase().includes(s)
    })
    const rows = filtered.flatMap(o => (o.order_lines || []).map(l => ({
      id:o.member_id,
      order_id:o.order_id,
      posted_at:o.posted_at,
      member:o.member_name_snapshot,
      member_branch:o.member_branch?.name||'',
      delivery:o.delivery?.name||'',
      department:o.departments?.name||'',
      payment:o.payment_option,
      item:l.items?.name,
      qty:l.qty,
      unit_price:l.unit_price,
      amount:l.amount
    })))
    if (!rows.length) return alert('No rows to export')
    const headers = Object.keys(rows[0])
    const bodyLines = rows.map(r => headers.map(h => `"${String(r[h] ?? '').replace(/"/g,'""')}"`).join(','))

    // Footer rows: empty spacer, SIGNATURE/DATE at last two columns, Issued/Received under column C
    const empty = headers.map(()=> '""').join(',')
    const sigDate = headers.map((_, i) => {
      if (i === headers.length - 2) return '"SIGNATURE"'
      if (i === headers.length - 1) return '"DATE"'
      return '""'
    }).join(',')
    const issued = headers.map((_, i) => i === 2 ? '"ITEMS ISSUED BY"' : '""').join(',')
    const received = headers.map((_, i) => i === 2 ? '"ITEMS RECEIVED BY"' : '""').join(',')

    const csv = [
      headers.join(','),
      ...bodyLines,
      empty,
      sigDate,
      issued,
      received
    ].join('\n')
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a')
    a.href = url; a.download = 'rep_posted.csv'; a.click(); URL.revokeObjectURL(url)
  }

  const exportPDF = async () => {
    if (!orders.length) return alert('No rows to export')
    const { jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')
    const doc = new jsPDF()

    // Header
    doc.setFontSize(14)
    doc.text('Posted Orders Manifest', 14, 18)
    doc.setFontSize(10)
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 24)
    if (dept) doc.text(`Department: ${dept}`, 14, 30)

    // Build table rows
    const headers = ['ID','Order','Member','Dept','Pay','Item','Qty','Unit Price','Amount']
    const sanitize = (s) => String(s ?? '').replace(/\u20A6|₦/g, 'NGN ').replace(/[\u2013\u2014]/g, '-')
    const filtered = !search ? orders : orders.filter(o => {
      const s = search.toLowerCase()
      return String(o.order_id).toLowerCase().includes(s) || String(o.member_id).toLowerCase().includes(s)
    })
    const rows = filtered.flatMap(o => (o.order_lines || []).map(l => ([
      sanitize(o.member_id),
      sanitize(o.order_id),
      sanitize(o.member_name_snapshot),
      sanitize(o.departments?.name),
      sanitize(o.payment_option),
      sanitize(l.items?.name),
      String(l.qty || 0),
      `NGN ${Number(l.unit_price || 0).toLocaleString()}`,
      `NGN ${Number(l.amount || 0).toLocaleString()}`,
    ])))

    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: dept ? 34 : 28,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [75, 85, 99] },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      columnStyles: {
        6: { halign: 'right' },
        7: { halign: 'right' },
        8: { halign: 'right' },
      }
    })
    // Footer rows appended after main table
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

    doc.save('rep_posted_manifest.pdf')
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

  const exportItemsPackCSV = async () => {
    try {
      const qs = new URLSearchParams()
      if (dept) qs.set('dept', dept)
      const res = await fetch(`/api/rep/items-pack?${qs.toString()}`, { cache: 'no-store' })
      const ct = res.headers.get('content-type') || ''
      if (!ct.includes('application/json')) throw new Error(`Unexpected response (${res.status})`)
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || 'Failed to load items pack')

      const branchLabel = json.branch?.name || json.branch?.code || (user?.branchCode || 'Branch')
      const title = `Summary of Items from ${branchLabel}${dept ? ' — ' + dept : ''}`
      const headers = ['SN','Items','Category','Price','Quantity','Amount']

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
      const rows = sorted.map(r => {
        sn += 1
        const original = Number(r.original_price || 0)
        const markup = Number(r.markup || 0)
        const qty = Number(r.quantity || 0)
        const price = original + markup
        const amount = price * qty
        totalQty += qty
        totalAmount += amount
        return {
          SN: sn,
          Items: r.items,
          Category: r.category || '',
          Price: Number(price).toLocaleString(),
          Quantity: Number(qty).toLocaleString(),
          Amount: Number(amount).toLocaleString()
        }
      })

      const totalsRow = {
        SN: '', Items: 'TOTAL', Category: '', Price: '', Quantity: Number(totalQty).toLocaleString(), Amount: Number(totalAmount).toLocaleString()
      }

      const csvLines = []
      csvLines.push(title)
      csvLines.push(headers.join(','))
      const sanitize = s => String(s ?? '').replace(/\u20A6|₦/g, 'NGN ').replace(/"/g, '""')
      const headerKeys = headers
      rows.forEach(r => {
        csvLines.push(headerKeys.map(h => `"${sanitize(r[h])}"`).join(','))
      })
      csvLines.push(headerKeys.map(h => `"${sanitize(totalsRow[h])}"`).join(','))
      // Footer rows
      const empty = headerKeys.map(()=> '""').join(',')
      const sigDate = headerKeys.map((_, i) => {
        if (i === headerKeys.length - 2) return '"SIGNATURE"'
        if (i === headerKeys.length - 1) return '"DATE"'
        return '""'
      }).join(',')
      const issued = headerKeys.map((_, i) => i === 2 ? '"ITEMS ISSUED BY"' : '""').join(',')
      const received = headerKeys.map((_, i) => i === 2 ? '"ITEMS RECEIVED BY"' : '""').join(',')
      csvLines.push(empty)
      csvLines.push(sigDate)
      csvLines.push(issued)
      csvLines.push(received)

      const blob = new Blob([csvLines.join('\n')], { type:'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Items_Pack_${branchLabel}_${dept || 'ALL_DEPTS'}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('Rep Items Pack CSV export failed:', e)
      alert(`Items Pack CSV export failed: ${e.message}`)
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
      const doc = new jsPDF()

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
        styles: { fontSize: 8, lineWidth: 0.1, lineColor: [0,0,0], cellPadding: 2 },
        headStyles: { fillColor: [75, 85, 99] },
        alternateRowStyles: { fillColor: [249, 250, 251] },
        theme: 'grid'
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
      <h1 className="text-lg sm:text-xl md:text-2xl font-semibold mb-4">Rep — Posted Orders</h1>
      
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 mb-4 items-start">
        <select className="border rounded px-3 py-2 text-xs sm:text-sm w-full" value={dept} onChange={e=>setDept(e.target.value)}>
          <option value="">All departments</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <div className="flex gap-2 w-full">
          <input
            className="border rounded px-3 py-2 text-xs sm:text-sm w-full"
            placeholder="Search ID or Order ID"
            value={searchInput}
            onChange={e=>setSearchInput(e.target.value)}
            onKeyDown={(e)=>{ if(e.key==='Enter') setSearch(searchInput.trim()) }}
          />
          <button className="px-2 py-2 border rounded text-xs sm:text-sm whitespace-nowrap" onClick={()=>setSearch(searchInput.trim())}>Search</button>
        </div>
        <button
          className="px-2 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs sm:text-sm whitespace-nowrap w-full disabled:bg-purple-400 flex items-center justify-center gap-2"
          disabled={itemsPackLoading}
          onClick={exportItemsPack}
          aria-busy={itemsPackLoading}
        >
          {itemsPackLoading ? (
            <>
              <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              <span>Exporting…</span>
            </>
          ) : (
            'Items Pack'
          )}
        </button>
        {/* Items Pack CSV/PDF buttons temporarily removed as requested */}
        <button className="px-2 py-2 bg-gray-700 text-white rounded text-xs sm:text-sm whitespace-nowrap w-full" onClick={exportCSV}>Export CSV</button>
        <button className="px-2 py-2 bg-emerald-600 text-white rounded text-xs sm:text-sm whitespace-nowrap w-full" onClick={exportPDF}>Export PDF</button>
        <button className="px-2 py-2 bg-blue-600 text-white rounded text-xs sm:text-sm whitespace-nowrap w-full" onClick={()=>fetchOrders(true)}>{loading ? 'Loading…' : 'Refresh'}</button>
      </div>

      {msg && <div className={`mb-3 text-sm ${msg.type==='error'?'text-red-700':'text-green-700'}`}>{msg.text}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {orders.length === 0 && <div className="col-span-full p-4 text-gray-600 text-center">No Posted orders.</div>}
        {(
          (!search ? orders : orders.filter(o => {
            const s = search.toLowerCase()
            return String(o.order_id).toLowerCase().includes(s) || String(o.member_id).toLowerCase().includes(s)
          }))
        ).map(o => (
          <div key={o.order_id} className="border rounded-lg p-4 bg-white shadow-sm">
            <div className="grid grid-cols-1 gap-2 mb-3">
              <div className="font-medium text-xs sm:text-sm">#{o.order_id}</div>
              <div className="text-xs sm:text-sm">{new Date(o.posted_at || o.created_at).toLocaleString()}</div>
              <div className="text-xs sm:text-sm">{o.member_id} — {o.member_name_snapshot}</div>
              <div className="text-xs sm:text-sm">Member: {o.member_branch?.name || '-'}</div>
              <div className="text-xs sm:text-sm">Delivery: {o.delivery?.name || '-'}</div>
              <div className="text-xs sm:text-sm">{o.departments?.name || '-'}</div>
              <div className="text-xs sm:text-sm">Payment: <b>{o.payment_option}</b></div>
            <div className="text-xs sm:text-sm font-medium">
              {o.payment_option === 'Loan' ? 'Total with Interest:' : 'Total:'} ₦{Number(o.total_amount || 0).toLocaleString()}
            </div>
            </div>
            <div className="flex justify-end mb-3">
              <button 
                className={`px-3 py-1 rounded text-xs sm:text-sm whitespace-nowrap transition-all duration-200 ${
                  deliveringOrder === o.order_id 
                    ? 'bg-gray-400 text-white cursor-not-allowed' 
                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                }`}
                onClick={() => deliverOne(o.order_id)}
                disabled={deliveringOrder === o.order_id}
              >
                {deliveringOrder === o.order_id ? (
                  <div className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-1 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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

            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-1">SKU</th>
                    <th className="text-left py-2 px-1">Item</th>
                    <th className="text-right py-2 px-1">Qty</th>
                    <th className="text-right py-2 px-1">Unit Price</th>
                    <th className="text-right py-2 px-1">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(o.order_lines || []).map(l => (
                    <tr key={l.id} className="border-b border-gray-100">
                      <td className="py-2 px-1">{l.items?.sku}</td>
                      <td className="py-2 px-1">{l.items?.name}</td>
                      <td className="py-2 px-1 text-right">{l.qty}</td>
                      <td className="py-2 px-1 text-right">₦{Number(l.unit_price).toLocaleString()}</td>
                      <td className="py-2 px-1 text-right">₦{Number(l.amount).toLocaleString()}</td>
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