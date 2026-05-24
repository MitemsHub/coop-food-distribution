// app/admin/import/page.jsx
'use client'

import { useState, useEffect } from 'react'
import ProtectedRoute from '../../../components/ProtectedRoute'

function ImportPageContent() {
  const [membersFile, setMembersFile] = useState(null)
  const [pricesFile, setPricesFile] = useState(null)
  const [log, setLog] = useState('')
  const [membersLoading, setMembersLoading] = useState(false)
  const [pricesLoading, setPricesLoading] = useState(false)
  const [isDemandTrackingMode, setIsDemandTrackingMode] = useState(false)
  const [loadingMode, setLoadingMode] = useState(true)

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

  const dlExcel = async (fileName, rows, sheetName) => {
    if (!rows?.length) return
    const ExcelJSMod = await import('exceljs')
    const ExcelJS = ExcelJSMod?.default ?? ExcelJSMod
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet(sheetName || 'Template')

    const headers = Object.keys(rows[0] || {})
    ws.addRow(headers)
    for (const r of rows) ws.addRow(headers.map((h) => r[h]))

    const buffer = await wb.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
  }

  const downloadMembersTemplate = () => {
    dlExcel(
      'Members_Template.xlsx',
      [
        {
          member_id: 'A12345',
          full_name: 'John Doe',
          grade: 'Director',
          savings: 2000000,
          loans: 0,
          global_limit: 40000000,
        },
      ],
      'Members'
    ).catch(() => null)
  }

  // Check if system is in demand tracking mode
  useEffect(() => {
    const checkDemandTrackingMode = async () => {
      try {
        const res = await fetch('/api/admin/system/mode')
        if (res.ok) {
          const data = await res.json()
          setIsDemandTrackingMode(data.isDemandTrackingMode || false)
        }
      } catch (error) {
        console.error('Failed to check demand tracking mode:', error)
        // Default to false if check fails
        setIsDemandTrackingMode(false)
      } finally {
        setLoadingMode(false)
      }
    }
    checkDemandTrackingMode()
  }, [])

  const downloadPricesTemplate = () => {
    const templateData = {
      sku: 'RICE50KG',
      item_name: 'Rice (50kg)',
      unit: 'bag',
      category: 'Food',
      branch_code: 'DUTSE',
      price: 49500
    }
    
    const fileName = 'Items_Prices_Template.xlsx'
    dlExcel(fileName, [templateData], 'Items_Prices').catch(() => null)
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
        <h1 className="text-base sm:text-lg md:text-xl font-semibold break-words">Admin — Food Distribution — Import</h1>
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-4 mb-4">
        <div className="text-sm font-semibold mb-1">Members Import</div>
        <div className="text-xs sm:text-sm text-gray-600 mb-3">Expected columns: member_id, full_name, grade, savings, loans, global_limit</div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => setMembersFile(e.target.files?.[0] || null)}
            className="w-full sm:flex-1 sm:min-w-0 text-[11px] sm:text-sm p-2 border border-gray-200 rounded-lg"
          />
          <button
            type="button"
            className="px-3 py-2 rounded-lg bg-gray-900 hover:bg-gray-950 text-white text-xs sm:text-sm font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2 whitespace-nowrap min-w-[140px]"
            onClick={() => upload('members')}
            disabled={membersLoading || pricesLoading}
          >
            {membersLoading && <Spinner />}
            <span>{membersLoading ? 'Uploading…' : 'Upload Members'}</span>
          </button>
          <button
            type="button"
            className="px-3 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-xs sm:text-sm font-semibold text-gray-700 disabled:opacity-50 inline-flex items-center justify-center whitespace-nowrap min-w-[170px]"
            onClick={downloadMembersTemplate}
            disabled={membersLoading || pricesLoading}
          >
            Download Excel Template
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-4 mb-4">
        <div className="text-sm font-semibold mb-1">Items / Prices Import</div>
        <div className="text-xs sm:text-sm text-gray-600 mb-3">
          {loadingMode ? <div className="h-4 w-64 bg-gray-100 rounded animate-pulse" /> : 'Expected columns: sku, item_name, unit, category, branch_code, price'}
        </div>
        {isDemandTrackingMode && (
          <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs sm:text-sm text-blue-800">
            Demand Tracking Mode: Initial stock column is not needed as items have unlimited availability based on member demand.
          </div>
        )}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => setPricesFile(e.target.files?.[0] || null)}
            className="w-full sm:flex-1 sm:min-w-0 text-[11px] sm:text-sm p-2 border border-gray-200 rounded-lg"
          />
          <button
            type="button"
            className="px-3 py-2 rounded-lg bg-gray-900 hover:bg-gray-950 text-white text-xs sm:text-sm font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2 whitespace-nowrap min-w-[180px]"
            onClick={() => upload('prices')}
            disabled={membersLoading || pricesLoading || loadingMode}
          >
            {pricesLoading && <Spinner />}
            <span>{pricesLoading ? 'Uploading…' : isDemandTrackingMode ? 'Upload Items/Prices' : 'Upload Items/Prices/Stock'}</span>
          </button>
          <button
            type="button"
            className="px-3 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-xs sm:text-sm font-semibold text-gray-700 disabled:opacity-50 inline-flex items-center justify-center whitespace-nowrap min-w-[170px]"
            onClick={downloadPricesTemplate}
            disabled={loadingMode || membersLoading || pricesLoading}
          >
            Download Excel Template
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/60">
          <div className="text-sm font-semibold">Import Logs</div>
        </div>
        <div className="p-4 whitespace-pre-wrap text-xs sm:text-sm overflow-x-auto bg-white">
          {log || 'Logs will appear here.'}
        </div>
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
