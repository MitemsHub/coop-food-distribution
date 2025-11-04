// app/rep/delivered/page.jsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../contexts/AuthContext'
import ProtectedRoute from '../../components/ProtectedRoute'

function RepDeliveredPageContent() {
  const [orders, setOrders] = useState([])
  const [departments, setDepartments] = useState([])
  const [dept, setDept] = useState('') // '' = All
  const [msg, setMsg] = useState(null)
  const [loading, setLoading] = useState(false)
  const [nextCursor, setNextCursor] = useState(null)
  const { user, logout } = useAuth()
  const router = useRouter()

  const changeBranch = () => {
    if (confirm('Are you sure you want to change your branch? You will be logged out and redirected to the login page.')) {
      logout()
    }
  }

  // Load departments only when authorized as rep
  useEffect(() => {
    if (user?.type !== 'rep' || !user?.authenticated) return
    ;(async () => {
      try {
        const res = await fetch('/api/departments/list', { cache: 'no-store' })
        const j = await res.json()
        if (j?.ok) setDepartments(j.departments || [])
      } catch {}
    })()
  }, [user])

  // Reload orders when dept changes, only for rep
  useEffect(() => {
    if (user?.type !== 'rep' || !user?.authenticated) return
    fetchOrders(true)
  }, [dept, user])

  const fetchOrders = async (reset = true) => {
    setLoading(true); setMsg(null)
    try {
      const qs = new URLSearchParams({ status:'Delivered', limit:'50' })
      if (dept) qs.set('dept', dept)
      if (!reset && nextCursor) { qs.set('cursor', nextCursor); qs.set('dir','next') }
      const res = await fetch(`/api/rep/orders/list?${qs.toString()}`, { cache:'no-store' })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || 'Failed')
      setOrders(reset ? (json.orders || []) : [...orders, ...(json.orders || [])])
      setNextCursor(json.nextCursor || null)
    } catch (e) {
      setMsg({ type:'error', text:e.message })
    } finally {
      setLoading(false)
    }
  }

  const exportCSV = () => {
    const rows = orders.flatMap(o => (o.order_lines || []).map(l => ({
      order_id:o.order_id, posted_at:o.posted_at, member:o.member_name_snapshot,
      member_branch:o.member_branch?.name||'', delivery:o.delivery?.name||'',
      department:o.departments?.name||'', payment:o.payment_option,
      sku:l.items?.sku, item:l.items?.name, qty:l.qty, unit_price:l.unit_price, amount:l.amount
    })))
    if (rows.length === 0) return alert('No rows to export')
    const headers = Object.keys(rows[0])
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => `"${String(r[h] ?? '').replace(/"/g,'""')}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a')
    a.href = url; a.download = 'rep_delivered.csv'; a.click(); URL.revokeObjectURL(url)
  }

  const exportPDF = async () => {
    if (!orders.length) return alert('No rows to export')
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF()
    let y = 12
    doc.setFontSize(14); doc.text('Delivered Orders Manifest', 10, y); y += 6
    doc.setFontSize(10); doc.text(`Generated: ${new Date().toLocaleString()}`, 10, y); y += 6
    if (dept) { doc.text(`Department: ${dept}`, 10, y); y += 6 }
    const header = ['Order','Member','Dept','Pay','SKU','Item','Qty','Unit Price','Amount']
    doc.text(header.join(' | '), 10, y); y += 4
    doc.line(10, y, 200, y); y += 4
    orders.forEach(o => {
      (o.order_lines || []).forEach(l => {
        const line = [
          String(o.order_id),
          String(o.member_name_snapshot || ''),
          String(o.departments?.name || ''),
          String(o.payment_option || ''),
          String(l.items?.sku || ''),
          String(l.items?.name || ''),
          String(l.qty || 0),
          `₦${Number(l.unit_price || 0).toLocaleString()}`,
          `₦${Number(l.amount || 0).toLocaleString()}`,
        ].join(' | ')
        doc.text(line, 10, y)
        y += 5
        if (y > 280) { doc.addPage(); y = 12 }
      })
    })
    doc.save('rep_delivered_manifest.pdf')
  }

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto">
      <h1 className="text-lg sm:text-xl md:text-2xl font-semibold mb-4">Rep — Delivered Orders</h1>
      
      {/* Branch Code Display */}
      <div className="mb-6 p-3 sm:p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
          <div className="flex items-center">
            <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <div>
              <div className="text-xs sm:text-sm text-blue-600 font-medium">Current Branch</div>
              <div className="text-sm sm:text-lg font-bold text-blue-800">{user?.branchCode || 'Unknown'}</div>
            </div>
          </div>
          <div className="flex justify-start sm:justify-end">
            <button 
              onClick={changeBranch}
              className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center text-xs sm:text-sm whitespace-nowrap"
            >
              <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              Change Branch
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-4 items-start">
        <select className="border rounded px-3 py-2 text-xs sm:text-sm w-full" value={dept} onChange={e=>setDept(e.target.value)}>
          <option value="">All departments</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <button className="px-2 py-2 bg-gray-700 text-white rounded text-xs sm:text-sm whitespace-nowrap w-full" onClick={exportCSV}>Export CSV</button>
        <button className="px-2 py-2 bg-emerald-600 text-white rounded text-xs sm:text-sm whitespace-nowrap w-full" onClick={exportPDF}>Export PDF</button>
        <button className="px-2 py-2 bg-blue-600 text-white rounded text-xs sm:text-sm whitespace-nowrap w-full" onClick={()=>fetchOrders(true)}>{loading ? 'Loading…' : 'Refresh'}</button>
      </div>

      {msg && <div className={`mb-3 text-sm ${msg.type==='error'?'text-red-700':'text-green-700'}`}>{msg.text}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {orders.length === 0 && <div className="p-4 text-gray-600">No Delivered orders.</div>}
        {orders.map(o => (
          <div key={o.order_id} className="border rounded-lg p-4 bg-white shadow-sm">
            <div className="flex flex-col justify-between items-start mb-3">
              <div>
                <div className="text-xs sm:text-sm font-medium">#{o.order_id}</div>
                <div className="text-xs sm:text-sm text-gray-600">{o.member_id} — {o.member_name_snapshot}</div>
                <div className="text-xs text-gray-500">{new Date(o.posted_at || o.created_at).toLocaleDateString()}</div>
              </div>
            </div>
            <div className="space-y-1 mb-3">
              <div className="text-xs">Member: {o.member_branch?.name || '-'}</div>
              <div className="text-xs">Delivery: {o.delivery?.name || '-'}</div>
              <div className="text-xs">{o.departments?.name || '-'}</div>
              <div className="text-xs">Payment: <b>{o.payment_option}</b></div>
              <div className="text-xs font-medium">
                {o.payment_option === 'Loan' ? 'Total with Interest:' : 'Total:'} ₦{Number(o.total_amount || 0).toLocaleString()}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-1">SKU</th>
                    <th className="text-left py-2 px-1">Item</th>
                    <th className="text-right py-2 px-1">Qty</th>
                    <th className="text-right py-2 px-1">Price</th>
                    <th className="text-right py-2 px-1">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(o.order_lines || []).map(l => (
                    <tr key={l.id} className="border-b border-gray-100">
                      <td className="py-2 px-1">{l.items?.sku}</td>
                      <td className="py-2 px-1">{l.items?.name}</td>
                      <td className="text-right py-2 px-1">{l.qty}</td>
                      <td className="text-right py-2 px-1">₦{Number(l.unit_price).toLocaleString()}</td>
                      <td className="text-right py-2 px-1">₦{Number(l.amount).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {nextCursor && (
        <div className="mt-4">
          <button className="px-3 py-2 border rounded" onClick={() => fetchOrders(false)}>
            {loading ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  )
}

export default function RepDeliveredPage() {
  return (
    <ProtectedRoute allowedRoles={['rep']}>
      <RepDeliveredPageContent />
    </ProtectedRoute>
  )
}