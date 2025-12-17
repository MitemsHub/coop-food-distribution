// app/orders/page.jsx
'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '../contexts/AuthContext'
import ProtectedRoute from '../components/ProtectedRoute'

function OrdersPageContent() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState(null)
  const [selectedStatus, setSelectedStatus] = useState('All')
  const [shoppingOpen, setShoppingOpen] = useState(true)
  const [shoppingStatusLoading, setShoppingStatusLoading] = useState(false)
  const [shoppingStatusError, setShoppingStatusError] = useState('')
  
  const router = useRouter()
  const searchParams = useSearchParams()
  const memberId = searchParams.get('member_id')
  const isAdmin = searchParams.get('admin') === 'true'
  const { user } = useAuth()

  useEffect(() => {
    if (!memberId) {
      router.push('/shop')
      return
    }
    loadOrders()
  }, [memberId, router])

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

  const loadOrders = async () => {
    try {
      setLoading(true)
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
    } finally {
      setLoading(false)
    }
  }

  const filteredOrders = selectedStatus === 'All' 
    ? orders 
    : orders.filter(order => order.status === selectedStatus)

  const getStatusColor = (status) => {
    switch (status) {
      case 'Pending': return 'bg-yellow-100 text-yellow-800'
      case 'Posted': return 'bg-blue-100 text-blue-800'
      case 'Delivered': return 'bg-green-100 text-green-800'
      case 'Cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const downloadReceipt = (orderId) => {
    window.open(`/shop/success/${orderId}?mid=${memberId}`, '_blank')
  }

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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        {/* Header */}
        <div className="max-w-6xl mx-auto mb-6">
          <div className="bg-white rounded-xl shadow-lg p-3 sm:p-4 md:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-2 lg:mb-3">
              <div className="text-center md:text-left">
                <h1 className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-gray-800 break-words">
                  {isAdmin ? 'Admin - Member Orders' : 'My Orders'}
                </h1>
                <p className="text-xs sm:text-sm md:text-base text-gray-600">
                  {isAdmin ? 'Viewing orders for member' : 'Track your order history and status'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 w-full md:w-auto md:flex md:flex-row">
                {shoppingOpen && (
                <button
                  onClick={() => router.push(`/shop?mid=${memberId}${isAdmin ? '&admin=true' : ''}`)}
                  className="px-2 py-2 sm:px-3 md:px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center text-xs sm:text-sm md:text-base whitespace-nowrap"
                >
                  <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M8 11v6a2 2 0 002 2h4a2 2 0 002-2v-6M8 11h8" />
                  </svg>
                  {isAdmin ? 'Shop for Member' : 'Shop'}
                </button>
                )}
                {shoppingOpen && (
                <button
                  onClick={() => router.push(`/cart?member_id=${memberId}${isAdmin ? '&admin=true' : ''}`)}
                  className="px-2 py-2 sm:px-3 md:px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center text-xs sm:text-sm md:text-base whitespace-nowrap"
                >
                  <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.5 5M7 13l2.5 5m0 0h8.5" />
                  </svg>
                  Cart
                </button>
                )}
                {isAdmin && (
                  <button
                    onClick={() => router.push('/admin/orders')}
                    className="px-3 py-2 sm:px-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center justify-center text-sm sm:text-base whitespace-nowrap"
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
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-blue-600">Member ID: {memberId}</p>
                </div>
                <div className="text-right">
                  <div className="text-xs sm:text-sm text-blue-600">Total Orders: {orders.length}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="max-w-6xl mx-auto mb-6">
          <div className="bg-white rounded-xl shadow-lg p-3 sm:p-4 md:p-6">
            <div className="grid grid-cols-2 gap-3 sm:gap-4 items-end">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
                <label className="text-xs sm:text-sm font-medium text-gray-700 whitespace-nowrap">Filter by Status:</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-xs sm:text-sm w-full sm:w-auto"
                >
                  <option key="all" value="All">All Orders</option>
                      <option key="pending" value="Pending">Pending</option>
                      <option key="posted" value="Posted">Posted</option>
                      <option key="delivered" value="Delivered">Delivered</option>
                      <option key="cancelled" value="Cancelled">Cancelled</option>
                </select>
              </div>
              <div className="flex justify-end items-end">
                <button
                  onClick={loadOrders}
                  className="px-3 py-2 sm:px-4 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center justify-center text-xs sm:text-sm whitespace-nowrap h-10"
                >
                  <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Orders List */}
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-6">
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
                {shoppingOpen ? (
                  <button
                    onClick={() => router.push(`/shop?mid=${memberId}`)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Start Shopping
                  </button>
                ) : (
                  <div className="text-gray-600 text-sm">Shopping is currently closed.</div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredOrders.map((order) => (
                  <div key={order.order_id} className="border rounded-lg p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-2 lg:mb-3">
                      <div className="flex items-center gap-4">
                        <div>
                          <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-800">Order #{order.order_id}</h3>
                          <p className="text-xs sm:text-sm text-gray-600">
                            {new Date(order.created_at).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                        <span className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${getStatusColor(order.status)}`}>
                          {order.status}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm sm:text-base md:text-lg font-semibold text-gray-800">₦{Number(order.total_amount || 0).toLocaleString()}</div>
                        <div className="text-xs sm:text-sm text-gray-600">{order.payment_option}</div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2 lg:mb-3">
                      <div>
                        <div className="text-sm text-gray-600">Delivery Branch</div>
                        <div className="font-medium">{order.delivery?.name || 'N/A'}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600">Department</div>
                        <div className="font-medium">{order.departments?.name || order.department || 'N/A'}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600">Items</div>
                        <div className="font-medium">{order.order_lines?.length || 0} items</div>
                      </div>
                    </div>
                    
                    {/* Order Items */}
                    {order.order_lines && order.order_lines.length > 0 && (
                      <div className="mb-2 lg:mb-3">
                        <div className="text-sm font-medium text-gray-700 mb-2">Items:</div>
                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="space-y-2">
                            {order.order_lines.map((line, index) => (
                              <div key={`${order.order_id}-${line.sku || line.item_id || index}`} className="flex justify-between items-center text-sm">
                                <div>
                                  <span className="font-medium">{line.items?.name || 'Unknown Item'}</span>
                                  <span className="text-gray-600 ml-2">x{line.qty}</span>
                                </div>
                                <div className="font-medium">₦{Number(line.amount || 0).toLocaleString()}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Payment Breakdown for Loan Orders */}
                    {order.payment_option === 'Loan' && (
                      <div className="mb-2 lg:mb-3">
                        <div className="text-sm font-medium text-gray-700 mb-2">Payment Breakdown:</div>
                        <div className="bg-blue-50 rounded-lg p-3">
                          <div className="space-y-1">
                            {/* Principal is the sum of line amounts */}
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-gray-600">Principal Amount:</span>
                              <span className="font-medium">₦{Number(((order.order_lines || []).reduce((sum, l) => sum + Number(l.amount || 0), 0))).toLocaleString()}</span>
                            </div>
                            {/* Interest is 13% of principal */}
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-gray-600">Interest (13%):</span>
                              <span className="font-medium text-orange-600">₦{Number(Math.round(((order.order_lines || []).reduce((sum, l) => sum + Number(l.amount || 0), 0)) * 0.13)).toLocaleString()}</span>
                            </div>
                            <div className="border-t pt-1 mt-1">
                              <div className="flex justify-between items-center text-sm font-semibold">
                                <span>Total (incl. Interest):</span>
                                <span>₦{Number(((order.order_lines || []).reduce((sum, l) => sum + Number(l.amount || 0), 0)) + Math.round(((order.order_lines || []).reduce((sum, l) => sum + Number(l.amount || 0), 0)) * 0.13)).toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        {order.posted_at && (
                          <span>Posted: {new Date(order.posted_at).toLocaleDateString()}</span>
                        )}
                        {order.delivered_at && (
                          <span>Delivered: {new Date(order.delivered_at).toLocaleDateString()}</span>
                        )}
                        {order.cancelled_at && (
                          <span>Cancelled: {new Date(order.cancelled_at).toLocaleDateString()}</span>
                        )}
                      </div>
                      
                      <div className="flex gap-2">
                        {(order.status === 'Delivered' || order.status === 'Posted') && (
                          <button
                            onClick={() => downloadReceipt(order.order_id)}
                            className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm flex items-center"
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Receipt
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
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