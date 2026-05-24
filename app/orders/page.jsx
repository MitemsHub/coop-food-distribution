// app/orders/page.jsx
'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '../contexts/AuthContext'
import ProtectedRoute from '../components/ProtectedRoute'
import { supabase } from '@/lib/supabaseClient'

function OrdersPageContent() {
  const [orders, setOrders] = useState([])
  const [ramOrders, setRamOrders] = useState([])
  const [ramLocations, setRamLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState(null)
  const [selectedStatus, setSelectedStatus] = useState('All')
  const [shoppingOpen, setShoppingOpen] = useState(true)
  const [shoppingStatusLoading, setShoppingStatusLoading] = useState(false)
  const [shoppingStatusError, setShoppingStatusError] = useState('')
  
  const router = useRouter()
  const searchParams = useSearchParams()
  const isAdmin = searchParams.get('admin') === 'true'
  const tabParam = (searchParams.get('tab') || '').trim().toLowerCase()
  const [activeTab, setActiveTab] = useState(tabParam === 'ram' ? 'ram' : 'food')
  const { user } = useAuth()
  const memberId = isAdmin ? (searchParams.get('member_id') || '') : (user?.id || '')

  useEffect(() => {
    if (isAdmin) {
      if (!memberId) router.push('/admin')
      return
    }
    if (!memberId) {
      router.push('/shop')
      return
    }
    const legacy = searchParams.get('member_id')
    if (legacy) {
      const qs = tabParam ? `?tab=${encodeURIComponent(tabParam)}` : ''
      router.replace(`/orders${qs}`)
    }
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, memberId, router, searchParams, tabParam])

  useEffect(() => {
    setActiveTab(tabParam === 'ram' ? 'ram' : 'food')
  }, [tabParam])

  useEffect(() => {
    let cancelled = false
    const loadStatus = async () => {
      try {
        setShoppingStatusLoading(true)
        setShoppingStatusError('')
        const res = await fetch('/api/system/shopping', { cache: 'no-store' })
        const json = await res.json()
        if (!res.ok || !json.ok) throw new Error(json.error || 'Failed to load shopping status')
        if (!cancelled) setShoppingOpen(!!json.open)
      } catch (e) {
        if (!cancelled) setShoppingStatusError(`Error: ${e.message}`)
        if (!cancelled) setShoppingOpen(false)
      } finally {
        if (!cancelled) setShoppingStatusLoading(false)
      }
    }
    loadStatus()
    return () => { cancelled = true }
  }, [])

  const loadFoodOrders = async () => {
    try {
      const res = await fetch(`/api/orders/member?member_id=${memberId}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        }
      })
      const data = await res.json()
      
      if (data.ok) {
        setOrders(data.orders || [])
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to load orders' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error. Please try again.' })
    }
  }

  const loadRamOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('ram_orders')
        .select(
          'id,member_id,status,created_at,payment_option,qty,unit_price,principal_amount,interest_amount,total_amount,ram_delivery_location_id'
        )
        .eq('member_id', memberId)
        .order('created_at', { ascending: false })

      if (error) throw new Error(error.message || 'Failed to load ram orders')
      const rows = Array.isArray(data) ? data : []
      setRamOrders(rows)

      const ids = Array.from(new Set(rows.map((r) => r?.ram_delivery_location_id).filter((x) => x != null)))
      if (ids.length === 0) {
        setRamLocations([])
        return
      }

      const { data: locs, error: lErr } = await supabase
        .from('ram_delivery_locations')
        .select('id,delivery_location,name')
        .in('id', ids)

      if (lErr) throw new Error(lErr.message || 'Failed to load ram delivery locations')
      setRamLocations(Array.isArray(locs) ? locs : [])
    } catch (e) {
      setMessage({ type: 'error', text: e?.message || 'Failed to load ram orders' })
    }
  }

  const loadAll = async () => {
    try {
      setLoading(true)
      setMessage(null)
      await Promise.all([loadFoodOrders(), loadRamOrders()])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    try {
      if (!memberId) return
      const total = Number(orders?.length || 0) + Number(ramOrders?.length || 0)
      localStorage.setItem(`ordersCount_${memberId}`, String(total))
    } catch {}
  }, [memberId, orders?.length, ramOrders?.length])

  const filteredOrders =
    selectedStatus === 'All'
      ? activeTab === 'ram'
        ? ramOrders
        : orders
      : (activeTab === 'ram' ? ramOrders : orders).filter((order) => order.status === selectedStatus)

  const getStatusColor = (status) => {
    switch (status) {
      case 'Pending': return 'bg-yellow-100 text-yellow-800'
      case 'Posted': return 'bg-blue-100 text-blue-800'
      case 'Delivered': return 'bg-green-100 text-green-800'
      case 'Approved': return 'bg-green-100 text-green-800'
      case 'Cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const downloadReceipt = (orderId) => {
    window.open(isAdmin ? `/shop/success/${orderId}?mid=${memberId}` : `/shop/success/${orderId}`, '_blank')
  }

  const downloadRamReceipt = (orderId) => {
    window.open(isAdmin ? `/ram/success/${orderId}?mid=${memberId}` : `/ram/success/${orderId}`, '_blank')
  }

  const ramLocationMap = new Map(ramLocations.map((l) => [String(l.id), l]))

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-2 lg:mb-3"></div>
          <p className="text-gray-600">Loading orders...</p>
        </div>
      </div>
    )
  }

  return (
    <ProtectedRoute allowedRoles={['member', 'rep', 'admin']}>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-3 sm:p-4">
        {/* Header */}
        <div className="max-w-6xl mx-auto mb-4">
          <div className="bg-white rounded-xl shadow-lg p-3 sm:p-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
              <div className="text-left">
                <h1 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 break-words">
                  {isAdmin ? 'Admin - Member Orders' : 'My Orders'}
                </h1>
                <p className="text-xs sm:text-sm text-gray-600">
                  {isAdmin ? 'Viewing orders for member' : 'Track your order history and status'}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
                  <button
                    type="button"
                    onClick={() =>
                      router.push(isAdmin ? `/orders?member_id=${encodeURIComponent(memberId)}&admin=true&tab=food` : '/orders?tab=food')
                    }
                    className={`px-3 py-2 text-xs sm:text-sm font-semibold ${
                      activeTab === 'food' ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Food Orders
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      router.push(isAdmin ? `/orders?member_id=${encodeURIComponent(memberId)}&admin=true&tab=ram` : '/orders?tab=ram')
                    }
                    className={`px-3 py-2 text-xs sm:text-sm font-semibold border-l border-gray-200 ${
                      activeTab === 'ram' ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Ram Orders
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm font-medium text-gray-700 whitespace-nowrap">Status</span>
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-xs sm:text-sm bg-white"
                  >
                    <option key="all" value="All">All Orders</option>
                    <option key="pending" value="Pending">Pending</option>
                    {activeTab === 'ram' ? (
                      <option key="approved" value="Approved">Approved</option>
                    ) : (
                      <>
                        <option key="posted" value="Posted">Posted</option>
                        <option key="delivered" value="Delivered">Delivered</option>
                      </>
                    )}
                    <option key="cancelled" value="Cancelled">Cancelled</option>
                  </select>
                </div>

                {!isAdmin && (
                  <button
                    onClick={() => router.push('/shop')}
                    disabled={!shoppingOpen || shoppingStatusLoading}
                    className={`px-3 py-2 rounded-lg border flex items-center justify-center text-xs sm:text-sm whitespace-nowrap ${
                      shoppingOpen && !shoppingStatusLoading
                        ? 'bg-gray-100 hover:bg-gray-200 text-gray-800 border-gray-200'
                        : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                    }`}
                  >
                    <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    {shoppingOpen ? 'Back to Shop' : 'Shopping Closed'}
                  </button>
                )}
                {isAdmin && (
                  <button
                    onClick={() => router.push('/admin/food/orders')}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg border border-gray-200 flex items-center justify-center text-xs sm:text-sm whitespace-nowrap"
                  >
                    <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Back to Admin
                  </button>
                )}
              </div>
            </div>
            
            {/* Member Info */}
            <div className="bg-gray-50 border border-gray-100 rounded-lg p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs sm:text-sm text-gray-700">Member ID: {memberId}</p>
                </div>
                <div className="text-right">
                  <div className="text-xs sm:text-sm text-gray-700">
                    Food: {orders.length} · Ram: {ramOrders.length}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Orders List */}
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-3 sm:p-4">
            {message && (
              <div className={`mb-4 p-3 rounded-lg ${
                message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-600'
              }`}>
                {message.text}
              </div>
            )}
            
            {filteredOrders.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-16 h-16 mx-auto text-gray-300 mb-2 lg:mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-gray-500 mb-2 lg:mb-3">
                  {selectedStatus === 'All' ? 'No orders found' : `No ${selectedStatus.toLowerCase()} orders found`}
                </p>
                {!isAdmin && (
                  <button
                    onClick={() => router.push('/shop')}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg border border-gray-200 text-sm"
                  >
                    Back to Shop
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                {filteredOrders.map((order) => (
                  activeTab === 'ram' ? (
                    <div key={order.id} className="border rounded-lg p-3 bg-white hover:shadow-sm transition-shadow">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-xs font-semibold text-gray-800">Ram Order #{order.id}</div>
                          <div className="text-[11px] text-gray-500">
                            {new Date(order.created_at).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${getStatusColor(order.status)}`}>
                          {order.status}
                        </span>
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-2">
                        <div className="text-[11px] text-gray-600">{order.payment_option}</div>
                        <div className="text-xs font-semibold text-gray-900">₦{Number(order.total_amount || 0).toLocaleString()}</div>
                      </div>

                      <div className="mt-2 text-[11px] text-gray-700 space-y-1">
                        <div>
                          Vendor: <span className="font-medium text-gray-900">{ramLocationMap.get(String(order.ram_delivery_location_id))?.name || 'N/A'}</span>
                        </div>
                        <div>
                          Qty: <span className="font-medium text-gray-900">{Number(order.qty || 0)}</span>
                        </div>
                      </div>

                      <div className="mt-3 flex justify-end">
                        <button
                          onClick={() => downloadRamReceipt(order.id)}
                          className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg border border-gray-200 text-xs flex items-center"
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Receipt
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div key={order.order_id} className="border rounded-lg p-3 bg-white hover:shadow-sm transition-shadow">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-xs font-semibold text-gray-800">Order #{order.order_id}</div>
                          <div className="text-[11px] text-gray-500">
                            {new Date(order.created_at).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${getStatusColor(order.status)}`}>
                          {order.status}
                        </span>
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-2">
                        <div className="text-[11px] text-gray-600">{order.payment_option}</div>
                        <div className="text-xs font-semibold text-gray-900">₦{Number(order.total_amount || 0).toLocaleString()}</div>
                      </div>

                      <div className="mt-2 text-[11px] text-gray-700 space-y-1">
                        <div>
                          Branch: <span className="font-medium text-gray-900">{order.delivery?.name || 'N/A'}</span>
                        </div>
                        <div>
                          Dept: <span className="font-medium text-gray-900">{order.departments?.name || order.department || 'N/A'}</span>
                        </div>
                        <div>
                          Items: <span className="font-medium text-gray-900">{order.order_lines?.length || 0}</span>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-end">
                        {(order.status === 'Delivered' || order.status === 'Posted') && (
                          <button
                            onClick={() => downloadReceipt(order.order_id)}
                            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg border border-gray-200 text-xs flex items-center"
                          >
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Receipt
                          </button>
                        )}
                      </div>
                    </div>
                  )
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <OrdersPageContent />
    </Suspense>
  )
}
