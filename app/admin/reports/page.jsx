// app/admin/reports/page.jsx
'use client'

import { useEffect, useState } from 'react'
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

  // Load summary data (THIS was missing)
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

  if (loading) return <div className="p-6">Loading…</div>
  if (err) return (
    <div className="p-6">
      <div className="text-red-700 mb-3">Error: {err}</div>
      <button className="px-3 py-2 bg-blue-600 text-white rounded" onClick={loadSummary}>Retry</button>
    </div>
  )
  if (!data) return <div className="p-6">No data</div>

  const { totals, byBranch, byBranchDept, byCategory, inventory } = data

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Admin — Reports</h1>
        <div className="flex gap-2">
          <button className="px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700" onClick={loadSummary}>Refresh</button>
        </div>
      </div>

      {/* Totals */}
      <section className="mb-6 grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card title="Total (Posted)" value={totals?.totalPosted ?? 0} />
        <Card title="Pending" value={totals?.totalPending ?? 0} />
        <Card title="Delivered" value={totals?.totalDelivered ?? 0} />
        <Card title="Cancelled" value={totals?.totalCancelled ?? 0} />
        <Card title="All Orders" value={totals?.totalAll ?? 0} />
      </section>

      {/* Branch Pack */}
      <section className="mb-6">
        <h2 className="text-xl font-medium mb-2">Branch Pack (Excel)</h2>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="border rounded px-3 py-2"
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

          <label className="text-sm text-gray-600">From</label>
          <input type="date" className="border rounded px-2 py-1" value={from} onChange={e => setFrom(e.target.value)} />
          <label className="text-sm text-gray-600">To</label>
          <input type="date" className="border rounded px-2 py-1" value={to} onChange={e => setTo(e.target.value)} />

          <button
            className="px-3 py-2 bg-emerald-600 text-white rounded"
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
      <Section title="Applications by Branch" onExport={() => exportCSV(byBranch, 'applications_by_branch.csv')}>
        <Table rows={byBranch} cols={[['branch_name', 'Branch'], ['applications', 'Applications']]} />
      </Section>

      {/* Applications by Branch & Department */}
      <Section title="Applications by Branch & Department" onExport={() => exportCSV(byBranchDept, 'applications_by_branch_department.csv')}>
        <Table rows={byBranchDept} cols={[['branch_name', 'Branch'], ['department_name', 'Department'], ['applications', 'Applications']]} />
      </Section>

      {/* Applications by Category */}
      <Section title="Applications by Category (A/R/P/E)" onExport={() => exportCSV(byCategory, 'applications_by_category.csv')}>
        <Table rows={byCategory} cols={[['category', 'Category'], ['applications', 'Applications']]} />
      </Section>

      {/* Inventory Status */}
      <Section title="Inventory Status" onExport={() => exportCSV(inventory, 'inventory_status.csv')}>
        <Table rows={inventory} cols={[
          ['branch_name', 'Branch'],
          ['item_name', 'Item'],
          ['initial_stock', 'Initial'],
          ['allocated_qty', 'Distributed'],
          ['delivered_qty', 'Given Out'],
          ['pending_delivery_qty', 'Pending Delivery'],
          ['remaining_after_posted', 'Remain (Posted)'],
          ['remaining_after_delivered', 'Remain (Delivered)'],
        ]} />
      </Section>
    </div>
  )
}

/* Helpers */
function Card({ title, value }) {
  return (
    <div className="border rounded p-3 bg-white shadow-sm">
      <div className="text-xs text-gray-500">{title}</div>
      <div className="text-xl font-semibold">{Number(value).toLocaleString()}</div>
    </div>
  )
}

function Section({ title, onExport, children }) {
  return (
    <section className="mb-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-medium">{title}</h2>
        <button className="px-3 py-1 bg-gray-700 text-white rounded" onClick={onExport}>Export CSV</button>
      </div>
      <div className="mt-2">{children}</div>
    </section>
  )
}

function Table({ rows, cols }) {
  if (!rows?.length) return <div className="p-3 text-gray-600">No data</div>
  return (
    <table className="w-full text-sm border">
      <thead className="bg-gray-50">
        <tr>
          {cols.map(([key, label]) => (
            <th key={key} className="p-2 border text-left">{label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {cols.map(([key]) => (
              <td key={key} className="p-2 border">{String(r[key] ?? '')}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function ReportsPage() {
  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <ReportsPageContent />
    </ProtectedRoute>
  )
}