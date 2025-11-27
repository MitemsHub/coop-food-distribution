// app/admin/reports/page.jsx
'use client'

import { useEffect, useState, useMemo } from 'react'
import ProtectedRoute from '../../components/ProtectedRoute'

function ReportsPageContent() {
  const [data, setData] = useState(null)
  const [err, setErr] = useState(null)
  const [loading, setLoading] = useState(true)

  // Branch pack controls
  const [branches, setBranches] = useState([])
  const [branchCode, setBranchCode] = useState('') // '' = All branches
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [branchPackLoading, setBranchPackLoading] = useState(false)

  // Pagination states for the first two tables
  const [branchCurrentPage, setBranchCurrentPage] = useState(1)
  const [branchDeptCurrentPage, setBranchDeptCurrentPage] = useState(1)
  const [deliveryMemberCurrentPage, setDeliveryMemberCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Filter states for branch filtering
  const [selectedBranchForBranchTable, setSelectedBranchForBranchTable] = useState('all')
  const [selectedBranchForDepartmentTable, setSelectedBranchForDepartmentTable] = useState('all')
  const [selectedDeliveryBranchForDMTable, setSelectedDeliveryBranchForDMTable] = useState('all')

  // Load branches for dropdown
  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/admin/reports/branches', { cache: 'no-store' })
        const json = await res.json()
        if (json.ok) setBranches(json.branches || [])
      } catch (_) {}
    })()
  }, [])

  // Load summary data
  const loadSummary = async () => {
    try {
      setLoading(true)
      setErr(null)
      const res = await fetch('/api/admin/reports/summary', { cache: 'no-store' })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || 'Failed to load reports')
      setData(json)
    } catch (e) {
      setErr(e.message)
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSummary()
  }, [])

  // Get unique branch names for filter dropdowns
  const uniqueBranches = useMemo(() => {
    if (!data) return []
    const branchNames = new Set()
    data.byBranch?.forEach(item => branchNames.add(item.branch_name))
    data.byBranchDept?.forEach(item => branchNames.add(item.branch_name))
    return Array.from(branchNames).sort()
  }, [data])

  const uniqueDeliveryBranches = useMemo(() => {
    if (!data) return []
    const names = new Set()
    data.byDeliveryMember?.forEach(item => names.add(item.delivery_branch_name))
    return Array.from(names).sort()
  }, [data])

  // Loader for Items Pack export
  const [itemsPackLoading, setItemsPackLoading] = useState(false)
  const [itemsPackProgress, setItemsPackProgress] = useState({ current: 0, total: 0 })

  // Branch Item Prices Matrix (removed)

  // New: Items Demand by Delivery Location & Department
  const [departments, setDepartments] = useState([])
  const [selectedDeliveryCode, setSelectedDeliveryCode] = useState('all')
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('all')
  const [demandRows, setDemandRows] = useState([])
  const [demandLoading, setDemandLoading] = useState(false)
  const [demandErr, setDemandErr] = useState(null)
  const [demandCurrentPage, setDemandCurrentPage] = useState(1)
  const [summaryCurrentPage, setSummaryCurrentPage] = useState(1)

  // Summary of Items: selection state
  const [summarySelectedItems, setSummarySelectedItems] = useState([])
  const summaryItemOptions = useMemo(() => {
    const names = new Set()
    demandRows.forEach(r => {
      if (r?.items) names.add(r.items)
    })
    return Array.from(names).sort()
  }, [demandRows])

  useEffect(() => {
    // Reset selection when source rows change (filters updated)
    setSummarySelectedItems([])
    setSummaryCurrentPage(1)
  }, [demandRows])

  // Branch Item Prices Matrix loader removed

  // Load departments for filter
  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/admin/reports/departments', { cache: 'no-store' })
        const json = await res.json()
        if (json.ok) setDepartments(json.departments || [])
      } catch (_) {}
    })()
  }, [])

  // Load demand rows whenever filters change
  useEffect(() => {
    ;(async () => {
      try {
        setDemandLoading(true)
        setDemandErr(null)
        const qs = new URLSearchParams()
        if (selectedDeliveryCode !== 'all') qs.set('branch', selectedDeliveryCode)
        if (selectedDepartmentId !== 'all') qs.set('department_id', String(selectedDepartmentId))
        const res = await fetch(`/api/admin/reports/delivery-dept-items?${qs.toString()}`, { cache: 'no-store' })
        const json = await res.json()
        if (!json.ok) throw new Error(json.error || 'Failed to load demand data')
        setDemandRows(json.rows || [])
        setDemandCurrentPage(1)
      } catch (e) {
        setDemandErr(e.message)
        setDemandRows([])
      } finally {
        setDemandLoading(false)
      }
    })()
  }, [selectedDeliveryCode, selectedDepartmentId])

  const exportSummaryCSV = () => {
    const selectedSet = new Set(summarySelectedItems)
    const filtered = demandRows.filter(r => selectedSet.size === 0 ? true : selectedSet.has(r.items))
    const branchName = selectedDeliveryCode === 'all'
      ? 'All Delivery Locations'
      : (branches.find(b => b.code === selectedDeliveryCode)?.name || selectedDeliveryCode)
    const departmentName = selectedDepartmentId === 'all'
      ? 'All Departments'
      : (departments.find(d => String(d.id) === String(selectedDepartmentId))?.name || selectedDepartmentId)
    // Raw rows for totals (numeric values)
    const rawRows = filtered.map((r, idx) => {
      const original = Number(r?.original_price || 0)
      const qty = Number(r?.quantity || 0)
      const amount = original * qty
      return {
        sn: idx + 1,
        'delivery location': branchName,
        items: r.items || '',
        qty,
        price: original,
        amount
      }
    })

    // Formatted rows with commas
    const rows = rawRows.map(r => ({
      ...r,
      qty: Number(r.qty).toLocaleString(),
      price: Number(r.price).toLocaleString(),
      amount: Number(r.amount).toLocaleString()
    }))

    const heading = `Summary of Items - ${branchName} - ${departmentName}`
    const filename = `summary_of_items_${branchName.replace(/\s+/g, '_').toLowerCase()}_${departmentName.replace(/\s+/g, '_').toLowerCase()}.csv`
    exportCSV(rows, filename, {
      heading,
      totals: { labelKey: 'items', label: 'TOTAL', sumKeys: ['qty', 'amount'], rawRows, currencyPrefix: '' },
      footer: true,
      footerColumnIndex: 2
    })
  }

  const exportSummaryPDF = () => {
    const selectedSet = new Set(summarySelectedItems)
    const filtered = demandRows.filter(r => selectedSet.size === 0 ? true : selectedSet.has(r.items))
    const branchName = selectedDeliveryCode === 'all'
      ? 'All Delivery Locations'
      : (branches.find(b => b.code === selectedDeliveryCode)?.name || selectedDeliveryCode)
    const departmentName = selectedDepartmentId === 'all'
      ? 'All Departments'
      : (departments.find(d => String(d.id) === String(selectedDepartmentId))?.name || selectedDepartmentId)

    const rawRows = filtered.map((r, idx) => {
      const original = Number(r?.original_price || 0)
      const qty = Number(r?.quantity || 0)
      const amount = original * qty
      return {
        sn: idx + 1,
        'delivery location': branchName,
        items: r.items || '',
        qty,
        price: original,
        amount
      }
    })
    const rows = rawRows.map(r => ({
      ...r,
      qty: Number(r.qty).toLocaleString(),
      price: Number(r.price).toLocaleString(),
      amount: Number(r.amount).toLocaleString()
    }))

    exportPDF(rows, `Summary of Items - ${branchName} - ${departmentName}`, {
      filters: { 'Delivery Location': branchName, 'Department': departmentName },
      totals: { labelKey: 'items', label: 'TOTAL', sumKeys: ['qty', 'amount'], rawRows, currencyPrefix: '' },
      footer: true,
      footerColumnIndex: 2
    })
  }

  const exportSummaryExcel = async () => {
    const selectedSet = new Set(summarySelectedItems)
    const filtered = demandRows.filter(r => selectedSet.size === 0 ? true : selectedSet.has(r.items))
    const branchName = selectedDeliveryCode === 'all'
      ? 'All Delivery Locations'
      : (branches.find(b => b.code === selectedDeliveryCode)?.name || selectedDeliveryCode)
    const departmentName = selectedDepartmentId === 'all'
      ? 'All Departments'
      : (departments.find(d => String(d.id) === String(selectedDepartmentId))?.name || selectedDepartmentId)

    const rows = filtered.map((r, idx) => {
      const original = Number(r?.original_price || 0)
      const qty = Number(r?.quantity || 0)
      const amount = original * qty
      return { sn: idx + 1, location: branchName, item: r.items || '', qty, price: original, amount }
    })

    const totalQty = rows.reduce((acc, r) => acc + Number(r.qty || 0), 0)
    const totalAmount = rows.reduce((acc, r) => acc + Number(r.amount || 0), 0)

    try {
      const ExcelJSMod = await import('exceljs')
      const ExcelJS = ExcelJSMod?.default ?? ExcelJSMod
      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet('Summary of Items')

      const heading = `Summary of Items - ${branchName} - ${departmentName}`
      ws.addRow([heading])
      ws.mergeCells('A1','F1')
      ws.getRow(1).font = { bold: true, size: 14 }
      ws.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' }

      const headerRow = ws.addRow(['SN','Delivery Location','Items','Qty','Price','Amount'])
      headerRow.font = { bold: true }
      headerRow.eachCell(cell => {
        cell.border = { top: {style: 'thin'}, left: {style: 'thin'}, bottom: {style: 'thin'}, right: {style: 'thin'} }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } }
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
      })

      rows.forEach(r => {
        const row = ws.addRow([r.sn, r.location, r.item, r.qty, r.price, r.amount])
        row.eachCell(cell => {
          cell.border = { top: {style: 'thin'}, left: {style: 'thin'}, bottom: {style: 'thin'}, right: {style: 'thin'} }
        })
      })

      const totalsRow = ws.addRow(['', '','TOTAL', totalQty, '', totalAmount])
      totalsRow.eachCell(cell => {
        cell.border = { top: {style: 'thin'}, left: {style: 'thin'}, bottom: {style: 'thin'}, right: {style: 'thin'} }
        cell.font = { bold: true }
      })

      // Record totals row index to limit numeric formatting to data rows
      const totalsRowNumber = ws.rowCount

      // Footer write as per provided screenshot
      const sigRow = ws.addRow(['', '', '', '', 'SIGNATURE', 'DATE'])
      sigRow.eachCell(cell => {
        cell.border = { top: {style: 'thin'}, left: {style: 'thin'}, bottom: {style: 'thin'}, right: {style: 'thin'} }
      })
      const issuedRow = ws.addRow(['', '', 'ITEMS ISSUED BY', '', '', ''])
      issuedRow.eachCell(cell => {
        cell.border = { top: {style: 'thin'}, left: {style: 'thin'}, bottom: {style: 'thin'}, right: {style: 'thin'} }
      })
      const receivedRow = ws.addRow(['', '', 'ITEMS RECEIVED BY', '', '', ''])
      receivedRow.eachCell(cell => {
        cell.border = { top: {style: 'thin'}, left: {style: 'thin'}, bottom: {style: 'thin'}, right: {style: 'thin'} }
      })

      ws.columns = [
        { width: 6 },
        { width: 24 },
        { width: 28 },
        { width: 10 },
        { width: 12 },
        { width: 14 }
      ]

      const lastRow = ws.rowCount
      for (let r = 3; r <= totalsRowNumber; r++) {
        ws.getCell(`D${r}`).numFmt = '#,##0'
        ws.getCell(`E${r}`).numFmt = '#,##0'
        ws.getCell(`F${r}`).numFmt = '#,##0'
      }

      const filename = `summary_of_items_${branchName.replace(/\s+/g, '_').toLowerCase()}_${departmentName.replace(/\s+/g, '_').toLowerCase()}.xlsx`
      const buf = await wb.xlsx.writeBuffer()
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting Excel:', error)
      alert('Error exporting Excel. Please try again.')
    }
  }

  // Branch Item Prices Matrix calculations removed

  // Format demand rows for display
  const formattedDemandRows = useMemo(() => {
    const sorted = [...(demandRows || [])].sort((a, b) => {
      const ac = String(a.category || '').toLowerCase()
      const bc = String(b.category || '').toLowerCase()
      if (ac < bc) return -1
      if (ac > bc) return 1
      const ai = String(a.items || '').toLowerCase()
      const bi = String(b.items || '').toLowerCase()
      if (ai < bi) return -1
      if (ai > bi) return 1
      return 0
    })
    return sorted.map((r, idx) => {
      const original = Number(r.original_price || 0)
      const markup = Number(r.markup || 0)
      const qty = Number(r.quantity || 0)
      const recordedAmount = Number(r.amount || 0)
      return {
        sn: idx + 1,
        items: r.items,
        category: r.category || '',
        original_price: `₦${original.toLocaleString()}`,
        markup: `₦${markup.toLocaleString()}`,
        quantity: qty.toLocaleString(),
        amount: `₦${recordedAmount.toLocaleString()}`
      }
    })
  }, [demandRows])

  // Raw rows used for totals calculations in exports (amount recomputed)
  const demandRawForTotals = useMemo(() => {
    return (demandRows || []).map(r => {
      const recordedAmount = Number(r.amount || 0)
      return { ...r, amount: recordedAmount }
    })
  }, [demandRows])

  const demandTotalPages = Math.ceil(formattedDemandRows.length / itemsPerPage)
  const paginatedDemandRows = useMemo(() => {
    const startIndex = (demandCurrentPage - 1) * itemsPerPage
    return formattedDemandRows.slice(startIndex, startIndex + itemsPerPage)
  }, [formattedDemandRows, demandCurrentPage])

  // Filtered data based on branch selection
  const filteredBranchData = useMemo(() => {
    if (!data?.byBranch) return []
    if (selectedBranchForBranchTable === 'all') return data.byBranch
    return data.byBranch.filter(item => item.branch_name === selectedBranchForBranchTable)
  }, [data?.byBranch, selectedBranchForBranchTable])

  const filteredBranchDeptData = useMemo(() => {
    if (!data?.byBranchDept) return []
    if (selectedBranchForDepartmentTable === 'all') return data.byBranchDept
    return data.byBranchDept.filter(item => item.branch_name === selectedBranchForDepartmentTable)
  }, [data?.byBranchDept, selectedBranchForDepartmentTable])

  const filteredDeliveryMemberData = useMemo(() => {
    if (!data?.byDeliveryMember) return []
    if (selectedDeliveryBranchForDMTable === 'all') return data.byDeliveryMember
    return data.byDeliveryMember.filter(item => item.delivery_branch_name === selectedDeliveryBranchForDMTable)
  }, [data?.byDeliveryMember, selectedDeliveryBranchForDMTable])

  // Pagination logic for Applications by Branch
  const paginatedBranchData = useMemo(() => {
    const startIndex = (branchCurrentPage - 1) * itemsPerPage
    return filteredBranchData.slice(startIndex, startIndex + itemsPerPage)
  }, [filteredBranchData, branchCurrentPage])

  // Pagination logic for Applications by Branch & Department
  const paginatedBranchDeptData = useMemo(() => {
    const startIndex = (branchDeptCurrentPage - 1) * itemsPerPage
    return filteredBranchDeptData.slice(startIndex, startIndex + itemsPerPage)
  }, [filteredBranchDeptData, branchDeptCurrentPage])

  const paginatedDeliveryMemberData = useMemo(() => {
    const startIndex = (deliveryMemberCurrentPage - 1) * itemsPerPage
    return filteredDeliveryMemberData.slice(startIndex, startIndex + itemsPerPage)
  }, [filteredDeliveryMemberData, deliveryMemberCurrentPage])

  const branchTotalPages = Math.ceil(filteredBranchData.length / itemsPerPage)
  const branchDeptTotalPages = Math.ceil(filteredBranchDeptData.length / itemsPerPage)
  const deliveryMemberTotalPages = Math.ceil(filteredDeliveryMemberData.length / itemsPerPage)

  const exportCSV = (rows, name, options = {}) => {
    if (!rows?.length) return
    let exportRows = rows
    // Optional totals row
    if (options.totals && Array.isArray(options.totals.sumKeys)) {
      const headers = Object.keys(rows[0])
      const totalsRow = {}
      const rawRows = Array.isArray(options.totals.rawRows) ? options.totals.rawRows : rows
      headers.forEach(h => {
        if (options.totals.sumKeys.includes(h)) {
          const sum = rawRows.reduce((acc, r) => acc + Number(r[h] || 0), 0)
          const sumStr = Number(sum).toLocaleString()
          if (h.toLowerCase() === 'amount' || h.toLowerCase() === 'price') {
            const prefix = options.totals && Object.prototype.hasOwnProperty.call(options.totals, 'currencyPrefix')
              ? options.totals.currencyPrefix
              : 'NGN '
            totalsRow[h] = `${prefix ?? ''}${sumStr}`
          } else {
            totalsRow[h] = sumStr
          }
        } else if (h === options.totals.labelKey) {
          totalsRow[h] = options.totals.label || 'TOTAL'
        } else if (h.toLowerCase() === 'sn') {
          totalsRow[h] = ''
        } else {
          totalsRow[h] = ''
        }
      })
      exportRows = [...rows, totalsRow]
    }

    const headers = Object.keys(exportRows[0])
    const lines = []
    if (options.heading) {
      lines.push(options.heading)
    }
    lines.push(headers.join(','))
    const bodyLines = exportRows.map(r => headers
      .map(h => {
        const raw = String(r[h] ?? '')
        const sanitized = raw.replace(/\u20A6|₦/g, 'NGN ')
        return `"${sanitized.replace(/"/g, '""')}"`
      })
      .join(',')
    )

    // Optional footer rows: Signature/Date, Issued/Received labels
    let footerLines = []
    if (options.footer) {
      const footerCol = Number(options.footerColumnIndex ?? 0)
      const empty = headers.map(()=> '""').join(',')
      const sigDate = headers.map((_, i) => {
        if (i === headers.length - 2) return '"SIGNATURE"'
        if (i === headers.length - 1) return '"DATE"'
        return '""'
      }).join(',')
      const issued = headers.map((_, i) => i === footerCol ? '"ITEMS ISSUED BY"' : '""').join(',')
      const received = headers.map((_, i) => i === footerCol ? '"ITEMS RECEIVED BY"' : '""').join(',')
      footerLines = [empty, sigDate, issued, received]
    }

    const csv = [
      ...lines,
      ...bodyLines,
      ...footerLines
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportPDF = async (rows, title, options = {}) => {
    if (!rows?.length) return
    
    try {
      // Import jsPDF dynamically to avoid SSR issues
      const { jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')
      
      const doc = new jsPDF()
      
      // Add title
      doc.setFontSize(16)
      doc.text(title, 14, 22)
      
      // Add timestamp
      doc.setFontSize(10)
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 32)
      
      // Optional: include filter info
      if (options.filters) {
        const filterEntries = Object.entries(options.filters)
          .filter(([_, v]) => v != null && v !== '')
          .map(([k, v]) => `${k}: ${v}`)
        if (filterEntries.length) {
          doc.text(`Filters: ${filterEntries.join('  |  ')}`, 14, 38)
        }
      }
      
      // Prepare table data
      const headers = Object.keys(rows[0])
      let tableData = rows.map(row => headers.map(header => {
        const raw = String(row[header] ?? '')
        // Sanitize currency symbols (e.g., ₦) for PDF standard fonts
        const sanitized = raw.replace(/\u20A6|₦/g, 'NGN ')
        return sanitized
      }))

      // Optional totals row for PDF
      if (options.totals && Array.isArray(options.totals.sumKeys)) {
        const rawRows = Array.isArray(options.totals.rawRows) ? options.totals.rawRows : rows
        const totalsRow = headers.map(h => {
          if (options.totals.sumKeys.includes(h)) {
            const sum = rawRows.reduce((acc, r) => acc + Number(r[h] || 0), 0)
            if (h.toLowerCase() === 'amount' || h.toLowerCase() === 'price') {
              return `NGN ${Number(sum).toLocaleString()}`
            }
            return Number(sum).toLocaleString()
          }
          if (h === options.totals.labelKey) return options.totals.label || 'TOTAL'
          if (h.toLowerCase() === 'sn') return ''
          return ''
        })
        tableData = [...tableData, totalsRow]
      }
      
      // Add table
      autoTable(doc, {
        head: [headers],
        body: tableData,
        startY: options.filters ? 44 : 40,
        styles: { fontSize: 8, lineWidth: 0.1, lineColor: [0,0,0], cellPadding: 2 },
        headStyles: { fillColor: [75, 85, 99] },
        alternateRowStyles: { fillColor: [249, 250, 251] },
        theme: 'grid'
      })

      // Optional footer section appended after the table
      if (options.footer) {
        const footerCol = Number(options.footerColumnIndex ?? 0)
        const makeRow = (mapper) => headers.map((_, i) => mapper(i))
        const sigDateRow = makeRow(i => i === headers.length - 2 ? 'SIGNATURE' : (i === headers.length - 1 ? 'DATE' : ''))
        const issuedRow = makeRow(i => i === footerCol ? 'ITEMS ISSUED BY' : '')
        const receivedRow = makeRow(i => i === footerCol ? 'ITEMS RECEIVED BY' : '')
        autoTable(doc, {
          head: [],
          body: [sigDateRow, issuedRow, receivedRow],
          startY: (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY + 6 : undefined,
          styles: { fontSize: 9, lineWidth: 0.1, lineColor: [0,0,0], cellPadding: 2 },
          theme: 'grid'
        })
      }
      
      // Save the PDF
      doc.save(`${title.replace(/\s+/g, '_').toLowerCase()}.pdf`)
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Error generating PDF. Please try again.')
    }
  }

  // Items Pack: multi-sheet Excel (one sheet per delivery location)
  const exportItemsPack = async () => {
    try {
      setItemsPackLoading(true)
      setItemsPackProgress({ current: 0, total: 0 })
      const ExcelJSMod = await import('exceljs')
      const ExcelJS = ExcelJSMod?.default ?? ExcelJSMod
      const wb = new ExcelJS.Workbook()
      const safeName = (name) => String(name).replace(/[\\/?*\[\]]/g, ' ').slice(0, 31)
      const summary = []

      // Iterate over known delivery locations (branches) and fetch per branch
      const branchList = branches && Array.isArray(branches) ? branches : []
      if (!branchList.length) return alert('No delivery locations found to export')

      // Helper: fetch rows for a branch with robust retry/backoff when rate-limited
      const fetchBranchRows = async (branch) => {
        const qsb = new URLSearchParams()
        qsb.set('branch', branch.code)
        if (selectedDepartmentId !== 'all') qsb.set('department_id', String(selectedDepartmentId))
        let attempt = 0
        const maxAttempts = 8
        let lastErrorText = ''
        while (attempt < maxAttempts) {
          attempt += 1
          const res = await fetch(`/api/admin/reports/delivery-dept-items?${qsb.toString()}`, { cache: 'no-store' })
          const ct = res.headers.get('content-type') || ''
          if (res.status === 429) {
            // Honor Retry-After if provided, else exponential backoff with jitter
            const retryAfterHeader = res.headers.get('retry-after') || res.headers.get('x-ratelimit-reset')
            let waitMs = 0
            if (retryAfterHeader) {
              const seconds = Number(retryAfterHeader)
              waitMs = Math.min(15000, Math.max(1000, Math.ceil(seconds * 1000)))
            } else {
              const base = 900
              const jitter = Math.floor(Math.random() * 400) // 0-400ms
              waitMs = Math.min(15000, Math.round(base * Math.pow(2, attempt - 1)) + jitter)
            }
            lastErrorText = await res.text()
            await new Promise(r => setTimeout(r, waitMs))
            continue
          }
          if (!res.ok) {
            const txt = ct.includes('application/json') ? JSON.stringify(await res.json()) : await res.text()
            throw new Error(`Request failed (${res.status}): ${txt.slice(0, 180)}`)
          }
          if (!ct.includes('application/json')) {
            const txt = await res.text()
            throw new Error(`Unexpected response: ${txt.slice(0, 180)}`)
          }
          const json = await res.json()
          if (!json.ok) throw new Error(json.error || 'Failed to load demand data')
          // Small pacing delay between successful branch fetches to avoid burst rate-limit
          await new Promise(r => setTimeout(r, 250))
          return json.rows || []
        }
        throw new Error(`Rate limited while fetching ${branch.name || branch.code}. Details: ${lastErrorText.slice(0, 180)}`)
      }

      setItemsPackProgress({ current: 0, total: branchList.length })

      for (let i = 0; i < branchList.length; i++) {
        const b = branchList[i]
        // Update progress before fetching to show intent
        setItemsPackProgress({ current: i + 1, total: branchList.length })
        let arr = []
        try {
          arr = await fetchBranchRows(b)
        } catch (err) {
          console.warn('Items Pack: skipping branch due to repeated rate-limit:', b?.name || b?.code, err?.message)
          const sheetName = safeName(b.name || b.code || 'Unknown')
          const ws = wb.addWorksheet(sheetName)
          const title = `Summary of Items from ${b.name || b.code || 'Unknown'}`
          const headers = ["SN","Items","Category","Original Price","Markup","Quantity","Markup Amount","Amount With Markup","Amount Without Markup"]
          ws.addRow([title])
          ws.addRow(headers)
          ws.addRow(['', `Rate limited: ${b.name || b.code}`, '', '', '', '', '', '', ''])
          ws.addRow(['','TOTAL','','','',0,0,0,0])
          ws.mergeCells('A1','I1')
          ws.columns = [
            { key: 'sn', width: 6 },
            { key: 'items', width: 28 },
            { key: 'category', width: 18 },
            { key: 'original', width: 14 },
            { key: 'markup', width: 12 },
            { key: 'qty', width: 10 },
            { key: 'markupAmt', width: 18 },
            { key: 'amtWith', width: 20 },
            { key: 'amtWithout', width: 20 },
          ]
          const titleCell = ws.getCell('A1')
          titleCell.font = { bold: true, size: 13 }
          titleCell.alignment = { horizontal: 'center' }
          const headerRow = ws.getRow(2)
          headerRow.font = { bold: true }
          headerRow.alignment = { horizontal: 'center' }
          const lastRow = ws.rowCount
          for (let r = 2; r <= lastRow; r++) {
            for (let c = 1; c <= 9; c++) {
              const cell = ws.getRow(r).getCell(c)
              cell.border = {
                top: { style: 'thick' },
                left: { style: 'thick' },
                bottom: { style: 'thick' },
                right: { style: 'thick' },
              }
              if (c >= 4 && r >= 3) {
                if (c === 6) cell.numFmt = '0'; else cell.numFmt = '#,##0'
              }
            }
          }
          summary.push({ 'Location': b.name || b.code || 'Unknown', 'Quantity': 0, 'Markup Amount': 0, 'Amount With Markup': 0, 'Amount Without Markup': 0 })
          continue
        }
        const qsb = new URLSearchParams()
        // Yield to UI so the spinner/progress can update
        await new Promise(r => setTimeout(r, 10))
        if (!arr.length) {
          const sheetName = safeName(b.name || b.code || 'Unknown')
          const ws = wb.addWorksheet(sheetName)
          const title = `Summary of Items from ${b.name || b.code || 'Unknown'}`
          const headers = ["SN","Items","Category","Original Price","Markup","Quantity","Markup Amount","Amount With Markup","Amount Without Markup"]
          ws.addRow([title])
          ws.addRow(headers)
          ws.addRow(['','TOTAL','','','',0,0,0,0])
          ws.mergeCells('A1','I1')
          ws.columns = [
            { key: 'sn', width: 6 },
            { key: 'items', width: 28 },
            { key: 'category', width: 18 },
            { key: 'original', width: 14 },
            { key: 'markup', width: 12 },
            { key: 'qty', width: 10 },
            { key: 'markupAmt', width: 18 },
            { key: 'amtWith', width: 20 },
            { key: 'amtWithout', width: 20 },
          ]
          const titleCell = ws.getCell('A1')
          titleCell.font = { bold: true, size: 13 }
          titleCell.alignment = { horizontal: 'center' }
          const headerRow = ws.getRow(2)
          headerRow.font = { bold: true }
          headerRow.alignment = { horizontal: 'center' }
          const lastRow = ws.rowCount
          for (let r = 2; r <= lastRow; r++) {
            for (let c = 1; c <= 9; c++) {
              const cell = ws.getRow(r).getCell(c)
              cell.border = {
                top: { style: 'thick' },
                left: { style: 'thick' },
                bottom: { style: 'thick' },
                right: { style: 'thick' },
              }
              if (c >= 4 && r >= 3) {
                if (c === 6) cell.numFmt = '0'; else cell.numFmt = '#,##0'
              }
            }
          }
          summary.push({ 'Location': b.name || b.code || 'Unknown', 'Quantity': 0, 'Markup Amount': 0, 'Amount With Markup': 0, 'Amount Without Markup': 0 })
          continue
        }

        const sorted = [...arr].sort((a, b) => {
          const ac = String(a.category || '').toLowerCase()
          const bc = String(b.category || '').toLowerCase()
          if (ac < bc) return -1
          if (ac > bc) return 1
          const ai = String(a.items || '').toLowerCase()
          const bi = String(b.items || '').toLowerCase()
          if (ai < bi) return -1
          if (ai > bi) return 1
          return 0
        })

        let sn = 0
        let totalQty = 0
        let totalMarkupAmt = 0
        let totalAmtWithMarkup = 0
        let totalAmtWithoutMarkup = 0

        const sheetRows = sorted.map(r => {
          sn += 1
          const original = Number(r.original_price || 0)
          const markup = Number(r.markup || 0)
          const qty = Number(r.quantity || 0)
          const amountWithoutMarkup = original * qty
          const markupAmount = markup * qty
          const amountWithMarkup = (original + markup) * qty

          totalQty += qty
          totalMarkupAmt += markupAmount
          totalAmtWithMarkup += amountWithMarkup
          totalAmtWithoutMarkup += amountWithoutMarkup

          return {
            'SN': sn,
            'Items': r.items,
            'Category': r.category || '',
            'Original Price': original,
            'Markup': markup,
            'Quantity': qty,
            'Markup Amount': markupAmount,
            'Amount With Markup': amountWithMarkup,
            'Amount Without Markup': amountWithoutMarkup,
          }
        })

        const sheetName = safeName(b.name || b.code || 'Unknown')
        const ws = wb.addWorksheet(sheetName)
        const title = `Summary of Items from ${b.name || b.code || 'Unknown'}`
        const headers = ["SN","Items","Category","Original Price","Markup","Quantity","Markup Amount","Amount With Markup","Amount Without Markup"]
        ws.addRow([title])
        ws.addRow(headers)
        for (const rr of sheetRows) {
          ws.addRow([rr['SN'], rr['Items'], rr['Category'], rr['Original Price'], rr['Markup'], rr['Quantity'], rr['Markup Amount'], rr['Amount With Markup'], rr['Amount Without Markup']])
        }
        ws.addRow(['','TOTAL','','','', totalQty, totalMarkupAmt, totalAmtWithMarkup, totalAmtWithoutMarkup])
        ws.mergeCells('A1','I1')
        ws.columns = [
          { key: 'sn', width: 6 },
          { key: 'items', width: 28 },
          { key: 'category', width: 18 },
          { key: 'original', width: 14 },
          { key: 'markup', width: 12 },
          { key: 'qty', width: 10 },
          { key: 'markupAmt', width: 18 },
          { key: 'amtWith', width: 20 },
          { key: 'amtWithout', width: 20 },
        ]
        const titleCell = ws.getCell('A1')
        titleCell.font = { bold: true, size: 13 }
        titleCell.alignment = { horizontal: 'center' }
        const headerRow = ws.getRow(2)
        headerRow.font = { bold: true }
        headerRow.alignment = { horizontal: 'center' }
        const lastRow = ws.rowCount
        for (let r = 2; r <= lastRow; r++) {
          for (let c = 1; c <= 9; c++) {
            const cell = ws.getRow(r).getCell(c)
            cell.border = {
              top: { style: 'thick' },
              left: { style: 'thick' },
              bottom: { style: 'thick' },
              right: { style: 'thick' },
            }
            if (c >= 4 && r >= 3) {
              if (c === 6) cell.numFmt = '0'; else cell.numFmt = '#,##0'
            }
          }
        }

        summary.push({
          'Location': b.name || b.code || 'Unknown',
          'Quantity': totalQty,
          'Markup Amount': totalMarkupAmt,
          'Amount With Markup': totalAmtWithMarkup,
          'Amount Without Markup': totalAmtWithoutMarkup,
        })
      }

      const summarySheet = wb.addWorksheet(safeName('Summary'))
      summarySheet.addRow(['Summary of Items by Location'])
      summarySheet.mergeCells('A1','E1')
      summarySheet.addRow(['Location','Quantity','Markup Amount','Amount With Markup','Amount Without Markup'])
      for (const row of summary) {
        summarySheet.addRow([row['Location'], row['Quantity'], row['Markup Amount'], row['Amount With Markup'], row['Amount Without Markup']])
      }
      summarySheet.columns = [
        { key: 'loc', width: 28 },
        { key: 'qty', width: 12 },
        { key: 'markupAmt', width: 18 },
        { key: 'amtWith', width: 20 },
        { key: 'amtWithout', width: 20 },
      ]
      const sumTitle = summarySheet.getCell('A1')
      sumTitle.font = { bold: true, size: 13 }
      sumTitle.alignment = { horizontal: 'center' }
      const sumHeaderRow = summarySheet.getRow(2)
      sumHeaderRow.font = { bold: true }
      sumHeaderRow.alignment = { horizontal: 'center' }
      const sumLastRow = summarySheet.rowCount
      for (let r = 2; r <= sumLastRow; r++) {
        for (let c = 1; c <= 5; c++) {
          const cell = summarySheet.getRow(r).getCell(c)
          cell.border = {
            top: { style: 'thick' },
            left: { style: 'thick' },
            bottom: { style: 'thick' },
            right: { style: 'thick' },
          }
          if (c >= 2 && r >= 3) {
            if (c === 2) cell.numFmt = '0'; else cell.numFmt = '#,##0'
          }
        }
      }

      // Memo sheet: Summary of Orders from All Delivery Locations
      const memo = wb.addWorksheet(safeName('Memo'))
      memo.addRow(['Summary of Orders from All Delivery Locations'])
      memo.mergeCells('A1','D1')
      memo.addRow(['SN','Delivery Location','Amount With Markup','Amount Without Markup'])

      let snMemo = 0
      let totalWith = 0
      let totalWithout = 0
      for (const row of summary) {
        snMemo += 1
        const withMarkup = Number(row['Amount With Markup'] || 0)
        const withoutMarkup = Number(row['Amount Without Markup'] || 0)
        totalWith += withMarkup
        totalWithout += withoutMarkup
        memo.addRow([snMemo, row['Location'], withMarkup, withoutMarkup])
      }
      // Totals row
      memo.addRow(['', 'TOTAL', totalWith, totalWithout])

      memo.columns = [
        { key: 'sn', width: 6 },
        { key: 'loc', width: 28 },
        { key: 'amtWith', width: 20 },
        { key: 'amtWithout', width: 20 },
      ]
      const memoTitle = memo.getCell('A1')
      memoTitle.font = { bold: true, size: 13 }
      memoTitle.alignment = { horizontal: 'center' }
      const memoHeaderRow = memo.getRow(2)
      memoHeaderRow.font = { bold: true }
      memoHeaderRow.alignment = { horizontal: 'center' }
      const memoLastRow = memo.rowCount
      for (let r = 2; r <= memoLastRow; r++) {
        for (let c = 1; c <= 4; c++) {
          const cell = memo.getRow(r).getCell(c)
          cell.border = {
            top: { style: 'thick' },
            left: { style: 'thick' },
            bottom: { style: 'thick' },
            right: { style: 'thick' },
          }
          if (c >= 3 && r >= 3) {
            cell.numFmt = '#,##0'
          }
        }
      }

      const deptName = selectedDepartmentId === 'all'
        ? 'ALL_DEPTS'
        : (departments.find(d => String(d.id) === String(selectedDepartmentId))?.name || String(selectedDepartmentId))
      const buffer = await wb.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Items_Pack_${deptName}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('Items Pack export failed:', e)
      alert(`Items Pack export failed: ${e.message}`)
    } finally {
      setItemsPackLoading(false)
      setItemsPackProgress({ current: 0, total: 0 })
    }
  }

  if (loading) return <div className="p-6">Loading…</div>
  if (err) return (
    <div className="p-6">
      <div className="text-red-700 mb-3">Error: {err}</div>
      <button className="px-3 py-2 bg-blue-600 text-white rounded" onClick={loadSummary}>Retry</button>
    </div>
  )
  if (!data) return <div className="p-6">No data</div>

  const { totals, byBranch, byBranchDept, byDeliveryMember, byCategory, amounts } = data

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-semibold mb-2 sm:mb-0">Admin — Reports</h1>
        <div className="flex gap-2">
          <button className="px-3 py-2 bg-gray-600 text-white text-sm sm:text-base rounded hover:bg-gray-700" onClick={loadSummary}>Refresh</button>
        </div>
      </div>

      {/* Totals */}
      <section className="mb-4 sm:mb-6 grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <Card title="Pending" value={totals?.totalPending ?? 0} />
        <Card title="Posted" value={totals?.totalPosted ?? 0} />
        <Card title="Delivered" value={totals?.totalDelivered ?? 0} />
        <Card title="All Orders" value={totals?.totalAll ?? 0} />
      </section>

      {/* Amount Totals */}
      <section className="mb-4 sm:mb-6 grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <Card title="Loan Principal" value={amounts?.loansPrincipal ?? 0} currency />
        <Card title="Loan Interest" value={amounts?.loansInterest ?? 0} currency />
        <Card title="Loan Total" value={amounts?.loans ?? amounts?.loansTotal ?? 0} currency />
        <Card title="Savings" value={amounts?.savings ?? 0} currency />
        <Card title="Cash" value={amounts?.cash ?? 0} currency />
        <Card title="Total Amount" value={amounts?.totalAll ?? 0} currency />
      </section>

      {/* Branch Pack */}
      <section className="mb-4 sm:mb-6">
        <h2 className="text-lg sm:text-xl font-medium mb-2">Branch Pack (Excel)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap items-center gap-2 sm:gap-3">
          <select
            className="border rounded px-3 py-2 text-sm sm:text-base w-full sm:w-auto"
            value={branchCode}
            onChange={e => setBranchCode(e.target.value)}
          >
            <option value="">All branches</option>
            {branches.map(b => (
              <option key={b.code} value={b.code}>
                {b.name} ({b.code})
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2">
            <label className="text-xs sm:text-sm text-gray-600 whitespace-nowrap">From</label>
            <input type="date" className="border rounded px-2 py-1 text-sm sm:text-base flex-1" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs sm:text-sm text-gray-600 whitespace-nowrap">To</label>
            <input type="date" className="border rounded px-2 py-1 text-sm sm:text-base flex-1" value={to} onChange={e => setTo(e.target.value)} />
          </div>

          <button
            className={`px-3 py-2 text-white text-sm sm:text-base rounded w-full sm:w-auto flex items-center justify-center gap-2 ${branchPackLoading ? 'bg-emerald-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'}`}
            disabled={branchPackLoading}
            aria-busy={branchPackLoading}
            onClick={async () => {
              if (branchPackLoading) return
              try {
                setBranchPackLoading(true)
                const qs = new URLSearchParams()
                if (branchCode) qs.set('branch', branchCode)
                if (from) qs.set('from', from)
                if (to) qs.set('to', to)

                const res = await fetch(`/api/admin/reports/branch-pack?${qs.toString()}`)
                const json = await res.json()

                if (!json.ok) {
                  return alert(`Download failed: ${json.error || 'Unknown error'}`)
                }

                // Convert base64 to blob
                const byteCharacters = atob(json.data)
                const byteNumbers = new Array(byteCharacters.length)
                for (let i = 0; i < byteCharacters.length; i++) {
                  byteNumbers[i] = byteCharacters.charCodeAt(i)
                }
                const byteArray = new Uint8Array(byteNumbers)
                const blob = new Blob([byteArray], { type: json.type })

                // Create download link
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = json.filename || `Branch_Pack_${branchCode || 'ALL'}.xlsx`
                a.click()
                URL.revokeObjectURL(url)
              } catch (error) {
                console.error('Download error:', error)
                alert(`Download failed: ${error.message || 'Network error'}`)
              } finally {
                setBranchPackLoading(false)
              }
            }}
          >
            {branchPackLoading && (
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden="true"></span>
            )}
            {branchPackLoading ? 'Preparing…' : 'Download Branch Pack'}
          </button>
        </div>
      </section>

      {/* Applications by Branch */}
      <PaginatedSection 
        title="Applications by Branch" 
        data={paginatedBranchData}
        allData={filteredBranchData}
        cols={[
          ['branch_name', 'Branch'], 
          ['pending', 'Pending'],
          ['posted', 'Posted'],
          ['delivered', 'Delivered']
        ]}
        currentPage={branchCurrentPage}
        setCurrentPage={setBranchCurrentPage}
        totalPages={branchTotalPages}
        itemsPerPage={itemsPerPage}
        onExportCSV={() => exportCSV(filteredBranchData, 'applications_by_branch.csv')}
        onExportPDF={() => exportPDF(filteredBranchData, 'Applications by Branch')}
        filter={
          <BranchFilter
            value={selectedBranchForBranchTable}
            onChange={(value) => {
              setSelectedBranchForBranchTable(value)
              setBranchCurrentPage(1) // Reset to first page when filter changes
            }}
            label="Filter by Branch"
            branches={uniqueBranches}
          />
        }
      />

      {/* Applications by Branch & Department */}
      <PaginatedSection 
        title="Applications by Branch & Department" 
        data={paginatedBranchDeptData}
        allData={filteredBranchDeptData}
        cols={[
          ['branch_name', 'Branch'], 
          ['department_name', 'Department'], 
          ['pending', 'Pending'],
          ['posted', 'Posted'],
          ['delivered', 'Delivered']
        ]}
        currentPage={branchDeptCurrentPage}
        setCurrentPage={setBranchDeptCurrentPage}
        totalPages={branchDeptTotalPages}
        itemsPerPage={itemsPerPage}
        onExportCSV={() => exportCSV(filteredBranchDeptData, 'applications_by_branch_department.csv')}
        onExportPDF={() => exportPDF(filteredBranchDeptData, 'Applications by Branch & Department')}
        filter={
          <BranchFilter
            value={selectedBranchForDepartmentTable}
            onChange={(value) => {
              setSelectedBranchForDepartmentTable(value)
              setBranchDeptCurrentPage(1) // Reset to first page when filter changes
            }}
            label="Filter by Branch"
            branches={uniqueBranches}
          />
        }
      />

      {/* Applications by Delivery Branch & Branch */}
      <PaginatedSection 
        title="Applications by Delivery Branch & Branch" 
        data={paginatedDeliveryMemberData}
        allData={filteredDeliveryMemberData}
        cols={[
          ['delivery_branch_name', 'Delivery Branch'],
          ['branch_name', 'Branch'], 
          ['pending', 'Pending'],
          ['posted', 'Posted'],
          ['delivered', 'Delivered']
        ]}
        currentPage={deliveryMemberCurrentPage}
        setCurrentPage={setDeliveryMemberCurrentPage}
        totalPages={deliveryMemberTotalPages}
        itemsPerPage={itemsPerPage}
        onExportCSV={() => exportCSV(filteredDeliveryMemberData, 'applications_by_delivery_branch_and_branch.csv')}
        onExportPDF={() => exportPDF(filteredDeliveryMemberData, 'Applications by Delivery Branch & Branch')}
        filter={
          <BranchFilter
            value={selectedDeliveryBranchForDMTable}
            onChange={(value) => {
              setSelectedDeliveryBranchForDMTable(value)
              setDeliveryMemberCurrentPage(1)
            }}
            label="Filter by Delivery Branch"
            branches={uniqueDeliveryBranches}
          />
        }
      />

      {/* Applications by Category (No Pagination) */}
      <Section 
        title="Applications by Category (A/R/P/E)" 
        onExportCSV={() => exportCSV(byCategory, 'applications_by_category.csv')}
        onExportPDF={() => exportPDF(byCategory, 'Applications by Category')}
      >
        <Table rows={byCategory} cols={[
          ['category', 'Category'], 
          ['pending', 'Pending'],
          ['posted', 'Posted'],
          ['delivered', 'Delivered']
        ]} />
      </Section>

      {/* Items Demand by Delivery Location & Department */}
      <PaginatedSection 
        title="Items Demand by Delivery Location & Department" 
        data={paginatedDemandRows}
        allData={formattedDemandRows}
        cols={[
          ['sn', 'SN'],
          ['items', 'Items'],
          ['category', 'Category'],
          ['original_price', 'Price'],
          ['markup', 'Markup'],
          ['quantity', 'Quantity'],
          ['amount', 'Amount']
        ]}
        currentPage={demandCurrentPage}
        setCurrentPage={setDemandCurrentPage}
        totalPages={demandTotalPages}
        itemsPerPage={itemsPerPage}
        onExportItemsPack={exportItemsPack}
        itemsPackLoading={itemsPackLoading}
        itemsPackProgress={itemsPackProgress}
        onExportCSV={() => exportCSV(
          formattedDemandRows,
          'items_demand_by_delivery_and_department.csv',
          { totals: { labelKey: 'items', label: 'TOTAL', sumKeys: ['quantity', 'amount'], rawRows: demandRawForTotals } }
        )}
        onExportPDF={() => {
          const branchName = selectedDeliveryCode === 'all'
            ? 'All Delivery Locations'
            : (branches.find(b => b.code === selectedDeliveryCode)?.name || selectedDeliveryCode)
          const departmentName = selectedDepartmentId === 'all'
            ? 'All Departments'
            : (departments.find(d => String(d.id) === String(selectedDepartmentId))?.name || selectedDepartmentId)
          exportPDF(
            formattedDemandRows,
            'Items Demand by Delivery & Department',
            { filters: { 'Delivery Location': branchName, 'Department': departmentName }, totals: { labelKey: 'items', label: 'TOTAL', sumKeys: ['quantity', 'amount'], rawRows: demandRawForTotals } }
          )
        }}
        filter={(
          <div className="flex gap-6 mb-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Delivery Location</label>
              <select
                value={selectedDeliveryCode}
                onChange={e => setSelectedDeliveryCode(e.target.value)}
                className="block w-56 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                <option value="all">All Delivery Locations</option>
                {branches.map(b => (
                  <option key={b.code} value={b.code}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Department</label>
              <select
                value={selectedDepartmentId}
                onChange={e => setSelectedDepartmentId(e.target.value)}
                className="block w-56 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                <option value="all">All Departments</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      />

      {/* Summary of Items Section with pagination and Excel export */}
      {(() => {
        const baseRows = (summarySelectedItems.length ? demandRows.filter(r => summarySelectedItems.includes(r.items)) : demandRows)
        const formattedRows = baseRows.map((r, idx) => {
          const original = Number(r?.original_price || 0)
          const qty = Number(r?.quantity || 0)
          const amount = original * qty
          return {
            sn: idx + 1,
            'delivery location': selectedDeliveryCode === 'all'
              ? 'All Delivery Locations'
              : (branches.find(b => b.code === selectedDeliveryCode)?.name || selectedDeliveryCode),
            items: r.items,
            qty: qty.toLocaleString(),
            price: original.toLocaleString(),
            amount: amount.toLocaleString()
          }
        })
        const startIndex = (summaryCurrentPage - 1) * itemsPerPage
        const paginatedRows = formattedRows.slice(startIndex, startIndex + itemsPerPage)
        const totalPages = Math.ceil(formattedRows.length / itemsPerPage) || 1

        return (
          <PaginatedSection
            title="Summary of Items"
            data={paginatedRows}
            allData={formattedRows}
            cols={[
              ['sn', 'SN'],
              ['delivery location', 'Delivery Location'],
              ['items', 'Items'],
              ['qty', 'Qty'],
              ['price', 'Price'],
              ['amount', 'Amount']
            ]}
            currentPage={summaryCurrentPage}
            setCurrentPage={setSummaryCurrentPage}
            totalPages={totalPages}
            itemsPerPage={itemsPerPage}
            onExportCSV={exportSummaryCSV}
            onExportPDF={exportSummaryPDF}
            onExportExcel={exportSummaryExcel}
            filter={(
              <div className="flex gap-6 mb-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Delivery Location</label>
                  <select
                    value={selectedDeliveryCode}
                    onChange={e => setSelectedDeliveryCode(e.target.value)}
                    className="block w-56 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  >
                    <option value="all">All Delivery Locations</option>
                    {branches.map(b => (
                      <option key={b.code} value={b.code}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Department</label>
                  <select
                    value={selectedDepartmentId}
                    onChange={e => setSelectedDepartmentId(e.target.value)}
                    className="block w-56 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  >
                    <option value="all">All Departments</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Items</label>
                  <div className="flex items-center gap-3 mb-2">
                    <button
                      type="button"
                      className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
                      onClick={() => setSummarySelectedItems(summaryItemOptions)}
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
                      onClick={() => setSummarySelectedItems([])}
                    >
                      Clear
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-auto border rounded p-2">
                    {summaryItemOptions.length === 0 && (
                      <div className="text-sm text-gray-500">No items available for current filters.</div>
                    )}
                    {summaryItemOptions.map(name => {
                      const checked = summarySelectedItems.includes(name)
                      return (
                        <label key={name} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setSummarySelectedItems(prev => {
                                const set = new Set(prev)
                                if (set.has(name)) {
                                  set.delete(name)
                                } else {
                                  set.add(name)
                                }
                                return Array.from(set)
                              })
                            }}
                          />
                          <span>{name}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          />
        )
      })()}

      {/* Branch Item Prices Matrix removed */}
    </div>
  )
}

/* Helpers */
function Card({ title, value, currency = false }) {
  const display = currency ? `₦${Number(value || 0).toLocaleString()}` : Number(value || 0).toLocaleString()
  return (
    <div className="border rounded p-2 sm:p-3 bg-white shadow-sm">
      <div className="text-xs text-gray-500 truncate">{title}</div>
      <div className="text-lg sm:text-xl font-semibold">{display}</div>
    </div>
  )
}

// Branch Filter Component
function BranchFilter({ value, onChange, label, branches }) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="block w-48 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
      >
        <option value="all">All Branches</option>
        {branches.map(branch => (
          <option key={branch} value={branch}>{branch}</option>
        ))}
      </select>
    </div>
  )
}

function PaginatedSection({ title, data, allData, cols, currentPage, setCurrentPage, totalPages, itemsPerPage, onExportCSV, onExportPDF, onExportItemsPack, onExportExcel, filter, itemsPackLoading = false, itemsPackProgress = { current: 0, total: 0 } }) {
  const showPagination = allData?.length > itemsPerPage

  return (
    <section className="mb-4 sm:mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 mb-3">
        <h2 className="text-lg sm:text-xl font-medium">{title}</h2>
        <div className="flex gap-2">
          {onExportItemsPack && (
            <button
              className={`px-3 py-1 text-white text-sm rounded flex items-center gap-2 ${itemsPackLoading ? 'bg-purple-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'}`}
              onClick={onExportItemsPack}
              disabled={itemsPackLoading}
              aria-busy={itemsPackLoading}
            >
              {itemsPackLoading ? (
                <>
                  <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  <span>
                    Exporting… {itemsPackProgress.total > 0 ? `${itemsPackProgress.current}/${itemsPackProgress.total}` : ''}
                  </span>
                </>
              ) : (
                'Items Pack'
              )}
            </button>
          )}
          {onExportExcel && (
            <button 
              className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700" 
              onClick={onExportExcel}
            >
              Export Excel
            </button>
          )}
          <button 
            className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700" 
            onClick={onExportPDF}
          >
            Export PDF
          </button>
          <button 
            className="px-3 py-1 bg-gray-700 text-white text-sm rounded hover:bg-gray-800" 
            onClick={onExportCSV}
          >
            Export CSV
          </button>
        </div>
      </div>
      
      {/* Render filter if provided */}
      {filter}
      
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <Table rows={data} cols={cols} />
        
        {/* Pagination */}
        {showPagination && (
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-200">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-sm text-gray-700">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
            <div className="text-sm text-gray-500">
              Showing {Math.min((currentPage - 1) * itemsPerPage + 1, allData?.length || 0)} to {Math.min(currentPage * itemsPerPage, allData?.length || 0)} of {allData?.length || 0} items
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function Section({ title, onExportCSV, onExportPDF, children }) {
  return (
    <section className="mb-4 sm:mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 mb-3">
        <h2 className="text-lg sm:text-xl font-medium">{title}</h2>
        <div className="flex gap-2">
          <button 
            className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700" 
            onClick={onExportPDF}
          >
            Export PDF
          </button>
          <button 
            className="px-3 py-1 bg-gray-700 text-white text-sm rounded hover:bg-gray-800" 
            onClick={onExportCSV}
          >
            Export CSV
          </button>
        </div>
      </div>
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        {children}
      </div>
    </section>
  )
}

function Table({ rows, cols, stickyFirst = false, stickyIndices = [] }) {
  if (!rows?.length) return <div className="p-4 text-gray-600 text-sm text-center">No data available</div>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs sm:text-sm min-w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            {cols.map(([key, label], idx) => (
              <th
                key={key}
                className={`px-4 py-3 text-left text-xs sm:text-sm font-medium text-gray-700 uppercase tracking-wider ${ (stickyIndices.includes(idx) || (stickyFirst && idx === 0)) ? `sticky z-10 bg-gray-50 ${idx === 0 ? 'left-0' : 'left-[8rem]'}` : ''}`}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {rows.map((r, i) => (
             <tr key={i} className="hover:bg-gray-50 transition-colors duration-150">
               {cols.map(([key], idx) => (
                 <td
                   key={key}
                   className={`px-4 py-3 text-xs sm:text-sm text-gray-900 whitespace-nowrap ${ (stickyIndices.includes(idx) || (stickyFirst && idx === 0)) ? `sticky z-10 ${idx === 0 ? 'left-0 bg-white' : 'left-[8rem] bg-white'}` : ''}`}
                 >
                   {String(r[key] ?? '')}
                 </td>
               ))}
             </tr>
           ))}
        </tbody>
      </table>
    </div>
  )
}

export default function ReportsPage() {
  return (
    <ProtectedRoute>
      <ReportsPageContent />
    </ProtectedRoute>
  )
}