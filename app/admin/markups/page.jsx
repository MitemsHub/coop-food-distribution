"use client"
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'

export default function AdminMarkupsPage() {
  const [branches, setBranches] = useState([])
  const [selectedBranchCode, setSelectedBranchCode] = useState('')
  const [loadingBranches, setLoadingBranches] = useState(true)

  const [sku, setSku] = useState('')
  const [amount, setAmount] = useState(500)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)

  const [markups, setMarkups] = useState([])
  const [loadingMarkups, setLoadingMarkups] = useState(false)
  const [message, setMessage] = useState('')

  // Table enhancements: filters and pagination
  const [searchTerm, setSearchTerm] = useState('')
  const [activeFilter, setActiveFilter] = useState('all') // 'all' | 'active' | 'inactive'
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)

  // Bulk upload states
  const [uploadFile, setUploadFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadLog, setUploadLog] = useState('')

  useEffect(() => {
    async function loadBranches() {
      try {
        setLoadingBranches(true)
        const { data, error } = await supabase
          .from('branches')
          .select('code, name')
          .order('name', { ascending: true })
        if (error) throw error
        setBranches(data || [])
        if (data && data.length > 0) {
          setSelectedBranchCode(data[0].code)
        }
      } catch (err) {
        setMessage(`Failed to load branches: ${err.message}`)
      } finally {
        setLoadingBranches(false)
      }
    }
    loadBranches()
  }, [supabase])

  useEffect(() => {
    if (!selectedBranchCode) return
    async function loadMarkups() {
      try {
        setLoadingMarkups(true)
        setMessage('')
        const res = await fetch(`/api/admin/markups?branch_code=${encodeURIComponent(selectedBranchCode)}`)
        const json = await res.json()
        if (!json.ok) throw new Error(json.error || 'Failed to fetch markups')
        setMarkups(json.markups || [])
      } catch (err) {
        setMessage(`Failed to load markups: ${err.message}`)
      } finally {
        setLoadingMarkups(false)
      }
    }
    loadMarkups()
  }, [selectedBranchCode])

  async function upsertMarkup(e) {
    e.preventDefault()
    try {
      setSaving(true)
      setMessage('')
      const res = await fetch('/api/admin/markups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch_code: selectedBranchCode, sku: sku.trim(), amount: Number(amount) })
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || 'Failed to save markup')
      setMessage(json.message || 'Markup saved')
      // Refresh list
      const listRes = await fetch(`/api/admin/markups?branch_code=${encodeURIComponent(selectedBranchCode)}`)
      const listJson = await listRes.json()
      setMarkups(listJson.markups || [])
    } catch (err) {
      setMessage(`Save failed: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  async function removeMarkup(itemSku) {
    try {
      setRemoving(true)
      setMessage('')
      const res = await fetch('/api/admin/markups', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch_code: selectedBranchCode, sku: itemSku })
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || 'Failed to remove markup')
      setMessage(json.message || 'Markup removed')
      setMarkups(prev => prev.filter(m => (m.items?.sku || '') !== itemSku))
    } catch (err) {
      setMessage(`Remove failed: ${err.message}`)
    } finally {
      setRemoving(false)
    }
  }

  // Derived filtered and paginated markups
  const filteredMarkups = markups.filter(m => {
    const matchesSearch = (searchTerm || '').trim() === ''
      || (m.items?.sku || '').toLowerCase().includes(searchTerm.toLowerCase())
      || (m.items?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
      || (m.items?.category || '').toLowerCase().includes(searchTerm.toLowerCase())
    const matchesActive = activeFilter === 'all'
      ? true
      : activeFilter === 'active' ? !!m.active : !m.active
    return matchesSearch && matchesActive
  })

  const totalPages = Math.max(1, Math.ceil(filteredMarkups.length / itemsPerPage))
  const startIdx = (currentPage - 1) * itemsPerPage
  const paginatedMarkups = filteredMarkups.slice(startIdx, startIdx + itemsPerPage)

  useEffect(() => {
    // Reset to first page when filters change
    setCurrentPage(1)
  }, [searchTerm, activeFilter, selectedBranchCode])

  // Export CSV for filtered markups
  const exportMarkupsCSV = () => {
    const headers = ['Branch', 'SKU', 'Item', 'Category', 'Unit', 'Markup', 'Active']
    const csvContent = [
      headers.join(','),
      ...filteredMarkups.map(m => {
        const row = [
          selectedBranchCode,
          m.items?.sku || '',
          m.items?.name || '',
          m.items?.category || '',
          m.items?.unit || '',
          Number(m.amount || 0),
          m.active ? 'TRUE' : 'FALSE',
        ]
        return row.map(v => String(v).replace(/"/g, '""')).map(v => `"${v}"`).join(',')
      })
    ].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `markups_${selectedBranchCode || 'branch'}_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  // Export PDF for filtered markups (uses jspdf + autotable)
  const exportMarkupsPDF = async () => {
    try {
      if (!filteredMarkups.length) {
        alert('No data available for the selected filters.')
        return
      }
      const { jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')
      const doc = new jsPDF('l', 'mm', 'a4')
      doc.setFontSize(16)
      doc.text('Branch Item Markups', 14, 15)
      doc.setFontSize(10)
      let filterText = `Branch: ${selectedBranchCode || 'N/A'}`
      if (searchTerm) filterText += ` | Search: ${searchTerm}`
      if (activeFilter !== 'all') filterText += ` | Active: ${activeFilter}`
      doc.text(filterText, 14, 22)

      const headers = ['SKU', 'Item', 'Category', 'Unit', 'Markup (₦)', 'Active']
      const body = filteredMarkups.map(m => [
        m.items?.sku || '',
        m.items?.name || '',
        m.items?.category || '',
        m.items?.unit || '',
        Number(m.amount || 0),
        m.active ? 'Yes' : 'No',
      ])

      autoTable(doc, {
        head: [headers],
        body,
        startY: 30,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [59, 130, 246] },
        margin: { left: 14, right: 14 },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 40 },
        }
      })

      doc.save(`markups_${selectedBranchCode || 'branch'}_${new Date().toISOString().split('T')[0]}.pdf`)
    } catch (error) {
      console.error('PDF export error:', error)
      alert('PDF export failed. Please try again.')
    }
  }

  const dlCSV = (name, rows) => {
    const headers = Object.keys(rows[0])
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => `"${String(r[h] ?? '').replace(/"/g,'""')}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url)
  }

  const downloadMarkupsTemplate = () => {
    dlCSV('Markups_Template.csv', [{
      branch_code: 'DUTSE',
      sku: 'RICE50KG',
      amount: 500,
      active: 'TRUE'
    }])
  }

  const uploadMarkups = async () => {
    try {
      setUploading(true)
      setUploadLog('')
      if (!uploadFile) {
        setUploadLog('Please choose a file first.')
        return
      }
      const fd = new FormData()
      fd.append('file', uploadFile)
      const res = await fetch('/api/admin/import/markups', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || `Upload failed with status ${res.status}`)
      setUploadLog(JSON.stringify(json, null, 2))
      // Refresh current branch markups
      const listRes = await fetch(`/api/admin/markups?branch_code=${encodeURIComponent(selectedBranchCode)}`)
      const listJson = await listRes.json()
      if (listJson.ok) setMarkups(listJson.markups || [])
    } catch (e) {
      setUploadLog(`Error: ${e.message}`)
      console.error('Markups upload error:', e)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Admin: Branch Item Markups</h1>
      <p className="text-sm text-gray-600 mb-6">Set fixed markups (e.g., ₦500) per item per branch. Prices in the Shop and Checkout will include these markups.</p>

      {message && (
        <div className="mb-4 p-3 rounded border border-gray-300 bg-gray-50">{message}</div>
      )}

      <div className="mb-6">
        <label className="block text-sm font-medium mb-1">Branch</label>
        <select
          value={selectedBranchCode}
          onChange={e => setSelectedBranchCode(e.target.value)}
          className="border rounded px-3 py-2 w-64"
          disabled={loadingBranches}
        >
          {branches.map(b => (
            <option key={b.code} value={b.code}>{b.name} ({b.code})</option>
          ))}
        </select>
      </div>

      <form onSubmit={upsertMarkup} className="mb-8">
        <div className="flex gap-4 items-end flex-wrap">
          <div>
            <label className="block text-sm font-medium mb-1">SKU</label>
            <input
              type="text"
              value={sku}
              onChange={e => setSku(e.target.value)}
              placeholder="e.g., RICE-25KG"
              className="border rounded px-3 py-2 w-64"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Markup Amount (₦)</label>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              min={0}
              step={1}
              className="border rounded px-3 py-2 w-40"
              required
            />
          </div>
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-60"
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save Markup'}
          </button>
        </div>
      </form>

      {/* Bulk Upload Section */}
      <div className="mb-8 border rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-2">Bulk Upload Markups (.xlsx/.csv)</h2>
        <p className="text-sm text-gray-600 mb-3">Expected columns: branch_code, sku, amount, active</p>
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={e => setUploadFile(e.target.files?.[0] || null)}
            className="border rounded px-3 py-2 w-full sm:w-auto"
          />
          <div className="flex gap-2">
            <button
              onClick={downloadMarkupsTemplate}
              type="button"
              className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-2 rounded"
            >
              Download Template
            </button>
            <button
              onClick={uploadMarkups}
              type="button"
              className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded disabled:opacity-60"
              disabled={uploading}
            >
              {uploading ? 'Uploading…' : 'Upload Markups'}
            </button>
          </div>
        </div>
        {uploadLog && (
          <pre className="mt-3 text-xs bg-gray-50 border rounded p-2 overflow-auto max-h-48">{uploadLog}</pre>
        )}
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-3">Current Markups</h2>
        {/* Filters and Actions */}
        <div className="mb-3 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search by SKU, item, category"
            className="border rounded px-3 py-2 w-full sm:w-64"
          />
          <select
            value={activeFilter}
            onChange={e => setActiveFilter(e.target.value)}
            className="border rounded px-3 py-2 w-full sm:w-44"
          >
            <option value="all">All statuses</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
          </select>
          <div className="flex gap-2 ml-auto">
            <button
              type="button"
              onClick={exportMarkupsCSV}
              className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-2 rounded"
            >Export CSV</button>
            <button
              type="button"
              onClick={exportMarkupsPDF}
              className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-2 rounded"
            >Export PDF</button>
          </div>
        </div>
        {loadingMarkups ? (
          <div>Loading markups…</div>
        ) : filteredMarkups.length === 0 ? (
          <div className="text-gray-600">No markups configured for this branch.</div>
        ) : (
          <table className="w-full border border-gray-200">
            <thead>
              <tr className="bg-gray-100">
                <th className="text-left p-2 border-b">SKU</th>
                <th className="text-left p-2 border-b">Item</th>
                <th className="text-left p-2 border-b">Category</th>
                <th className="text-left p-2 border-b">Unit</th>
                <th className="text-left p-2 border-b">Markup (₦)</th>
                <th className="text-left p-2 border-b">Active</th>
                <th className="text-left p-2 border-b">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedMarkups.map(m => (
                <tr key={`${m.item_id}`} className="odd:bg-white even:bg-gray-50">
                  <td className="p-2 border-b">{m.items?.sku || '—'}</td>
                  <td className="p-2 border-b">{m.items?.name || '—'}</td>
                  <td className="p-2 border-b">{m.items?.category || '—'}</td>
                  <td className="p-2 border-b">{m.items?.unit || '—'}</td>
                  <td className="p-2 border-b">{Number(m.amount || 0)}</td>
                  <td className="p-2 border-b">{m.active ? 'Yes' : 'No'}</td>
                  <td className="p-2 border-b">
                    <button
                      className="text-red-600 hover:underline disabled:opacity-60"
                      onClick={() => removeMarkup(m.items?.sku || '')}
                      disabled={removing}
                    >Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination Controls */}
        <div className="mt-3 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Showing {filteredMarkups.length === 0 ? 0 : startIdx + 1}–{Math.min(startIdx + itemsPerPage, filteredMarkups.length)} of {filteredMarkups.length}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="px-3 py-1 border rounded disabled:opacity-50"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >Prev</button>
            <span className="px-2 py-1 text-sm">Page {currentPage} of {totalPages}</span>
            <button
              type="button"
              className="px-3 py-1 border rounded disabled:opacity-50"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
            >Next</button>
          </div>
        </div>
      </div>
    </div>
  )
}