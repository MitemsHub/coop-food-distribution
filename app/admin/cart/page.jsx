// app/admin/cart/page.jsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import ProtectedRoute from '../../components/ProtectedRoute'

function AdminCartPageContent() {
  const router = useRouter()
  const [members, setMembers] = useState([])
  const [selectedMember, setSelectedMember] = useState('')
  const [cartData, setCartData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)

  // Load all members for selection
  useEffect(() => {
    loadMembers()
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
      setMessage({ type: 'error', text: 'Failed to load members' })
    }
  }

  const loadMemberCart = async (memberId) => {
    if (!memberId) {
      setCartData(null)
      return
    }

    setLoading(true)
    try {
      // Try to get cart data from localStorage simulation or database
      // For now, we'll redirect to the actual cart page with admin privileges
      router.push(`/cart?member_id=${memberId}&admin=true`)
    } catch (error) {
      console.error('Error loading cart:', error)
      setMessage({ type: 'error', text: 'Failed to load cart data' })
    } finally {
      setLoading(false)
    }
  }

  const handleMemberSelect = (memberId) => {
    setSelectedMember(memberId)
    if (memberId) {
      loadMemberCart(memberId)
    }
  }

  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold mb-2">Admin — Member Carts</h1>
            <p className="text-gray-600">View and manage member shopping carts</p>
          </div>
          <div className="flex gap-2">
            <a href="/admin/pending" className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700">Pending</a>
            <a href="/admin/posted" className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Posted</a>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Select Member</h2>
            <button
              onClick={() => router.push('/admin/pending')}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 flex items-center"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Admin
            </button>
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

        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Select Member</h2>
          
          <div className="mb-6">
            <select
              value={selectedMember}
              onChange={(e) => handleMemberSelect(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Choose a member...</option>
              {members.map(member => (
                <option key={member.member_id} value={member.member_id}>
                  {member.full_name} ({member.member_id}) - {member.branches?.code || 'No Branch'}
                </option>
              ))}
            </select>
          </div>

          {loading && (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600">Loading cart data...</p>
            </div>
          )}

          {!selectedMember && !loading && (
            <div className="text-center py-8 text-gray-500">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.1 5H17M9 19.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM20.5 19.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
              </svg>
              <p>Select a member to view their cart</p>
            </div>
          )}
        </div>

        <div className="mt-6 bg-blue-50 rounded-lg p-4">
          <h3 className="font-semibold text-blue-800 mb-2">Admin Cart Management</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• View any member's current cart items</li>
            <li>• Edit quantities and remove items</li>
            <li>• Process cart submissions on behalf of members</li>
            <li>• Monitor cart activity across all branches</li>
          </ul>
        </div>
      </div>
    </ProtectedRoute>
  )
}

export default function AdminCartPage() {
  return <AdminCartPageContent />
}