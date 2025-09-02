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
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Admin — Inventory</h1>

      </div>

      <div className="mb-4 p-3 border rounded">
        <div className="text-sm font-medium mb-2">Post Adjustment</div>
        <div className="flex flex-wrap gap-2 items-end">
          <input
            className="border rounded px-3 py-2"
            placeholder="Branch code (e.g. DUTSE)"
            value={branchCode}
            onChange={e => setBranchCode(e.target.value)}
          />
          <input
            className="border rounded px-3 py-2"
            placeholder="SKU (e.g. RICE50KG)"
            value={sku}
            onChange={e => setSku(e.target.value)}
          />
          <input
            className="border rounded px-3 py-2"
            placeholder="Qty (+ add, - remove)"
            value={qty}
            onChange={e => setQty(e.target.value)}
          />
          <input
            className="border rounded px-3 py-2"
            placeholder="Note (optional)"
            value={note}
            onChange={e => setNote(e.target.value)}
          />
          <button className="px-3 py-2 bg-blue-600 text-white rounded" onClick={adjust}>
            Adjust
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <button className="px-3 py-2 bg-blue-600 text-white rounded" onClick={load}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
        {msg && (
          <div className={`text-sm ${msg.type === 'error' ? 'text-red-700' : 'text-green-700'}`}>
            {msg.text}
          </div>
        )}
      </div>

      <table className="w-full text-sm border">
        <thead className="bg-gray-50">
          <tr>
            <th className="p-2 border text-left">Branch</th>
            <th className="p-2 border text-left">SKU</th>
            <th className="p-2 border text-left">Item</th>
            <th className="p-2 border text-right">Initial</th>
            <th className="p-2 border text-right">Distributed</th>
            <th className="p-2 border text-right">Given Out</th>
            <th className="p-2 border text-right">Pending Delivery</th>
            <th className="p-2 border text-right">Remain (Posted)</th>
            <th className="p-2 border text-right">Remain (Delivered)</th>
          </tr>
        </thead>
        <tbody>
          {lowRows.map((r) => {
            // stable key: branch_code + sku (avoid index in key)
            const key = `${String(r.branch_code || '')}::${String(r.sku || '')}`
            return (
              <tr key={key} className={r.low ? 'bg-red-50' : ''}>
                <td className="p-2 border">{r.branch_name}</td>
                <td className="p-2 border">{r.sku}</td>
                <td className="p-2 border">{r.item_name}</td>
                <td className="p-2 border text-right">{r.initial_stock}</td>
                <td className="p-2 border text-right">{r.allocated_qty}</td>
                <td className="p-2 border text-right">{r.delivered_qty}</td>
                <td className="p-2 border text-right">{r.pending_delivery_qty}</td>
                <td className="p-2 border text-right">{r.remaining_after_posted}</td>
                <td className="p-2 border text-right">{r.remaining_after_delivered}</td>
              </tr>
            )
          })}
          {lowRows.length === 0 && (
            <tr>
              <td className="p-2 border" colSpan={9}>No data</td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="text-xs text-gray-600 mt-2">
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