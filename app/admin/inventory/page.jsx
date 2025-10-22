// app/admin/inventory/page.jsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import ProtectedRoute from '../../components/ProtectedRoute'

// Department Inventory Section Component
function DepartmentInventorySection() {
  const [departmentData, setDepartmentData] = useState([])
  const [departments, setDepartments] = useState([])
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedBranch, setSelectedBranch] = useState('All Branches')
  const [selectedDepartment, setSelectedDepartment] = useState('All Departments')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Safe JSON helper
  const safeJson = async (res, label) => {
    const ct = res.headers.get('content-type') || ''
    if (ct.includes('application/json')) return await res.json()
    const text = await res.text()
    throw new Error(`Non-JSON response from ${label} (${res.status}): ${text.slice(0, 300)}`)
  }

  // Load departments and branches
  useEffect(() => {
    loadDepartments()
    loadBranches()
  }, [])

  // Load department inventory data when filters change
  useEffect(() => {
    loadDepartmentInventory()
  }, [selectedBranch, selectedDepartment])

  const loadDepartments = async () => {
    try {
      const response = await fetch('/api/admin/inventory/department-status', {
        method: 'OPTIONS'
      })
      const data = await safeJson(response, '/api/admin/inventory/department-status (OPTIONS)')
      setDepartments(data.departments || [])
    } catch (error) {
      console.error('Error loading departments:', error)
    }
  }

  const loadBranches = async () => {
    try {
      // Align with Branch section: load from /api/branches/list
      const res = await fetch('/api/branches/list', { cache: 'no-store' })
      const json = await res.json()
      if (json.ok) {
        // Use branch names for dropdown values (consistent with Branch section)
        const uniqueBranches = [...new Set((json.branches || []).map(b => b.name))]
        setBranches(uniqueBranches)
      }
    } catch (error) {
      console.error('Error loading branches:', error)
    }
  }

  const loadDepartmentInventory = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedBranch !== 'All Branches') params.append('branch', selectedBranch)
      if (selectedDepartment !== 'All Departments') params.append('department', selectedDepartment)
      
      const response = await fetch(`/api/admin/inventory/department-status?${params}`)
      const result = await safeJson(response, '/api/admin/inventory/department-status')
      setDepartmentData(result.data || [])
    } catch (error) {
      console.error('Error loading department inventory:', error)
      setDepartmentData([])
    } finally {
      setLoading(false)
    }
  }

  // Pagination logic
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return departmentData.slice(startIndex, startIndex + itemsPerPage)
  }, [departmentData, currentPage, itemsPerPage])

  const totalPages = Math.ceil(departmentData.length / itemsPerPage)
  const showPagination = departmentData.length > itemsPerPage

  // Export functions
  const exportDepartmentCSV = () => {
    const headers = ['Branch', 'Department', 'SKU', 'Item', 'Pending', 'Posted', 'Delivered', 'Total Demand']
    const csvContent = [
      headers.join(','),
      ...departmentData.map(row => [
        row.branch_name,
        row.department_name,
        row.sku,
        row.item_name,
        (row.pending_demand ?? ((row.allocated_qty || 0) - (row.pending_delivery_qty || 0)) ?? 0),
        (row.confirmed_demand ?? row.pending_delivery_qty ?? 0),
        (row.delivered_qty ?? row.delivered_demand ?? 0),
        (((row.pending_demand ?? ((row.allocated_qty || 0) - (row.pending_delivery_qty || 0)) ?? 0) + (row.confirmed_demand ?? row.pending_delivery_qty ?? 0) + (row.delivered_qty ?? row.delivered_demand ?? 0)))
      ].map(field => `"${field}"`).join(','))
    ].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `department_inventory_${selectedBranch}_${selectedDepartment}_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const exportDepartmentPDF = async () => {
    try {
      // Check if there's data to export
      if (!departmentData || departmentData.length === 0) {
        alert('No data available to export. Please ensure there are items assigned to departments.')
        return
      }

      const { jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')
      
      const doc = new jsPDF()
      doc.setFontSize(16)
      doc.text('Department Inventory Report', 20, 20)
      doc.setFontSize(10)
      doc.text(`Branch: ${selectedBranch} | Department: ${selectedDepartment}`, 20, 30)
      doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 35)
      
      const tableData = departmentData.map(row => [
        row.branch_name || '',
        row.department_name || '',
        row.sku || '',
        row.item_name || '',
        (row.pending_demand ?? ((row.allocated_qty || 0) - (row.pending_delivery_qty || 0)) ?? 0),
        (row.confirmed_demand ?? row.pending_delivery_qty ?? 0),
        (row.delivered_qty ?? row.delivered_demand ?? 0),
        (((row.pending_demand ?? ((row.allocated_qty || 0) - (row.pending_delivery_qty || 0)) ?? 0) + (row.confirmed_demand ?? row.pending_delivery_qty ?? 0) + (row.delivered_qty ?? row.delivered_demand ?? 0)))
      ])
      
      autoTable(doc, {
        head: [['Branch', 'Department', 'SKU', 'Item', 'Pending', 'Posted', 'Delivered', 'Total Demand']],
        body: tableData,
        startY: 45,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [59, 130, 246] }
      })
      
      const branchName = selectedBranch.replace(/\s+/g, '_')
      const deptName = selectedDepartment.replace(/\s+/g, '_')
      doc.save(`department_inventory_${branchName}_${deptName}_${new Date().toISOString().split('T')[0]}.pdf`)
      
      // Show success message
      alert('PDF exported successfully!')
    } catch (error) {
      console.error('PDF export error:', error)
      alert('PDF export failed. Please try again.')
    }
  }

  return (
    <div className="mt-8">
      <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-gray-800">Admin — Inventory by Branch & Department</h2>
      
      {/* Filters and Controls */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-4 sm:mb-6">
        <button
          onClick={loadDepartmentInventory}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-3 sm:px-4 py-2 rounded text-sm sm:text-base transition-colors"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
        
        <select
          value={selectedBranch}
          onChange={(e) => {
            setSelectedBranch(e.target.value)
            setCurrentPage(1)
          }}
          className="border border-gray-300 rounded px-2 sm:px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="All Branches">All Branches</option>
          {branches.map(branch => (
            <option key={branch} value={branch}>{branch}</option>
          ))}
        </select>
        
        <select
          value={selectedDepartment}
          onChange={(e) => {
            setSelectedDepartment(e.target.value)
            setCurrentPage(1)
          }}
          className="border border-gray-300 rounded px-2 sm:px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="All Departments">All Departments</option>
          {departments.map(dept => (
            <option key={dept.id} value={dept.name}>{dept.name}</option>
          ))}
        </select>
        
        <button
          onClick={exportDepartmentCSV}
          disabled={departmentData.length === 0}
          className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-3 sm:px-4 py-2 rounded text-sm sm:text-base transition-colors"
        >
          Export CSV
        </button>
        
        <button
          onClick={exportDepartmentPDF}
          disabled={departmentData.length === 0}
          className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white px-3 sm:px-4 py-2 rounded text-sm sm:text-base transition-colors"
        >
          Export PDF
        </button>
      </div>
      
      {/* Data Summary */}
      {departmentData.length > 0 && (
        <div className="text-xs sm:text-sm text-gray-600 mb-3 p-2 sm:p-0">
          Showing {departmentData.length} items across departments
        </div>
      )}
      
      {/* Department Inventory Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left font-medium text-gray-900">Branch</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left font-medium text-gray-900">Department</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left font-medium text-gray-900">SKU</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left font-medium text-gray-900">Item</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-center font-medium text-gray-900">Pending</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-center font-medium text-gray-900">Posted</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-center font-medium text-gray-900">Delivered</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-center font-medium text-gray-900">Total Demand</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center text-gray-500">
                    Loading department inventory data...
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center text-gray-500">
                    No department inventory data found. Make sure to run the database migrations first.
                  </td>
                </tr>
              ) : (
                paginatedData.map((row, index) => (
                  <tr 
                    key={`${row.branch_code}-${row.department_id}-${row.sku}`}
                    className="hover:bg-gray-50"
                  >
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-gray-900">{row.branch_name}</td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-gray-900">{row.department_name}</td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-gray-900 font-mono text-xs">{row.sku}</td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-gray-900 font-medium">{row.item_name}</td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-center text-yellow-600">{row.pending_demand ?? ((row.allocated_qty || 0) - (row.pending_delivery_qty || 0)) ?? 0}</td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-center text-purple-600">{row.confirmed_demand ?? row.pending_delivery_qty ?? 0}</td>
                     <td className="px-2 sm:px-4 py-2 sm:py-3 text-center text-green-600">{row.delivered_qty ?? row.delivered_demand ?? 0}</td>
                     <td className="px-2 sm:px-4 py-2 sm:py-3 text-center text-blue-600 font-medium">{((row.pending_demand ?? ((row.allocated_qty || 0) - (row.pending_delivery_qty || 0)) ?? 0) + (row.confirmed_demand ?? row.pending_delivery_qty ?? 0) + (row.delivered_qty ?? row.delivered_demand ?? 0))}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
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
              Showing {Math.min((currentPage - 1) * itemsPerPage + 1, departmentData.length)} to {Math.min(currentPage * itemsPerPage, departmentData.length)} of {departmentData.length} items
            </div>
          </div>
        )}
      </div>
      
      <div className="text-xs sm:text-sm text-gray-600 mt-2 sm:mt-3 p-2 sm:p-0">
        Department inventory shows demand allocation by department within each branch. Run the database migrations to enable this feature.
      </div>
    </div>
  )
}

// Items Inventory Section Component
function ItemsInventorySection() {
  const [itemsData, setItemsData] = useState([])
  const [loading, setLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Load items inventory data
  const loadItemsInventory = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/inventory/items')
      const result = await response.json()
      if (result.ok) {
        setItemsData(result.data || [])
      } else {
        console.error('Failed to load items inventory:', result.error)
        setItemsData([])
      }
    } catch (error) {
      console.error('Error loading items inventory:', error)
      setItemsData([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadItemsInventory()
  }, [])

  // Pagination logic
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedData = itemsData.slice(startIndex, endIndex)
  const totalPages = Math.ceil(itemsData.length / itemsPerPage)
  const showPagination = itemsData.length > itemsPerPage

  // Export functions
  const exportItemsCSV = () => {
    const headers = ['SKU', 'Item', 'Pending', 'Posted', 'Delivered', 'Total Demand']
    const csvContent = [
      headers.join(','),
      ...itemsData.map(row => [
        row.sku,
        row.item_name,
        (row.pending_demand ?? ((row.allocated_qty || 0) - (row.pending_delivery_qty || 0)) ?? 0),
        (row.confirmed_demand ?? row.pending_delivery_qty ?? 0),
        (row.delivered_qty ?? row.delivered_demand ?? 0),
        (((row.pending_demand ?? ((row.allocated_qty || 0) - (row.pending_delivery_qty || 0)) ?? 0) + (row.confirmed_demand ?? row.pending_delivery_qty ?? 0) + (row.delivered_qty ?? row.delivered_demand ?? 0)))
      ].map(field => `"${field}"`).join(','))
    ].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `items_inventory_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const exportItemsPDF = async () => {
    try {
      // Check if there's data to export
      if (!itemsData || itemsData.length === 0) {
        alert('No data available to export. Please ensure there are items in the inventory.')
        return
      }

      const { jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')
      
      const doc = new jsPDF()
      doc.setFontSize(16)
      doc.text('Items Inventory Report', 20, 20)
      doc.setFontSize(10)
      doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 30)
      
      const tableData = itemsData.map(row => [
        row.sku || '',
        row.item_name || '',
        (row.pending_demand ?? ((row.allocated_qty || 0) - (row.pending_delivery_qty || 0)) ?? 0),
        (row.confirmed_demand ?? row.pending_delivery_qty ?? 0),
        (row.delivered_qty ?? row.delivered_demand ?? 0),
        (((row.pending_demand ?? ((row.allocated_qty || 0) - (row.pending_delivery_qty || 0)) ?? 0) + (row.confirmed_demand ?? row.pending_delivery_qty ?? 0) + (row.delivered_qty ?? row.delivered_demand ?? 0)))
      ])
      
      autoTable(doc, {
        head: [['SKU', 'Item', 'Pending', 'Posted', 'Delivered', 'Total Demand']],
        body: tableData,
        startY: 40,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [59, 130, 246] }
      })
      
      doc.save(`items_inventory_${new Date().toISOString().split('T')[0]}.pdf`)
      
      // Show success message
      alert('PDF exported successfully!')
    } catch (error) {
      console.error('PDF export error:', error)
      alert('PDF export failed. Please try again.')
    }
  }

  return (
    <div className="mt-8">
      <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-gray-800">Admin — Inventory by Items</h2>
      
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-4 sm:mb-6">
        <button
          onClick={loadItemsInventory}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-3 sm:px-4 py-2 rounded text-sm sm:text-base transition-colors"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
        
        <button
          onClick={exportItemsCSV}
          disabled={itemsData.length === 0}
          className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-3 sm:px-4 py-2 rounded text-sm sm:text-base transition-colors"
        >
          Export CSV
        </button>
        
        <button
          onClick={exportItemsPDF}
          disabled={itemsData.length === 0}
          className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white px-3 sm:px-4 py-2 rounded text-sm sm:text-base transition-colors"
        >
          Export PDF
        </button>
      </div>
      
      {/* Data Summary */}
      {itemsData.length > 0 && (
        <div className="text-xs sm:text-sm text-gray-600 mb-3 p-2 sm:p-0">
          Showing {itemsData.length} items (aggregated across all branches)
        </div>
      )}
      
      {/* Items Inventory Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left font-medium text-gray-900">SKU</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left font-medium text-gray-900">Item</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-center font-medium text-gray-900">Pending</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-center font-medium text-gray-900">Posted</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-center font-medium text-gray-900">Delivered</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-center font-medium text-gray-900">Total Demand</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                    Loading items inventory data...
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                    No items inventory data found.
                  </td>
                </tr>
              ) : (
                paginatedData.map((row, index) => (
                  <tr key={row.sku} className="hover:bg-gray-50">
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-gray-900 font-mono text-xs">{row.sku}</td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-gray-900 font-medium">{row.item_name}</td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-center text-yellow-600">
                      {row.pending_demand ?? ((row.allocated_qty || 0) - (row.pending_delivery_qty || 0)) ?? 0}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-center text-purple-600">
                      {row.confirmed_demand ?? row.pending_delivery_qty ?? 0}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-center text-green-600">
                      {row.delivered_qty ?? row.delivered_demand ?? 0}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-center text-blue-600 font-medium">
                      {( (row.pending_demand ?? ((row.allocated_qty || 0) - (row.pending_delivery_qty || 0)) ?? 0) + (row.confirmed_demand ?? row.pending_delivery_qty ?? 0) + (row.delivered_qty ?? row.delivered_demand ?? 0) )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
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
            <div className="text-sm text-gray-700">
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, itemsData.length)} of {itemsData.length} items
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function InventoryPageContent() {
  const [rows, setRows] = useState([])
  const [msg, setMsg] = useState(null)
  const [loading, setLoading] = useState(false)
  const [branchCode, setBranchCode] = useState('')
  const [sku, setSku] = useState('')
  const [qty, setQty] = useState('')
  const [note, setNote] = useState('')
  // Always use demand tracking mode
  const isDemandTrackingMode = true
  const modeLoading = false
  
  // New state for filtering and pagination
  const [selectedBranch, setSelectedBranch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)
  const [branches, setBranches] = useState([])

  // Safe JSON helper
  const safeJson = async (res, label) => {
    const ct = res.headers.get('content-type') || ''
    if (ct.includes('application/json')) return await res.json()
    const text = await res.text()
    throw new Error(`Non-JSON response from ${label} (${res.status}): ${text.slice(0, 300)}`)
  }

  const load = async () => {
    setLoading(true); setMsg(null)
    try {
      const res = await fetch('/api/admin/inventory/status', { cache: 'no-store' })
      const json = await safeJson(res, '/api/admin/inventory/status')
      if (!json.ok) throw new Error(json.error)
      setRows(json.rows || [])
    } catch (e) {
      setMsg({ type: 'error', text: e.message })
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  const loadBranches = async () => {
    try {
      const res = await fetch('/api/branches/list', { cache: 'no-store' })
      const json = await res.json()
      if (json.ok) {
        setBranches(json.branches || [])
      }
    } catch (e) {
      console.error('Error loading branches:', e)
    }
  }



  useEffect(() => {
    load()
    loadBranches()
  }, [])

  // Remove the checkDemandTrackingMode function since we're always in demand tracking mode

  const filteredAndPaginatedRows = useMemo(() => {
    let filtered = (rows || []).map(r => ({
      ...r,
      // highlight when remaining after Posted is <= 20
      low: Number(r.remaining_after_posted ?? 0) <= 20
    }))
    
    // Apply branch filter
    if (selectedBranch) {
      filtered = filtered.filter(r => r.branch_name === selectedBranch)
    }
    
    // Calculate pagination
    const totalItems = filtered.length
    const totalPages = Math.ceil(totalItems / itemsPerPage)
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    const paginatedRows = filtered.slice(startIndex, endIndex)
    
    return {
      rows: paginatedRows,
      totalItems,
      totalPages,
      currentPage
    }
  }, [rows, selectedBranch, currentPage, itemsPerPage])

  const adjust = async () => {
    setMsg(null)
    try {
      const res = await fetch('/api/admin/inventory/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchCode: branchCode.trim(),
          sku: sku.trim(),
          qty: Number(qty),
          note
        })
      })
      const json = await safeJson(res, '/api/admin/inventory/adjust')
      if (!res.ok || !json.ok) throw new Error(json.error || 'Adjustment failed')
      setMsg({ type: 'success', text: 'Adjustment posted' })
      setBranchCode(''); setSku(''); setQty(''); setNote('')
      load()
    } catch (e) {
      setMsg({ type: 'error', text: e.message })
    }
  }

  // Export functions - simplified for demand tracking only
  const exportToCSV = () => {
    const headers = ['Branch', 'SKU', 'Item', 'Pending', 'Posted', 'Delivered', 'Total Demand']
    
    let dataToExport = rows
    if (selectedBranch) {
      dataToExport = dataToExport.filter(r => r.branch_name === selectedBranch)
    }
    
    const csvContent = [
      headers.join(','),
      ...dataToExport.map(r => {
        return [
          r.branch_name || '',
          r.sku || '',
          r.item_name || '',
          (r.pending_demand ?? 0),
          (r.confirmed_demand ?? 0),
          (r.delivered_qty ?? r.delivered_demand ?? 0),
          (r.total_demand ?? ((r.pending_demand || 0) + (r.confirmed_demand || 0) + (r.delivered_qty || r.delivered_demand || 0)) ?? ((r.allocated_qty || 0) + (r.delivered_qty || r.delivered_demand || 0)) ?? 0)
        ].join(',')
      })
    ].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const branchFilter = selectedBranch ? selectedBranch.replace(/\s+/g, '_') : 'all_branches'
    a.download = `inventory_${branchFilter}_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  const exportToPDF = async () => {
    try {
      // Check if there's data to export
      if (!rows || rows.length === 0) {
        setMsg({ type: 'error', text: 'No data available to export. Please ensure there are items in the inventory.' })
        return
      }

      // Dynamic import to avoid SSR issues
      const { jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')
      
      const doc = new jsPDF('l', 'mm', 'a4') // landscape orientation
      
      let dataToExport = rows
      if (selectedBranch) {
        dataToExport = dataToExport.filter(r => r.branch_name === selectedBranch)
      }

      // Check if filtered data is empty
      if (dataToExport.length === 0) {
        setMsg({ type: 'error', text: 'No data available for the selected filters. Please adjust your filters.' })
        return
      }
      
      const headers = ['Branch', 'SKU', 'Item', 'Pending', 'Posted', 'Delivered', 'Total Demand']
      
      const tableData = dataToExport.map(r => {
        return [
          r.branch_name || '',
          r.sku || '',
          r.item_name || '',
          (r.pending_demand ?? 0),
          (r.confirmed_demand ?? 0),
          (r.delivered_qty ?? r.delivered_demand ?? 0),
          (r.total_demand ?? ((r.pending_demand || 0) + (r.confirmed_demand || 0) + (r.delivered_qty || r.delivered_demand || 0)) ?? ((r.allocated_qty || 0) + (r.delivered_qty || r.delivered_demand || 0)) ?? 0)
        ]
      })
      
      // Add title
      doc.setFontSize(16)
      doc.text('Inventory Report', 14, 15)
      
      // Add filters info
      doc.setFontSize(10)
      let filterText = 'Filters: '
      if (selectedBranch) filterText += `Branch: ${selectedBranch} `
      if (!selectedBranch) filterText += 'All branches'
      doc.text(filterText, 14, 25)
      
      // Add table
      autoTable(doc, {
        head: [headers],
        body: tableData,
        startY: 30,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [66, 139, 202] },
        columnStyles: {
          0: { cellWidth: 25 }, // Branch
          1: { cellWidth: 20 }, // SKU
          2: { cellWidth: 40 }, // Item
        },
        margin: { left: 14, right: 14 }
      })
      
      const branchFilter = selectedBranch ? selectedBranch.replace(/\s+/g, '_') : 'all_branches'
      doc.save(`inventory_${branchFilter}_${new Date().toISOString().split('T')[0]}.pdf`)
      
      // Show success message
      setMsg({ type: 'success', text: 'PDF exported successfully!' })
    } catch (error) {
      console.error('PDF export error:', error)
      setMsg({ type: 'error', text: 'PDF export failed. Please try again.' })
    }
  }

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedBranch])

  return (
    <div className="p-2 lg:p-3 xl:p-4 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 lg:mb-4">
        <h1 className="text-xl sm:text-2xl font-bold mb-2 sm:mb-0">Admin — Inventory by Branch</h1>
      </div>

      {/* Post Adjustment section removed - only demand tracking mode */}

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-4 sm:mb-6">
        <button 
          onClick={load}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-3 sm:px-4 py-2 rounded text-sm sm:text-base transition-colors"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
        
        <select 
          value={selectedBranch}
          onChange={(e) => setSelectedBranch(e.target.value)}
          className="border border-gray-300 rounded px-2 sm:px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Branches</option>
          {branches.map(branch => (
            <option key={branch.code} value={branch.name}>{branch.name}</option>
          ))}
        </select>
        
        <button 
          onClick={exportToCSV}
          disabled={rows.length === 0}
          className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-3 sm:px-4 py-2 rounded text-sm sm:text-base transition-colors"
        >
          Export CSV
        </button>
        
        <button 
          onClick={exportToPDF}
          disabled={rows.length === 0}
          className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white px-3 sm:px-4 py-2 rounded text-sm sm:text-base transition-colors"
        >
          Export PDF
        </button>
      </div>
      
      {msg && (
        <div className={`text-sm mb-4 ${msg.type === 'error' ? 'text-red-700' : 'text-green-700'}`}>
          {msg.text}
        </div>
      )}
      
      {/* Data Summary */}
      {filteredAndPaginatedRows.rows.length > 0 && (
        <div className="text-xs sm:text-sm text-gray-600 mb-3 p-2 sm:p-0">
          Showing {filteredAndPaginatedRows.rows.length} of {filteredAndPaginatedRows.totalItems} items
          {selectedBranch && ` (filtered by ${selectedBranch})`}
        </div>
      )}

      {/* Data Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left font-medium text-gray-900">Branch</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left font-medium text-gray-900">SKU</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left font-medium text-gray-900">Item</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-center font-medium text-gray-900">Pending</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-center font-medium text-gray-900">Posted</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-center font-medium text-gray-900">Delivered</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-center font-medium text-gray-900">Total Demand</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAndPaginatedRows.rows.length > 0 ? (
                filteredAndPaginatedRows.rows.map((row, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-gray-900">{row.branch_name}</td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-gray-900 font-mono text-xs">{row.sku}</td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-gray-900 font-medium">{row.item_name}</td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-center text-yellow-600">{row.pending_demand ?? 0}</td>
                     <td className="px-2 sm:px-4 py-2 sm:py-3 text-center text-purple-600">{row.confirmed_demand ?? 0}</td>
                     <td className="px-2 sm:px-4 py-2 sm:py-3 text-center text-green-600">{row.delivered_qty ?? row.delivered_demand ?? 0}</td>
                     <td className="px-2 sm:px-4 py-2 sm:py-3 text-center text-blue-600 font-medium">{row.total_demand ?? ((row.pending_demand || 0) + (row.confirmed_demand || 0) + (row.delivered_qty || row.delivered_demand || 0)) ?? ((row.allocated_qty || 0) + (row.delivered_qty || row.delivered_demand || 0)) ?? 0}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="px-4 sm:px-6 py-8 text-center text-sm text-gray-500">
                    {selectedBranch ? `No data for ${selectedBranch}` : 'No data'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {filteredAndPaginatedRows.totalPages > 1 && (
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
                Page {currentPage} of {filteredAndPaginatedRows.totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, filteredAndPaginatedRows.totalPages))}
                disabled={currentPage === filteredAndPaginatedRows.totalPages}
                className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
            <div className="text-sm text-gray-500">
              Showing {Math.min((currentPage - 1) * itemsPerPage + 1, filteredAndPaginatedRows.totalItems)} to {Math.min(currentPage * itemsPerPage, filteredAndPaginatedRows.totalItems)} of {filteredAndPaginatedRows.totalItems} items
            </div>
          </div>
        )}
      </div>
      
      <div className="text-xs sm:text-sm text-gray-600 mt-2 sm:mt-3 p-2 sm:p-0">
        Branch inventory shows demand allocation across all branches. Items are tracked by demand rather than physical stock.
      </div>

      {/* Department-Level Inventory Section */}
      <DepartmentInventorySection />
      
      {/* Items-Level Inventory Section */}
      <ItemsInventorySection />
    </div>
  )
}

export default function InventoryPage() {
  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <InventoryPageContent />
    </ProtectedRoute>
  )
}