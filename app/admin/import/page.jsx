// app/admin/import/page.jsx
'use client'

import { useState } from 'react'

export default function ImportPage() {
  const [membersFile, setMembersFile] = useState(null)
  const [pricesFile, setPricesFile] = useState(null)
  const [log, setLog] = useState('')
  const [loading, setLoading] = useState(false)

  const upload = async (which) => {
    try {
      setLoading(true); setLog('')
      const fd = new FormData()
      const file = which === 'members' ? membersFile : pricesFile
      if (!file) return setLog('Please choose a file first.')
      fd.append('file', file)
      const res = await fetch(`/api/admin/import/${which}`, { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || 'Upload failed')
      setLog(JSON.stringify(json, null, 2))
    } catch (e) {
      setLog(`Error: ${e.message}`)
    } finally {
      setLoading(false)
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
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Admin — Import Data</h1>

      <div className="mb-6 border rounded p-4">
        <h2 className="text-lg font-medium mb-2">Members.xlsx</h2>
        <p className="text-sm text-gray-600 mb-3">
          Expected columns: member_id, full_name, branch_code, department_name, category, grade, savings, loans, global_limit, phone, email
        </p>
        <div className="flex items-center gap-2 mb-2">
          <input type="file" accept=".xlsx,.xls,.csv" onChange={e => setMembersFile(e.target.files?.[0] || null)} />
          <button className="px-3 py-2 bg-blue-600 text-white rounded" onClick={() => upload('members')} disabled={loading}>
            {loading ? 'Uploading…' : 'Upload Members'}
          </button>
          <button className="px-3 py-2 border rounded" onClick={downloadMembersTemplate}>Download Template</button>
        </div>
      </div>

      <div className="mb-6 border rounded p-4">
        <h2 className="text-lg font-medium mb-2">Items_Prices_Stock.xlsx</h2>
        <p className="text-sm text-gray-600 mb-3">
          Expected columns: sku, item_name, unit, category, branch_code, price, initial_stock
        </p>
        <div className="flex items-center gap-2 mb-2">
          <input type="file" accept=".xlsx,.xls,.csv" onChange={e => setPricesFile(e.target.files?.[0] || null)} />
          <button className="px-3 py-2 bg-emerald-600 text-white rounded" onClick={() => upload('prices')} disabled={loading}>
            {loading ? 'Uploading…' : 'Upload Items/Prices/Stock'}
          </button>
          <button className="px-3 py-2 border rounded" onClick={downloadPricesTemplate}>Download Template</button>
        </div>
      </div>

      <div className="border rounded p-3 whitespace-pre-wrap bg-gray-50 text-sm">
        {log || 'Logs will appear here.'}
      </div>
    </div>
  )
}