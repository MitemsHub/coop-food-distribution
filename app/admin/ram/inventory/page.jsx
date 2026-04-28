'use client'

import { useEffect, useMemo, useState } from 'react'
import ProtectedRoute from '../../../components/ProtectedRoute'

function safeJsonFactory() {
  return async (res, label) => {
    const ct = res.headers.get('content-type') || ''
    if (ct.includes('application/json')) return await res.json()
    const text = await res.text()
    throw new Error(`Non-JSON response from ${label} (${res.status}): ${text.slice(0, 300)}`)
  }
}

function money(n) {
  return `₦${Number(n || 0).toLocaleString()}`
}

function RamInventoryContent() {
  const [summary, setSummary] = useState(null)
  const [msg, setMsg] = useState(null)
  const [loading, setLoading] = useState(false)
  const safeJson = useMemo(() => safeJsonFactory(), [])

  const fetchSummary = async () => {
    setLoading(true)
    setMsg(null)
    try {
      const res = await fetch('/api/admin/ram/summary', { cache: 'no-store' })
      const json = await safeJson(res, '/api/admin/ram/summary')
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Failed to load')
      setSummary(json)
    } catch (e) {
      setSummary(null)
      setMsg({ type: 'error', text: e?.message || 'Failed to load' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSummary()
  }, [])

  const byLocation = summary?.byLocation || []
  const totals = summary?.totals || { orders: 0, qty: 0, amount: 0, loan_interest: 0 }
  const totalPrincipalAmount = Math.max(0, Number(totals.amount || 0) - Number(totals.loan_interest || 0))

  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h1 className="text-base sm:text-lg md:text-xl font-semibold break-words">Admin — Ram Sales — Inventory</h1>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm" onClick={fetchSummary}>
          Refresh
        </button>
      </div>

      {!!msg && (
        <div
          className={`mb-4 rounded-lg border p-3 text-sm ${
            msg.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'
          }`}
        >
          {msg.text}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="bg-white border rounded-lg p-3">
          <div className="text-xs text-gray-500">Total Orders</div>
          <div className="text-lg font-semibold">{totals.orders || 0}</div>
        </div>
        <div className="bg-white border rounded-lg p-3">
          <div className="text-xs text-gray-500">Total Rams</div>
          <div className="text-lg font-semibold">{totals.qty || 0}</div>
        </div>
        <div className="bg-white border rounded-lg p-3">
          <div className="text-xs text-gray-500">Principal Amount</div>
          <div className="text-lg font-semibold">{money(totalPrincipalAmount)}</div>
        </div>
        <div className="bg-white border rounded-lg p-3">
          <div className="text-xs text-gray-500">Interest</div>
          <div className="text-lg font-semibold">{money(totals.loan_interest || 0)}</div>
        </div>
      </div>

      <div className="overflow-x-auto border rounded bg-white">
        <table className="w-full text-xs">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 border text-left">Delivery Location</th>
              <th className="p-2 border text-right">Orders</th>
              <th className="p-2 border text-right">Pending</th>
              <th className="p-2 border text-right">Approved</th>
              <th className="p-2 border text-right">Rams</th>
              <th className="p-2 border text-right">Principal</th>
              <th className="p-2 border text-right">Interest</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className="p-3 text-gray-600" colSpan={7}>
                  Loading...
                </td>
              </tr>
            )}
            {!loading && byLocation.length === 0 && (
              <tr>
                <td className="p-3 text-gray-600" colSpan={7}>
                  No data.
                </td>
              </tr>
            )}
            {byLocation.map((r) => (
              <tr key={r.key} className="hover:bg-gray-50">
                <td className="p-2 border">{r.key}</td>
                <td className="p-2 border text-right">{r.orders}</td>
                <td className="p-2 border text-right">{Number(r.pending_orders || 0)}</td>
                <td className="p-2 border text-right">{Number(r.approved_orders || 0)}</td>
                <td className="p-2 border text-right">{r.qty}</td>
                <td className="p-2 border text-right">{money(Math.max(0, Number(r.amount || 0) - Number(r.loan_interest || 0)))}</td>
                <td className="p-2 border text-right">{money(r.loan_interest)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function RamInventoryPage() {
  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <RamInventoryContent />
    </ProtectedRoute>
  )
}
