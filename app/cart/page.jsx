// app/cart/page.jsx
'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '../contexts/AuthContext'
import ProtectedRoute from '../components/ProtectedRoute'
import { supabase } from '@/lib/supabaseClient'

function CartPageContent() {
  const [member, setMember] = useState(null)
  const [branches, setBranches] = useState([])
  const [departments, setDepartments] = useState([])
  const [items, setItems] = useState([])
  const [cartItems, setCartItems] = useState([])
  const [paymentOption, setPaymentOption] = useState('Savings')
  const [deliveryBranch, setDeliveryBranch] = useState('')
  const [department, setDepartment] = useState('')
  const [message, setMessage] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [eligibility, setEligibility] = useState({
    savingsEligible: 0,
    loanEligible: 0,
    outstandingLoansTotal: 0,
    savingsExposure: 0,
    loanExposure: 0,
  })
  
  const router = useRouter()
  const searchParams = useSearchParams()
  const memberId = searchParams.get('member_id')
  const isAdmin = searchParams.get('admin') === 'true'
  const { user } = useAuth()

  // Helper function for safe JSON parsing
  const safeJson = async (res, endpoint) => {
    if (!res.ok) throw new Error(`${endpoint} returned ${res.status}`)
    return await res.json()
  }

  // Load member eligibility
  const loadEligibility = async (memberIdToLoad) => {
    try {
      const res = await fetch(`/api/members/eligibility?member_id=${encodeURIComponent(memberIdToLoad)}`)
      const json = await safeJson(res, '/api/members/eligibility')
      if (json.ok) {
        setEligibility(json.eligibility)
      }
    } catch (e) {
      console.warn('eligibility fetch failed:', e.message)
    }
  }

  // Lookup member from database
  const lookupMember = async (memberIdToLookup) => {
    if (!memberIdToLookup) return null

    const normalizedMemberId = memberIdToLookup.trim().toUpperCase()
    const { data, error } = await supabase
      .from('members')
      .select(`
        member_id,
        full_name,
        savings,
        loans,
        global_limit,
        category,
        branches:branch_id(code, name),
        departments:department_id(name)
      `)
      .eq('member_id', normalizedMemberId)
      .single()

    if (error || !data) {
      console.warn('Member not found:', normalizedMemberId)
      return null
    }

    return data
  }

  // Load member data and cart from localStorage
  useEffect(() => {
    const loadData = async () => {
      if (!memberId) {
        router.push('/shop')
        return
      }
      
      // Load cart data from localStorage
      const savedCart = localStorage.getItem(`cart_${memberId}`)
      const savedMember = localStorage.getItem(`member_${memberId}`)
      const savedDeliveryBranch = localStorage.getItem(`deliveryBranch_${memberId}`)
      const savedDepartment = localStorage.getItem(`department_${memberId}`)
      const savedPayment = localStorage.getItem(`paymentOption_${memberId}`)
      
      if (savedCart) {
        setCartItems(JSON.parse(savedCart))
      }
      
      let memberData = null
      if (savedMember) {
        memberData = JSON.parse(savedMember)
        setMember(memberData)
      } else {
        // If no member data in localStorage, fetch from database
        memberData = await lookupMember(memberId)
        if (memberData) {
          setMember(memberData)
          // Save to localStorage for future use
          localStorage.setItem(`member_${memberId}`, JSON.stringify(memberData))
          // Set default delivery branch and department from member data
          if (memberData?.branches?.code && !savedDeliveryBranch) {
            setDeliveryBranch(memberData.branches.code)
            localStorage.setItem(`deliveryBranch_${memberId}`, memberData.branches.code)
          }
          if (memberData?.departments?.name && !savedDepartment) {
            setDepartment(memberData.departments.name)
            localStorage.setItem(`department_${memberId}`, memberData.departments.name)
          }
        }
      }
      
      // Load eligibility data if we have member data
      if (memberData) {
        loadEligibility(memberId)
      }
      
      if (savedDeliveryBranch) {
        setDeliveryBranch(savedDeliveryBranch)
      }
      if (savedDepartment) {
        setDepartment(savedDepartment)
      }
      if (savedPayment) {
        setPaymentOption(savedPayment)
      }
      
      loadBranches()
      loadDepartments()
      setLoading(false)
    }
    
    loadData()
  }, [memberId, router])

  // Load items when delivery branch changes
  useEffect(() => {
    if (deliveryBranch) {
      loadItems()
    }
  }, [deliveryBranch])

  const loadBranches = async () => {
    try {
      const res = await fetch('/api/branches/list')
      const data = await res.json()
      if (data.ok) {
        setBranches(data.branches || [])
      }
    } catch (error) {
      console.error('Error loading branches:', error)
    }
  }

  const loadDepartments = async () => {
    try {
      const res = await fetch('/api/departments/list')
      const data = await res.json()
      if (data.ok) {
        setDepartments(data.departments || [])
      }
    } catch (error) {
      console.error('Error loading departments:', error)
    }
  }

  const loadItems = async () => {
    if (!deliveryBranch) return
    try {
      const res = await fetch(`/api/items/prices?branch=${encodeURIComponent(deliveryBranch)}`)
      const data = await res.json()
      if (data.ok) {
        setItems(data.items || [])
      }
    } catch (error) {
      console.error('Error loading items:', error)
    }
  }

  const updateQuantity = (sku, newQty) => {
    const quantity = Math.max(0, Math.min(9999, Number(newQty) || 0))
    const updatedCart = cartItems.map(item => 
      item.sku === sku ? { ...item, qty: quantity } : item
    ).filter(item => item.qty > 0)
    
    setCartItems(updatedCart)
    localStorage.setItem(`cart_${memberId}`, JSON.stringify(updatedCart))
  }

  const removeItem = (sku) => {
    const updatedCart = cartItems.filter(item => item.sku !== sku)
    setCartItems(updatedCart)
    localStorage.setItem(`cart_${memberId}`, JSON.stringify(updatedCart))
  }

  const addNewItem = () => {
    // Find items not already in cart
    const availableItems = items.filter(item => 
      !cartItems.some(cartItem => cartItem.sku === item.sku)
    )
    
    if (availableItems.length === 0) {
      setMessage({ type: 'error', text: 'All available items are already in your cart' })
      return
    }
    
    // Add first available item with qty 1
    const newItem = {
      sku: availableItems[0].sku,
      name: availableItems[0].name,
      unit: availableItems[0].unit,
      category: availableItems[0].category,
      price: availableItems[0].price,
      qty: 1
    }
    
    const updatedCart = [...cartItems, newItem]
    setCartItems(updatedCart)
    localStorage.setItem(`cart_${memberId}`, JSON.stringify(updatedCart))
  }

  const updateItemSku = (oldSku, newSku) => {
    const selectedItem = items.find(item => item.sku === newSku)
    if (!selectedItem) return
    
    const updatedCart = cartItems.map(item => 
      item.sku === oldSku ? {
        ...selectedItem,
        qty: item.qty
      } : item
    )
    
    setCartItems(updatedCart)
    localStorage.setItem(`cart_${memberId}`, JSON.stringify(updatedCart))
  }

  const cartTotal = cartItems.reduce((sum, item) => sum + (item.price * item.qty), 0)
  const savingsEligible = Number(eligibility.savingsEligible || 0)
  const loanEligible = Number(eligibility.loanEligible || 0)
  
  const currentLimit = paymentOption === 'Savings' ? savingsEligible : 
                      paymentOption === 'Loan' ? loanEligible : Infinity
  const overLimit = paymentOption !== 'Cash' && cartTotal > currentLimit
  const canSubmit = cartItems.length > 0 && !overLimit && deliveryBranch && department

  const submitOrder = async () => {
    if (!canSubmit) return
    
    setSubmitting(true)
    setMessage(null)
    
    try {
      const orderData = {
        memberId: memberId,
        deliveryBranchCode: deliveryBranch,
        departmentName: department,
        paymentOption: paymentOption,
        lines: cartItems.map(item => ({
          sku: item.sku,
          qty: item.qty,
          unit_price: item.price
        }))
      }
      
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      })
      
      const data = await res.json()
      
      if (data.ok) {
        // Clear cart from localStorage
        localStorage.removeItem(`cart_${memberId}`)
        
        // Redirect to success page
        router.push(`/shop/success/${data.order_id}?member_id=${memberId}`)
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to submit order' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error. Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading cart...</p>
        </div>
      </div>
    )
  }

  if (!member) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Member data not found</p>
          <button 
            onClick={() => router.push('/shop')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Shop
          </button>
        </div>
      </div>
    )
  }

  return (
    <ProtectedRoute allowedRoles={['member', 'rep', 'admin']}>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        {/* Header */}
        {/* Header - Three Column Grid */}
        <div className="max-w-6xl mx-auto mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Shopping Cart Info */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h1 className="text-xl lg:text-2xl font-bold text-gray-800 mb-2">
                {isAdmin ? 'Admin - Member Cart' : 'Shopping Cart'}
              </h1>
              <p className="text-gray-600 text-sm">
                {isAdmin ? 'Managing cart for member' : 'Review and edit your items before checkout'}
              </p>
              <div className="mt-4">
                {isAdmin ? (
                  <button
                    onClick={() => router.push('/admin/cart')}
                    className="w-full px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 flex items-center justify-center text-sm"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Back to Admin
                  </button>
                ) : (
                  <button
                    onClick={() => router.push(`/shop?mid=${memberId}${isAdmin ? '&admin=true' : ''}`)}
                    className="w-full px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 flex items-center justify-center text-sm"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Back to Shop
                  </button>
                )}
              </div>
            </div>



            {/* Quick Actions */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-3">Quick Actions</h3>
              <div className="space-y-3">
                {isAdmin && (
                  <button
                    onClick={() => router.push(`/shop?member_id=${memberId}&admin=true`)}
                    className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center justify-center text-sm"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M8 11v6h8v-6H8z" />
                    </svg>
                    Shop for Member
                  </button>
                )}
                <div className="text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>Cart Items:</span>
                    <span className="font-semibold">{cartItems.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Value:</span>
                    <span className="font-semibold">₦{cartTotal.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cart Items */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-800">Cart Items</h2>
                <button
                  onClick={addNewItem}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                >
                  Add Item
                </button>
              </div>
              
              {cartItems.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.5 5M7 13l2.5 5m0 0h8.5" />
                  </svg>
                  <p className="text-gray-500 mb-4">Your cart is empty</p>
                  <button
                    onClick={() => router.push(`/shop?mid=${memberId}${isAdmin ? '&admin=true' : ''}`)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Start Shopping
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {cartItems.map((item, index) => (
                    <div key={item.sku} className="border rounded-lg p-4 bg-gray-50 hover:bg-white transition-colors">
                      <div className="space-y-4">
                        {/* Item Selection */}
                        <div>
                          <select
                            value={item.sku}
                            onChange={(e) => updateItemSku(item.sku, e.target.value)}
                            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            {items.map(availableItem => (
                              <option key={availableItem.sku} value={availableItem.sku}>
                                {availableItem.name} - ₦{availableItem.price.toLocaleString()}
                              </option>
                            ))}
                          </select>
                          <div className="text-xs text-gray-500 mt-1">
                            {item.unit} • {item.category}
                          </div>
                        </div>
                        
                        {/* Price */}
                        <div className="text-center bg-blue-50 rounded-lg p-2">
                          <div className="text-lg font-bold text-blue-800">₦{item.price.toLocaleString()}</div>
                          <div className="text-xs text-blue-600">per {item.unit}</div>
                        </div>
                        
                        {/* Quantity Controls - Professional Design */}
                        <div className="flex items-center justify-center">
                          <div className="flex items-center bg-white border-2 border-gray-200 rounded-lg overflow-hidden">
                            <button
                              onClick={() => updateQuantity(item.sku, item.qty - 1)}
                              className="px-4 py-2 bg-gray-50 hover:bg-red-50 text-gray-700 hover:text-red-600 font-semibold transition-colors border-r border-gray-200 min-w-[40px]"
                            >
                              −
                            </button>
                            <input
                              type="number"
                              min={0}
                              value={item.qty}
                              onChange={(e) => updateQuantity(item.sku, e.target.value)}
                              className="w-16 py-2 text-center font-bold text-gray-800 border-0 focus:ring-0 focus:outline-none"
                            />
                            <button
                              onClick={() => updateQuantity(item.sku, item.qty + 1)}
                              className="px-4 py-2 bg-gray-50 hover:bg-green-50 text-gray-700 hover:text-green-600 font-semibold transition-colors border-l border-gray-200 min-w-[40px]"
                            >
                              +
                            </button>
                          </div>
                        </div>
                        
                        {/* Total Price */}
                        <div className="text-center bg-green-50 rounded-lg p-2">
                          <div className="text-lg font-bold text-green-800">
                            ₦{(item.price * item.qty).toLocaleString()}
                          </div>
                          <div className="text-xs text-green-600">Total</div>
                        </div>
                        
                        {/* Remove Button */}
                        <button
                          onClick={() => removeItem(item.sku)}
                          className="w-full px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm font-medium transition-colors flex items-center justify-center"
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Remove Item
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Order Summary & Checkout */}
          <div className="space-y-6">
            {/* Delivery & Department */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Delivery Details</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Branch</label>
                  <select
                    value={deliveryBranch}
                    onChange={(e) => setDeliveryBranch(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option key="select-branch" value="">Select branch</option>
                    {branches.map(branch => (
                      <option key={branch.branch_id} value={branch.code}>
                        {branch.name} ({branch.code})
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option key="select-department" value="">Select department</option>
                    {departments.map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Payment Method */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Payment Method</h3>
              <select
                value={paymentOption}
                onChange={(e) => setPaymentOption(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
              >
                <option key="savings" value="Savings" disabled={savingsEligible <= 0}>
                  Savings {savingsEligible <= 0 ? '(Insufficient Balance)' : ''}
                </option>
                <option key="loan" value="Loan">Loan</option>
                <option key="cash" value="Cash">Cash</option>
              </select>
            </div>

            {/* Order Summary */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Order Summary</h3>
              
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>Items:</span>
                  <span>{cartItems.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total:</span>
                  <span className="font-semibold">₦{cartTotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Limit ({paymentOption}):</span>
                  <span className={overLimit ? 'text-red-600' : 'text-green-600'}>
                    {paymentOption === 'Cash' ? 'No limit' : `₦${currentLimit.toLocaleString()}`}
                  </span>
                </div>
              </div>
              
              {overLimit && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-600 text-sm">
                    Total exceeds {paymentOption} limit. Please reduce quantities or switch payment method.
                  </p>
                </div>
              )}
              
              {message && (
                <div className={`mt-4 p-3 rounded-lg ${
                  message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-600'
                }`}>
                  {message.text}
                </div>
              )}
              
              <button
                onClick={submitOrder}
                disabled={!canSubmit || submitting}
                className={`w-full mt-6 py-3 px-4 rounded-lg font-semibold transition-all duration-200 ${
                  canSubmit && !submitting
                    ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-md hover:shadow-lg'
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
              >
                {submitting ? (
                  <div className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Submitting Order...
                  </div>
                ) : (
                  <div className="flex items-center justify-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Submit Order
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}

export default function CartPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CartPageContent />
    </Suspense>
  )
}