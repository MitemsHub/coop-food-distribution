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

  const exportCSV = (rows, name) => {
    if (!rows?.length) return
    const headers = Object.keys(rows[0])
    const csv = [
      headers.join(','),
      ...rows.map(r => headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','))
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportPDF = async (rows, title) => {
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
      
      // Prepare table data
      const headers = Object.keys(rows[0])
      const tableData = rows.map(row => headers.map(header => String(row[header] ?? '')))
      
      // Add table
      autoTable(doc, {
        head: [headers],
        body: tableData,
        startY: 40,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [75, 85, 99] },
        alternateRowStyles: { fillColor: [249, 250, 251] }
      })
      
      // Save the PDF
      doc.save(`${title.replace(/\s+/g, '_').toLowerCase()}.pdf`)
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Error generating PDF. Please try again.')
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
        <Card title="Loans" value={amounts?.loans ?? 0} currency />
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
            className="px-3 py-2 bg-emerald-600 text-white text-sm sm:text-base rounded w-full sm:w-auto"
            onClick={async () => {
              const qs = new URLSearchParams()
              if (branchCode) qs.set('branch', branchCode)
              if (from) qs.set('from', from)
              if (to) qs.set('to', to)
              const res = await fetch(`/api/admin/reports/branch-pack?${qs.toString()}`)
              if (!res.ok) {
                const t = await res.text()
                return alert(`Download failed: ${t}`)
              }
              const blob = await res.blob()
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `Branch_Pack_${branchCode || 'ALL'}.xlsx`
              a.click()
              URL.revokeObjectURL(url)
            }}
          >
            Download Branch Pack
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

function PaginatedSection({ title, data, allData, cols, currentPage, setCurrentPage, totalPages, itemsPerPage, onExportCSV, onExportPDF, filter }) {
  const showPagination = allData?.length > itemsPerPage

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

function Table({ rows, cols }) {
  if (!rows?.length) return <div className="p-4 text-gray-600 text-sm text-center">No data available</div>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs sm:text-sm min-w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            {cols.map(([key, label]) => (
              <th key={key} className="px-4 py-3 text-left text-xs sm:text-sm font-medium text-gray-700 uppercase tracking-wider">{label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {rows.map((r, i) => (
             <tr key={i} className="hover:bg-gray-50 transition-colors duration-150">
               {cols.map(([key]) => (
                 <td key={key} className="px-4 py-3 text-xs sm:text-sm text-gray-900 whitespace-nowrap">{String(r[key] ?? '')}</td>
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