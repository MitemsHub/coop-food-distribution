// app/admin/orders/page.jsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import ProtectedRoute from '../../components/ProtectedRoute'

function AdminOrdersPageContent() {
  const router = useRouter()
  const [orders, setOrders] = useState([])
  const [members, setMembers] = useState([])
  const [selectedMember, setSelectedMember] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    loadMembers()
    loadAllOrders()
  }, [])

  const loadMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('members')
        .select(`
          member_id, 
          full_name, 
          branches:branch_id(code)
        `)
        .order('full_name')
      
      if (error) throw error
      setMembers(data || [])
    } catch (error) {
      console.error('Error loading members:', error)
    }
  }

  const loadAllOrders = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('orders')
        .select(`
          *,
          members!inner(full_name, branch_code),
          branches!delivery_branch_code(name),
          departments(name),
          order_lines(
            id,
            qty,
            unit_price,
            amount,
            items(sku, name, unit)
          )
        `)
        .order('created_at', { ascending: false })

      if (selectedMember) {
        query = query.eq('member_id', selectedMember)
      }

      if (statusFilter) {
        query = query.eq('status', statusFilter)
      }

      const { data, error } = await query
      
      if (error) throw error
      setOrders(data || [])
    } catch (error) {
      console.error('Error loading orders:', error)
      setMessage({ type: 'error', text: 'Failed to load orders' })
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = () => {
    loadAllOrders()
  }

  const downloadReceipt = async (orderId, memberId) => {
    try {
      // Redirect to the existing success page for PDF download
      window.open(`/shop/success/${orderId}?member_id=${memberId}`, '_blank')
    } catch (error) {
      console.error('Error downloading receipt:', error)
      setMessage({ type: 'error', text: 'Failed to download receipt' })
    }
  }

  const getStatusBadge = (status) => {
    const statusStyles = {
      'pending': 'bg-yellow-100 text-yellow-800',
      'posted': 'bg-blue-100 text-blue-800',
      'delivered': 'bg-green-100 text-green-800',
      'cancelled': 'bg-red-100 text-red-800'
    }
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusStyles[status] || 'bg-gray-100 text-gray-800'}`}>
        {status?.charAt(0).toUpperCase() + status?.slice(1) || 'Unknown'}
      </span>
    )
  }

  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <div className="p-2 lg:p-3 xl:p-4 max-w-7xl mx-auto">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-3 lg:mb-4">
          <div className="text-center md:text-left">
            <h1 className="text-lg sm:text-xl md:text-2xl font-semibold mb-2 break-words">Admin — All Member Orders</h1>
            <p className="text-sm sm:text-base text-gray-600">View and manage all member orders across the system</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
            <a href="/admin/pending" className="px-3 py-2 sm:px-4 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-center text-sm sm:text-base whitespace-nowrap">Pending</a>
            <a href="/admin/posted" className="px-3 py-2 sm:px-4 bg-green-600 text-white rounded hover:bg-green-700 text-center text-sm sm:text-base whitespace-nowrap">Posted</a>
          </div>
        </div>

        {message && (
          <div className={`mb-4 p-3 rounded-lg ${
            message.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 
            'bg-green-50 text-green-700 border border-green-200'
          }`}>
            {message.text}
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg xl:rounded-xl shadow-sm lg:shadow-md p-2 lg:p-3 xl:p-4 mb-3 lg:mb-4">
          <h2 className="text-base sm:text-lg font-semibold mb-2 lg:mb-3">Filters</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">Member</label>
              <select
                value={selectedMember}
                onChange={(e) => {
                  setSelectedMember(e.target.value)
                  setTimeout(handleFilterChange, 100)
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="">All Members</option>
                {members.map(member => (
                  <option key={member.member_id} value={member.member_id}>
                    {member.full_name} ({member.member_id})
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value)
                  setTimeout(handleFilterChange, 100)
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="posted">Posted</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            
            <div className="flex items-end">
              <button
                onClick={handleFilterChange}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Refresh'}
              </button>
            </div>
          </div>
        </div>

        {/* Orders List */}
        <div className="bg-white rounded-xl shadow-lg">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold">Orders ({orders.length})</h2>
          </div>
          
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600">Loading orders...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <svg className="w-16 h-16 mx-auto mb-2 lg:mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p>No orders found</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {orders.map(order => (
                <div key={order.order_id} className="p-6">
                  <div className="flex items-start justify-between mb-2 lg:mb-3">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-lg">Order #{order.order_id}</h3>
                        {getStatusBadge(order.status)}
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p><strong>Member:</strong> {order.members?.full_name} ({order.member_id})</p>
                        <p><strong>Branch:</strong> {order.members?.branch_code}</p>
                        <p><strong>Delivery:</strong> {order.branches?.name}</p>
                        <p><strong>Department:</strong> {order.departments?.name}</p>
                        <p><strong>Payment:</strong> {order.payment_option}</p>
                        <p><strong>Date:</strong> {new Date(order.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600 mb-2">
                        ₦{Number(order.total_amount || 0).toLocaleString()}
                      </div>
                      <div className="flex gap-2">
                        {(order.status === 'delivered' || order.status === 'posted') && (
                          <button
                            onClick={() => downloadReceipt(order.order_id, order.member_id)}
                            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                          >
                            Receipt
                          </button>
                        )}
                        <button
                          onClick={() => router.push(`/admin/pending`)}
                          className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
                        >
                          Manage
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {/* Order Items */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium mb-3">Order Items</h4>
                    <div className="space-y-2">
                      {(order.order_lines || []).map(line => (
                        <div key={line.id} className="flex justify-between items-center text-sm">
                          <div>
                            <span className="font-medium">{line.items?.name}</span>
                            <span className="text-gray-500 ml-2">({line.items?.sku})</span>
                          </div>
                          <div className="text-right">
                            <div>{line.qty} {line.items?.unit} × ₦{Number(line.unit_price).toLocaleString()}</div>
                            <div className="font-medium">₦{Number(line.amount).toLocaleString()}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  )
}

export default function AdminOrdersPage() {
  return <AdminOrdersPageContent />
}