'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import ProtectedRoute from '../../components/ProtectedRoute'
import { supabase } from '@/lib/supabaseClient'
import { useSearchParams } from 'next/navigation'

function safeJson(res) {
  return res.json().catch(async () => ({ ok: false, error: await res.text().catch(() => 'Request failed') }))
}

function statusBadge(status) {
  const s = String(status || '')
  const styles = {
    Pending: 'bg-yellow-100 text-yellow-800',
    Approved: 'bg-green-100 text-green-800',
    Cancelled: 'bg-red-100 text-red-800',
  }
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[s] || 'bg-gray-100 text-gray-800'}`}>
      {s || 'Unknown'}
    </span>
  )
}

function RamOrdersPageContent() {
  const searchParams = useSearchParams()
  const [orders, setOrders] = useState([])
  const [members, setMembers] = useState([])
  const [locations, setLocations] = useState([])
  const [status, setStatus] = useState('Pending')
  const [payment, setPayment] = useState('')
  const [memberId, setMemberId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [term, setTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState(null)
  const [updating, setUpdating] = useState(null)
  const ctlRef = useRef(null)

  useEffect(() => {
    const qsStatus = (searchParams.get('status') || '').trim()
    const allowed = new Set(['Pending', 'Approved', 'Cancelled'])
    if (qsStatus && allowed.has(qsStatus)) setStatus(qsStatus)
  }, [searchParams])

  const locationMap = useMemo(() => new Map(locations.map((l) => [String(l.id), l])), [locations])

  const fetchMeta = async () => {
    try {
      const [{ data: mData, error: mErr }, lRes] = await Promise.all([
        supabase.from('members').select('member_id,full_name,branches:branch_id(code,name)').order('full_name', { ascending: true }),
        fetch('/api/ram/delivery-locations', { cache: 'no-store' }),
      ])

      if (!mErr && Array.isArray(mData)) setMembers(mData)

      const lJson = await safeJson(lRes)
      if (lRes.ok && lJson?.ok && Array.isArray(lJson.locations)) {
        setLocations(lJson.locations)
      }
    } catch {
    }
  }

  const fetchOrders = async () => {
    if (ctlRef.current) ctlRef.current.abort()
    const ctl = new AbortController()
    ctlRef.current = ctl

    setLoading(true)
    setMsg(null)
    try {
      const qs = new URLSearchParams({ limit: '400' })
      if (status) qs.set('status', status)
      if (payment) qs.set('payment', payment)
      if (memberId) qs.set('member_id', memberId)
      if (term) qs.set('term', term)
      const res = await fetch(`/api/admin/ram-orders/list?${qs.toString()}`, { cache: 'no-store', signal: ctl.signal })
      const json = await safeJson(res)
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Failed to load ram orders')

      let rows = json.orders || []
      if (locationId) {
        rows = rows.filter((o) => String(o.ram_delivery_location_id || '') === String(locationId))
      }
      setOrders(rows)
    } catch (e) {
      if (e?.name === 'AbortError') return
      setMsg({ type: 'error', text: e?.message || 'Failed to load' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMeta()
    fetchOrders()
    return () => {
      if (ctlRef.current) ctlRef.current.abort()
    }
  }, [])

  const updateStatus = async (id, nextStatus) => {
    setUpdating(id)
    setMsg(null)
    try {
      const res = await fetch('/api/admin/ram-orders/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: nextStatus }),
      })
      const json = await safeJson(res)
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Failed to update status')
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: json.order.status } : o)))
      setMsg({ type: 'success', text: `Order #${id} updated to ${nextStatus}` })
    } catch (e) {
      setMsg({ type: 'error', text: e?.message || 'Failed to update status' })
    } finally {
      setUpdating(null)
    }
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-base sm:text-lg md:text-xl font-semibold break-words">Admin — Ram Sales Orders</h1>
          <div className="text-xs sm:text-sm text-gray-600">Ram orders are processed by Admin only (Reps do not see them).</div>
        </div>
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

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="flex gap-2">
            <input
              className="border rounded px-3 py-2 text-xs sm:text-sm flex-1"
              placeholder="Search (ID or member ID)"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            />
            <button className="px-3 py-2 bg-blue-600 text-white rounded text-xs sm:text-sm hover:bg-blue-700 transition-colors" onClick={fetchOrders}>
              Search
            </button>
          </div>

          <select className="border rounded px-3 py-2 text-xs sm:text-sm w-full" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Cancelled">Cancelled</option>
          </select>

          <select className="border rounded px-3 py-2 text-xs sm:text-sm w-full" value={payment} onChange={(e) => setPayment(e.target.value)}>
            <option value="">All payments</option>
            <option value="Savings">Savings</option>
            <option value="Loan">Loan</option>
            <option value="Cash">Cash</option>
          </select>

          <select className="border rounded px-3 py-2 text-xs sm:text-sm w-full" value={memberId} onChange={(e) => setMemberId(e.target.value)}>
            <option value="">All members</option>
            {members.map((m) => (
              <option key={m.member_id} value={m.member_id}>
                {m.full_name} ({m.member_id})
              </option>
            ))}
          </select>

          <select className="border rounded px-3 py-2 text-xs sm:text-sm w-full" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
            <option value="">All delivery locations</option>
            {locations.map((l) => (
              <option key={l.id} value={String(l.id)}>
                {l.delivery_location || l.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-3 flex items-center justify-end gap-2">
          <button className="px-3 py-2 bg-gray-700 text-white rounded text-xs sm:text-sm hover:bg-gray-800 transition-colors" onClick={fetchOrders} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-gray-100">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div className="text-sm font-semibold">Orders ({orders.length})</div>
        </div>

        {loading ? (
          <div className="text-center py-10 text-gray-600">Loading...</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-10 text-gray-500">No ram orders found</div>
        ) : (
          <div className="divide-y divide-gray-200">
            {orders.map((o) => {
              const loc = o.delivery_location || locationMap.get(String(o.ram_delivery_location_id)) || null
              const member = o.member || null
              const principal = Number(o.principal_amount || 0)
              const interest = Number(o.interest_amount || 0)
              const total = Number(o.total_amount || 0)

              return (
                <div key={o.id} className="p-4">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="font-semibold">Ram Order #{o.id}</div>
                        {statusBadge(o.status)}
                      </div>
                      <div className="mt-2 text-xs sm:text-sm text-gray-700 space-y-1">
                        <div>
                          <span className="font-medium">Member:</span> {member?.full_name || '—'} ({o.member_id})
                          {member?.branch?.code ? <span className="text-gray-500"> · {member.branch.code}</span> : null}
                        </div>
                        <div>
                          <span className="font-medium">Delivery Location:</span> {loc?.delivery_location || '—'}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1">
                          <div>
                            <span className="font-medium">Name:</span> {loc?.name || '—'}
                          </div>
                          <div>
                            <span className="font-medium">Phone:</span> {loc?.phone || '—'}
                          </div>
                          <div>
                            <span className="font-medium">Address:</span> {loc?.address || '—'}
                          </div>
                        </div>
                        <div>
                          <span className="font-medium">Payment:</span> {o.payment_option} · <span className="font-medium">Qty:</span> {o.qty} ·{' '}
                          <span className="font-medium">Unit:</span> ₦{Number(o.unit_price || 0).toLocaleString()}
                        </div>
                        <div>
                          <span className="font-medium">Principal:</span> ₦{principal.toLocaleString()} · <span className="font-medium">Interest:</span> ₦{interest.toLocaleString()} ·{' '}
                          <span className="font-medium">Total:</span> ₦{total.toLocaleString()}
                        </div>
                        <div className="text-gray-500">
                          {o.created_at ? new Date(o.created_at).toLocaleString() : ''}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 justify-start lg:justify-end">
                      {o.status !== 'Approved' && o.status !== 'Cancelled' && (
                        <button
                          className="px-3 py-2 bg-green-600 text-white rounded text-xs sm:text-sm hover:bg-green-700 transition-colors disabled:opacity-50"
                          onClick={() => updateStatus(o.id, 'Approved')}
                          disabled={updating === o.id}
                        >
                          {updating === o.id ? 'Updating...' : 'Approve'}
                        </button>
                      )}
                      {o.status !== 'Cancelled' && (
                        <button
                          className="px-3 py-2 bg-red-600 text-white rounded text-xs sm:text-sm hover:bg-red-700 transition-colors disabled:opacity-50"
                          onClick={() => updateStatus(o.id, 'Cancelled')}
                          disabled={updating === o.id}
                        >
                          {updating === o.id ? 'Updating...' : 'Cancel'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default function RamOrdersPage() {
  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <RamOrdersPageContent />
    </ProtectedRoute>
  )
}
