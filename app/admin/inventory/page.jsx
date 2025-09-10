// app/admin/inventory/page.jsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import ProtectedRoute from '../../components/ProtectedRoute'

function InventoryPageContent() {
  const [rows, setRows] = useState([])
  const [msg, setMsg] = useState(null)
  const [loading, setLoading] = useState(false)
  const [branchCode, setBranchCode] = useState('')
  const [sku, setSku] = useState('')
  const [qty, setQty] = useState('')
  const [note, setNote] = useState('')

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

  useEffect(() => { load() }, [])

  const lowRows = useMemo(() => {
    return (rows || []).map(r => ({
      ...r,
      // highlight when remaining after Posted is <= 20
      low: Number(r.remaining_after_posted ?? 0) <= 20
    }))
  }, [rows])

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

  return (
    <div className="p-2 lg:p-3 xl:p-4 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 lg:mb-4">
        <h1 className="text-xl sm:text-3xl font-semibold mb-2 sm:mb-0">Admin — Inventory</h1>
      </div>

      <div className="mb-3 lg:mb-4 p-2 lg:p-3 xl:p-4 border rounded-lg">
        <div className="text-base sm:text-lg font-medium mb-3">Post Adjustment</div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <input
            className="border rounded px-2 py-2 text-xs sm:text-base"
            placeholder="Branch code (e.g. DUTSE)"
            value={branchCode}
            onChange={e => setBranchCode(e.target.value)}
          />
          <input
            className="border rounded px-2 py-2 text-xs sm:text-base"
            placeholder="SKU (e.g. RICE50KG)"
            value={sku}
            onChange={e => setSku(e.target.value)}
          />
          <input
            className="border rounded px-2 py-2 text-xs sm:text-base"
            placeholder="Qty (+ add, - remove)"
            value={qty}
            onChange={e => setQty(e.target.value)}
          />
          <input
            className="border rounded px-2 py-2 text-xs sm:text-base"
            placeholder="Note (optional)"
            value={note}
            onChange={e => setNote(e.target.value)}
          />
        </div>
        <div className="mt-3">
          <button className="px-4 py-2 bg-blue-600 text-white text-sm sm:text-base rounded hover:bg-blue-700 w-full sm:w-auto" onClick={adjust}>
            Adjust
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4 sm:mb-6">
        <button className="px-3 py-2 bg-blue-600 text-white text-sm sm:text-base rounded hover:bg-blue-700 w-full sm:w-auto" onClick={load}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
        {msg && (
          <div className={`text-sm ${msg.type === 'error' ? 'text-red-700' : 'text-green-700'}`}>
            {msg.text}
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs sm:text-sm border min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-1 sm:p-2 border text-left text-xs sm:text-sm font-medium whitespace-nowrap">Branch</th>
              <th className="p-1 sm:p-2 border text-left text-xs sm:text-sm font-medium whitespace-nowrap">SKU</th>
              <th className="p-1 sm:p-2 border text-left text-xs sm:text-sm font-medium whitespace-nowrap">Item</th>
              <th className="p-1 sm:p-2 border text-right text-xs sm:text-sm font-medium whitespace-nowrap">Initial</th>
              <th className="p-1 sm:p-2 border text-right text-xs sm:text-sm font-medium whitespace-nowrap">Distributed</th>
              <th className="p-1 sm:p-2 border text-right text-xs sm:text-sm font-medium whitespace-nowrap">Given Out</th>
              <th className="p-1 sm:p-2 border text-right text-xs sm:text-sm font-medium whitespace-nowrap">Pending Delivery</th>
              <th className="p-1 sm:p-2 border text-right text-xs sm:text-sm font-medium whitespace-nowrap">Remain (Posted)</th>
              <th className="p-1 sm:p-2 border text-right text-xs sm:text-sm font-medium whitespace-nowrap">Remain (Delivered)</th>
            </tr>
          </thead>
          <tbody>
            {lowRows.map((r) => {
              // stable key: branch_code + sku (avoid index in key)
              const key = `${String(r.branch_code || '')}::${String(r.sku || '')}`
              return (
                <tr key={key} className={`hover:bg-gray-50 ${r.low ? 'bg-red-50' : ''}`}>
                  <td className="p-1 sm:p-2 border text-xs sm:text-sm whitespace-nowrap">{r.branch_name}</td>
                  <td className="p-1 sm:p-2 border text-xs sm:text-sm whitespace-nowrap">{r.sku}</td>
                  <td className="p-1 sm:p-2 border text-xs sm:text-sm">{r.item_name}</td>
                  <td className="p-1 sm:p-2 border text-right text-xs sm:text-sm whitespace-nowrap">{r.initial_stock}</td>
                  <td className="p-1 sm:p-2 border text-right text-xs sm:text-sm whitespace-nowrap">{r.allocated_qty}</td>
                  <td className="p-1 sm:p-2 border text-right text-xs sm:text-sm whitespace-nowrap">{r.delivered_qty}</td>
                  <td className="p-1 sm:p-2 border text-right text-xs sm:text-sm whitespace-nowrap">{r.pending_delivery_qty}</td>
                  <td className="p-1 sm:p-2 border text-right text-xs sm:text-sm whitespace-nowrap">{r.remaining_after_posted}</td>
                  <td className="p-1 sm:p-2 border text-right text-xs sm:text-sm whitespace-nowrap">{r.remaining_after_delivered}</td>
                </tr>
              )
            })}
            {lowRows.length === 0 && (
              <tr>
                <td className="p-1 sm:p-2 border text-xs sm:text-sm text-center" colSpan={9}>No data</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="text-xs sm:text-sm text-gray-600 mt-2 sm:mt-3 p-2 sm:p-0">
        Rows highlighted in red are low stock (≤ 20 remaining after Posted). Adjust as needed.
      </div>
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