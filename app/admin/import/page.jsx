// app/admin/import/page.jsx
'use client'

import { useState } from 'react'
import ProtectedRoute from '../../components/ProtectedRoute'

function ImportPageContent() {
  const [membersFile, setMembersFile] = useState(null)
  const [pricesFile, setPricesFile] = useState(null)
  const [log, setLog] = useState('')
  const [membersLoading, setMembersLoading] = useState(false)
  const [pricesLoading, setPricesLoading] = useState(false)

  const upload = async (which) => {
    const setLoadingState = which === 'members' ? setMembersLoading : setPricesLoading
    try {
      setLoadingState(true)
      setLog('')
      const fd = new FormData()
      const file = which === 'members' ? membersFile : pricesFile
      if (!file) {
        setLog('Please choose a file first.')
        return
      }
      fd.append('file', file)
      const res = await fetch(`/api/admin/import/${which}`, { 
        method: 'POST', 
        body: fd 
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        throw new Error(json.error || `Upload failed with status ${res.status}`)
      }
      setLog(JSON.stringify(json, null, 2))
    } catch (e) {
      setLog(`Error: ${e.message}`)
      console.error('Upload error:', e)
    } finally {
      setLoadingState(false)
    }
  }

  const dlCSV = (name, rows) => {
    const headers = Object.keys(rows[0])
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => `"${String(r[h] ?? '').replace(/"/g,'""')}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url)
  }

  const downloadMembersTemplate = () => {
    dlCSV('Members_Template.csv', [{
      member_id: 'A12345',
      full_name: 'John Doe',
      branch_code: 'DUTSE',
      department_name: 'Branch Operations Department',
      category: 'A',
      grade: 'Director',
      savings: 2000000,
      loans: 0,
      global_limit: 40000000,
      phone: '08030000000',
      email: 'john@example.com'
    }])
  }

  const downloadPricesTemplate = () => {
    dlCSV('Items_Prices_Stock_Template.csv', [{
      sku: 'RICE50KG',
      item_name: 'Rice (50kg)',
      unit: 'bag',
      category: 'Food',
      branch_code: 'DUTSE',
      price: 49500,
      initial_stock: 200
    }])
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
        <h1 className="text-base sm:text-lg md:text-xl font-semibold text-center sm:text-left break-words">Admin — Import Data</h1>
      </div>

      <div className="mb-4 sm:mb-6 border rounded-lg p-3 sm:p-4">
        <h2 className="text-sm sm:text-base md:text-lg font-medium mb-2 sm:mb-3">Members.xlsx</h2>
        <p className="text-xs sm:text-sm text-gray-600 mb-3">
          Expected columns: member_id, full_name, branch_code, department_name, category, grade, savings, loans, global_limit, phone, email
        </p>
        <div className="space-y-2 sm:space-y-3">
          <input 
            type="file" 
            accept=".xlsx,.xls,.csv" 
            onChange={e => setMembersFile(e.target.files?.[0] || null)} 
            className="w-full text-xs sm:text-sm p-2 border rounded"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button 
              className="px-3 py-2 bg-blue-600 text-white rounded text-xs sm:text-sm font-medium hover:bg-blue-700 transition-colors" 
              onClick={() => upload('members')} 
              disabled={membersLoading || pricesLoading}
            >
              {membersLoading ? 'Uploading…' : 'Upload Members'}
            </button>
            <button 
              className="px-3 py-2 border border-gray-300 rounded text-xs sm:text-sm font-medium hover:bg-gray-50 transition-colors" 
              onClick={downloadMembersTemplate}
            >
              Download Template
            </button>
          </div>
        </div>
      </div>

      <div className="mb-4 sm:mb-6 border rounded-lg p-3 sm:p-4">
        <h2 className="text-sm sm:text-base md:text-lg font-medium mb-2 sm:mb-3">Items_Prices_Stock.xlsx</h2>
        <p className="text-xs sm:text-sm text-gray-600 mb-3">
          Expected columns: sku, item_name, unit, category, branch_code, price, initial_stock
        </p>
        <div className="space-y-2 sm:space-y-3">
          <input 
            type="file" 
            accept=".xlsx,.xls,.csv" 
            onChange={e => setPricesFile(e.target.files?.[0] || null)} 
            className="w-full text-xs sm:text-sm p-2 border rounded"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button 
              className="px-3 py-2 bg-emerald-600 text-white rounded text-xs sm:text-sm font-medium hover:bg-emerald-700 transition-colors" 
              onClick={() => upload('prices')} 
              disabled={membersLoading || pricesLoading}
            >
              {pricesLoading ? 'Uploading…' : 'Upload Items/Prices/Stock'}
            </button>
            <button 
              className="px-3 py-2 border border-gray-300 rounded text-xs sm:text-sm font-medium hover:bg-gray-50 transition-colors" 
              onClick={downloadPricesTemplate}
            >
              Download Template
            </button>
          </div>
        </div>
      </div>

      <div className="border rounded-lg p-3 sm:p-4 whitespace-pre-wrap bg-gray-50 text-xs sm:text-sm overflow-x-auto">
        {log || 'Logs will appear here.'}
      </div>
    </div>
  )
}

export default function ImportPage() {
  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <ImportPageContent />
    </ProtectedRoute>
  )
}