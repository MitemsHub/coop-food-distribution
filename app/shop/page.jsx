// app/shop/page.jsx
'use client'

import React, { useEffect, useMemo, useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import ProtectedRoute from '../components/ProtectedRoute'

function ShopPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isAdmin = searchParams.get('admin') === 'true'

  // Member + lookups
  const [memberId, setMemberId] = useState('')
  const [member, setMember] = useState(null)
  const [branches, setBranches] = useState([])
  const [departments, setDepartments] = useState([])

  // Branches: member (home/reporting) vs delivery (pricing/stock)
  const [memberBranchCode, setMemberBranchCode] = useState('')
  const [deliveryBranchCode, setDeliveryBranchCode] = useState('DUTSE') // default
  const [departmentName, setDepartmentName] = useState('Branch Operations Department')

  // Items/cart
  const [items, setItems] = useState([])
  const [qty, setQty] = useState({})
  const [paymentOption, setPaymentOption] = useState('Loan')

  // Eligibility (exposure-aware)
  const [eligibility, setEligibility] = useState({
    savingsEligible: 0,
    loanEligible: 0,
    outstandingLoansTotal: 0,
    savingsExposure: 0,
    loanExposure: 0,
  })

  // UI state
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState(null)
  const [loadingItems, setLoadingItems] = useState(new Set()) // Track items with pending API calls
  const [inputTimeouts, setInputTimeouts] = useState(new Map()) // Debounce input changes

  // Safe JSON helper
  const safeJson = async (res, label) => {
    const ct = res.headers.get('content-type') || ''
    if (ct.includes('application/json')) return await res.json()
    const text = await res.text()
    throw new Error(`Non-JSON response from ${label} (${res.status}): ${text.slice(0, 300)}`)
  }

  // Save cart data to localStorage whenever quantities change
  useEffect(() => {
    if (memberId && Object.keys(qty).length > 0) {
      const cartItems = Object.entries(qty)
        .filter(([sku, quantity]) => quantity > 0)
        .map(([sku, quantity]) => {
          const item = items.find(it => it.sku === sku)
          return item ? {
            sku,
            name: item.name,
            unit: item.unit,
            category: item.category,
            price: item.price,
            qty: quantity
          } : null
        })
        .filter(Boolean)
      
      localStorage.setItem(`cart_${memberId}`, JSON.stringify(cartItems))
      localStorage.setItem(`member_${memberId}`, JSON.stringify(member))
      localStorage.setItem(`deliveryBranch_${memberId}`, deliveryBranchCode)
      localStorage.setItem(`department_${memberId}`, departmentName)
      localStorage.setItem(`paymentOption_${memberId}`, paymentOption)
    }
  }, [qty, memberId, member, deliveryBranchCode, departmentName, paymentOption, items])

  // Auto-fill member ID from ?mid= and lookup
  useEffect(() => {
    const mid = searchParams?.get('mid')
    if (mid) {
      const upperMid = mid.toUpperCase()
      setMemberId(upperMid)
    }
  }, [searchParams])

  // Auto-lookup when memberId is set from URL
  useEffect(() => {
    if (memberId && searchParams?.get('mid')) {
      lookupMember()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId])

  // Load branches/departments
  useEffect(() => {
    ;(async () => {
      const [{ data: b }, { data: d }] = await Promise.all([
        supabase.from('branches').select('code,name').order('name'),
        supabase.from('departments').select('name').order('name'),
      ])
      setBranches(b || [])
      setDepartments(d || [])
    })()
  }, [])

  // Load items for DELIVERY branch (cycle-scoped view)
  useEffect(() => {
    if (!deliveryBranchCode) return
    ;(async () => {
      try {
        const { data: br, error: brErr } = await supabase
          .from('branches')
          .select('id, code')
          .eq('code', deliveryBranchCode)
          .single()
        if (brErr || !br) { setItems([]); return }

        // Get active cycle
        const { data: activeCycle, error: cycleError } = await supabase
          .from('cycles')
          .select('id')
          .eq('is_active', true)
          .single()
        

        
        if (!activeCycle) {
          setItems([])
          return
        }

        // Get items with real-time stock from inventory status view (fallback to branch_item_prices if view doesn't exist)
        let { data: rows, error } = await supabase
          .from('v_inventory_status')
          .select(`
            sku,
            item_name,
            unit,
            category,
            image_url,
            price,
            initial_stock,
            remaining_after_posted,
            remaining_after_delivered
          `)
          .eq('branch_code', deliveryBranchCode)
          .order('item_name')
        

        
        // Fallback to original query if view doesn't exist
        if (error && error.message.includes('does not exist')) {

          const { data: fallbackRows, error: fallbackError } = await supabase
            .from('branch_item_prices')
            .select(`
              price,
              initial_stock,
              items:item_id(
                item_id,
                name, 
                sku, 
                unit, 
                category,
                image_url
              )
            `)
            .eq('branch_id', br.id)
            .order('name', { foreignTable: 'items' })
          
          rows = fallbackRows
          error = fallbackError

        }
        

        
        if (error) {
  
          setItems([])
          return
        }
        
        // Use remaining_after_posted as available stock (accounts for pending/posted orders)
        const itemsWithStock = (rows || []).map(row => {
          // Handle both v_inventory_status view format and fallback format
          if (row.item_name) {
            // v_inventory_status view format
            const availableStock = Math.max(0, row.remaining_after_posted || 0)

            return {
              sku: row.sku,
              name: row.item_name,
              unit: row.unit,
              category: row.category,
              price: Number(row.price),
              initial_stock: availableStock,
              remaining_after_posted: availableStock, // Set both fields consistently
              image_url: row.image_url
            }
          } else {
            // Fallback branch_item_prices format
            const availableStock = Math.max(0, row.initial_stock || 0)

            return {
              sku: row.items.sku,
              name: row.items.name,
              unit: row.items.unit,
              category: row.items.category,
              price: Number(row.price),
              initial_stock: availableStock,
              remaining_after_posted: availableStock, // Set both fields consistently
              image_url: row.items.image_url
            }
          }
        })

        setItems(itemsWithStock)
        setQty({})
      } catch (e) {
        setItems([])
      }
    })()
  }, [deliveryBranchCode])

  // Load saved cart quantities from localStorage
  useEffect(() => {
    if (memberId && items.length > 0) {
      const savedCart = localStorage.getItem(`cart_${memberId}`)
      if (savedCart) {
        try {
          const cartItems = JSON.parse(savedCart)
          const savedQty = {}
          cartItems.forEach(item => {
            if (items.some(it => it.sku === item.sku)) {
              savedQty[item.sku] = item.qty
            }
          })
          setQty(savedQty)
        } catch (error) {
          console.error('Error loading saved cart:', error)
        }
      }
    }
  }, [memberId, items])

  // Load saved delivery preferences from localStorage
  useEffect(() => {
    if (memberId) {
      const savedDeliveryBranch = localStorage.getItem(`deliveryBranch_${memberId}`)
      const savedDepartment = localStorage.getItem(`department_${memberId}`)
      const savedPayment = localStorage.getItem(`paymentOption_${memberId}`)
      
      if (savedDeliveryBranch) {
        setDeliveryBranchCode(savedDeliveryBranch)
      }
      if (savedDepartment) {
        setDepartmentName(savedDepartment)
      }
      if (savedPayment) {
        setPaymentOption(savedPayment)
      }
    }
  }, [memberId])

  // Lookup member + eligibility
  const lookupMember = async () => {
    setMessage(null)
    if (!memberId) return

    const normalizedMemberId = memberId.trim().toUpperCase()
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
      setMember(null)
      setEligibility({
        savingsEligible: 0,
        loanEligible: 0,
        outstandingLoansTotal: 0,
        savingsExposure: 0,
        loanExposure: 0,
      })
      setMessage({ type: 'error', text: 'Member not found. Please upload members or use a test member.' })
      return
    }

    setMember(data)
    if (data?.branches?.code) {
      setMemberBranchCode(data.branches.code)
      setDeliveryBranchCode(prev => prev || data.branches.code)
    }
    if (data?.departments?.name) setDepartmentName(data.departments.name)

    try {
      const res = await fetch(`/api/members/eligibility?member_id=${encodeURIComponent(normalizedMemberId)}`)
      const json = await safeJson(res, '/api/members/eligibility')
      if (json.ok) setEligibility(json.eligibility)
    } catch (e) {
      console.warn('eligibility fetch failed:', e.message)
    }
  }

  // Eligibility helpers
  const savingsEligible = Number(eligibility.savingsEligible || 0)
  const loanEligible = Number(eligibility.loanEligible || 0)

  // Cart computations
  const cartLines = useMemo(() => {
    return items
      .filter(it => Number(qty[it.sku] || 0) > 0)
      .map(it => {
        const q = Number(qty[it.sku] || 0)
        return { sku: it.sku, name: it.name, price: it.price, qty: q, amount: q * it.price }
      })
  }, [items, qty])

  const cartTotal = useMemo(() => cartLines.reduce((s, l) => s + l.amount, 0), [cartLines])

  const currentLimit = paymentOption === 'Savings'
    ? savingsEligible
    : paymentOption === 'Loan'
    ? loanEligible
    : Number.POSITIVE_INFINITY

  // Calculate remaining limit after current cart total
  const remainingLimit = paymentOption === 'Cash' 
    ? Number.POSITIVE_INFINITY 
    : Math.max(0, currentLimit - cartTotal)

  const overLimit = cartTotal > currentLimit && paymentOption !== 'Cash'
  const canSubmit = !!member && !!deliveryBranchCode && !!departmentName && cartLines.length > 0 && !overLimit && !submitting

  const setQtySafe = useCallback(async (sku, val) => {
    const newQty = Math.max(0, Math.min(9999, Number(val) || 0))
    const currentQty = qty[sku] || 0
    const adjustment = newQty - currentQty
    
    // If no change, return early
    if (adjustment === 0) {
      return
    }
    
    // Find the item to get current stock info
    const item = items.find(it => it.sku === sku)
    if (!item) {
      return
    }
    
    // Check if member and delivery branch are set
    if (!member?.member_id) {
      setMessage({ type: 'error', text: 'Please select a member first' })
      return
    }
    
    if (!deliveryBranchCode) {
      setMessage({ type: 'error', text: 'Please select a delivery branch first' })
      return
    }
    
    // Check stock availability for increases - use real-time available stock
    if (adjustment > 0) {
      const availableStock = item.remaining_after_posted || item.initial_stock || 0
      if (newQty > availableStock) {
        setMessage({ 
          type: 'error', 
          text: `Only ${availableStock} items available. Current cart: ${currentQty}` 
        })
        return
      }
    }
    
    // OPTIMISTIC UPDATE: Update UI immediately for instant feedback
    const previousQty = currentQty
    setQty(prev => ({ ...prev, [sku]: newQty }))
    
    // Add loading state for this item
    setLoadingItems(prev => new Set([...prev, sku]))
    
    // Clear any previous error messages
    if (message?.type === 'error') {
      setMessage(null)
    }
    
    // Handle API call asynchronously
    try {
      const action = adjustment > 0 ? 'reserve' : 'release'
      const response = await fetch('/api/inventory/adjust-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku,
          branchCode: deliveryBranchCode,
          adjustment: Math.abs(adjustment),
          memberId: member.member_id,
          action
        })
      })
      
      const result = await response.json()
      
      if (!response.ok || !result.ok) {
        // ROLLBACK: Revert optimistic update on API failure
        setQty(prev => ({ ...prev, [sku]: previousQty }))
        setMessage({ type: 'error', text: result.error || 'Stock adjustment failed' })
        return
      }
      
      // Note: We don't update local stock here as the API already accounts for the adjustment
      // The optimistic update in qty state is sufficient for UI responsiveness
      // Real stock will be refreshed on page reload or through other mechanisms
      
    } catch (error) {
      // ROLLBACK: Revert optimistic update on network error
      setQty(prev => ({ ...prev, [sku]: previousQty }))
      setMessage({ type: 'error', text: 'Failed to update stock. Please try again.' })
    } finally {
      // Remove loading state for this item
      setLoadingItems(prev => {
        const newSet = new Set(prev)
        newSet.delete(sku)
        return newSet
      })
    }
  }, [items, member, deliveryBranchCode, qty, message, loadingItems])

  // Debounced input handler for better performance
  const handleInputChange = useCallback((sku, value) => {
    // Clear existing timeout for this item
    const currentTimeout = inputTimeouts.get(sku)
    if (currentTimeout) {
      clearTimeout(currentTimeout)
    }
    
    // Update local state immediately for responsive UI
    const newQty = Math.max(0, Math.min(9999, Number(value) || 0))
    setQty(prev => ({ ...prev, [sku]: newQty }))
    
    // Debounce API call by 300ms
    const timeoutId = setTimeout(() => {
      setQtySafe(sku, newQty)
      setInputTimeouts(prev => {
        const newMap = new Map(prev)
        newMap.delete(sku)
        return newMap
      })
    }, 300)
    
    setInputTimeouts(prev => {
      const newMap = new Map(prev)
      newMap.set(sku, timeoutId)
      return newMap
    })
  }, [setQtySafe, inputTimeouts])

  const submitOrder = async () => {
    setSubmitting(true)
    setMessage(null)
    
    // Store current cart for potential rollback
    const currentCart = { ...qty }
    
    try {
      // Convert reserved stock to purchased stock for each item
      const purchasePromises = cartLines.map(async (line) => {
        try {
          const response = await fetch('/api/inventory/adjust-stock', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sku: line.sku,
              branchCode: deliveryBranchCode,
              adjustment: line.qty,
              memberId: member.member_id,
              action: 'purchase'
            })
          })
          
          const result = await response.json()
          if (!response.ok || !result.ok) {
            throw new Error(`Failed to process purchase for ${line.sku}: ${result.error}`)
          }
          
          return result
        } catch (error) {
          console.error(`Purchase processing failed for ${line.sku}:`, error)
          throw error
        }
      })
      
      // Wait for all stock purchases to complete
      await Promise.all(purchasePromises)
      
      // Submit the order
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: member.member_id,
          deliveryBranchCode,          // delivery drives pricing/stock
          departmentName,
          paymentOption,
          lines: cartLines.map(l => ({ sku: l.sku, qty: l.qty })),
        }),
      })

      const json = await safeJson(res, '/api/orders')
      if (!res.ok || !json.ok) {
        throw new Error(json?.error || `Request failed (${res.status})`)
      }

      // Refresh eligibility to reflect the new order's impact on loan balance
      try {
        const eRes = await fetch(`/api/members/eligibility?member_id=${encodeURIComponent(member.member_id)}`)
        const eJson = await safeJson(eRes, '/api/members/eligibility (post-submit)')
        if (eJson.ok) setEligibility(eJson.eligibility)
      } catch (e) {
        console.warn('Failed to refresh eligibility after order submission:', e)
      }

      // Clear cart and redirect on success
      setMessage({ type: 'success', text: `Order submitted! ID: ${json.order_id}. Status: Pending.` })
      setQty({})
      
      // Clear saved cart from localStorage
      if (member?.member_id) {
        localStorage.removeItem(`cart_${member.member_id}`)
      }
      
      router.push(`/shop/success/${json.order_id}?mid=${encodeURIComponent(member.member_id)}`)
      
    } catch (e) {
      console.error('submitOrder error:', e)
      setMessage({ type: 'error', text: e.message })
      
      // Rollback: Release any reserved stock if order submission failed
      try {
        const rollbackPromises = cartLines.map(async (line) => {
          await fetch('/api/inventory/adjust-stock', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sku: line.sku,
              branchCode: deliveryBranchCode,
              adjustment: line.qty,
              memberId: member.member_id,
              action: 'release'
            })
          })
        })
        
        await Promise.all(rollbackPromises)
      } catch (rollbackError) {
        // Rollback failed - this should be logged in production
      }
      
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ProtectedRoute allowedRoles={['member']}>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="p-4 md:p-6 max-w-7xl mx-auto">
          <div className="bg-white rounded-lg xl:rounded-xl shadow-xl p-4 md:p-8 mb-2 lg:mb-3">
            <div className="flex flex-col gap-4 mb-2 lg:mb-3">
              <div className="text-center md:text-left">
                <h1 className="text-xl sm:text-2xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-1 md:mb-2 leading-tight">
                  {isAdmin ? 'Admin - Member Shopping' : 'Coop Food Distribution'}
                </h1>
                <p className="text-xs sm:text-sm md:text-base text-gray-600">
                  {isAdmin ? 'Shopping on behalf of member' : 'Member Shopping Portal'}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center md:justify-end gap-2">
                {memberId && (
                  <>
                    <button
                      onClick={() => router.push(`/orders?member_id=${memberId}${isAdmin ? '&admin=true' : ''}`)}
                      className="inline-flex items-center px-2 py-1.5 sm:px-3 sm:py-2 md:px-4 md:py-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-full transition-all duration-200 text-xs sm:text-sm md:text-base whitespace-nowrap"
                    >
                      <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Orders
                    </button>
                    <button
                      onClick={() => router.push(`/cart?member_id=${memberId}${isAdmin ? '&admin=true' : ''}`)}
                      className="inline-flex items-center px-2 py-1.5 sm:px-3 sm:py-2 md:px-4 md:py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-full transition-all duration-200 text-xs sm:text-sm md:text-base whitespace-nowrap"
                    >
                      <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.5 5M7 13l2.5 5m0 0h8.5" />
                      </svg>
                      Cart ({cartLines.length})
                    </button>
                  </>
                )}
                {isAdmin ? (
                  <button
                    onClick={() => router.push('/admin/cart')}
                    className="inline-flex items-center px-2 py-1.5 sm:px-3 sm:py-2 md:px-4 md:py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-full transition-all duration-200 text-xs sm:text-sm md:text-base whitespace-nowrap"
                  >
                    <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Back to Admin
                  </button>
                ) : (
                  <a href="/" className="inline-flex items-center px-2 py-1.5 sm:px-3 sm:py-2 md:px-4 md:py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition-all duration-200 text-xs sm:text-sm md:text-base whitespace-nowrap">
                    <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Back to Home
                  </a>
                )}
              </div>
            </div>
            {/* Member Lookup */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4 md:p-6 mb-2 lg:mb-3">
              <h2 className="text-base sm:text-lg md:text-xl font-semibold text-gray-800 mb-2 lg:mb-3 flex items-center">
                <svg className="w-4 h-4 md:w-5 md:h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Member Lookup
              </h2>
              <div className="grid grid-cols-2 gap-3 md:gap-4">
                <div className="col-span-1">
                  <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1 md:mb-2">Member ID</label>
                  <input
                    type="text"
                    value={memberId}
                    onChange={e => setMemberId(e.target.value.toUpperCase())}
                    className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 md:px-4 md:py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 text-sm"
                    placeholder="e.g. A12345"
                  />
                </div>
                <div className="col-span-1 flex items-end">
                  <button 
                    onClick={lookupMember} 
                    className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-4 py-2 md:px-6 md:py-3 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl text-sm"
                  >
                    <svg className="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    Lookup
                  </button>
                </div>
              </div>

              {member && (
                <div className="mt-4 md:mt-6 bg-white rounded-lg p-3 sm:p-4 md:p-6 shadow-sm border border-gray-100">
                  <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-800 mb-2 lg:mb-3">Member Information</h3>
                  <div className="grid grid-cols-2 gap-2 sm:gap-3 md:gap-4">
                    <div className="bg-gray-50 rounded-lg p-2 sm:p-3 md:p-4">
                      <div className="text-xs text-gray-600 mb-1">Full Name</div>
                      <div className="font-semibold text-gray-900 text-xs sm:text-sm md:text-base break-words">{member.full_name}</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-2 sm:p-3 md:p-4">
                      <div className="text-xs text-green-600 mb-1">Savings (Coop)</div>
                      <div className="font-semibold text-green-700 text-xs sm:text-sm md:text-base">₦{Number(member.savings || 0).toLocaleString()}</div>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-2 sm:p-3 md:p-4">
                      <div className="text-xs text-blue-600 mb-1">Loans (Coop)</div>
                      <div className="font-semibold text-blue-700 text-xs sm:text-sm md:text-base">₦{Number(member.loans || 0).toLocaleString()}</div>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-2 sm:p-3 md:p-4">
                      <div className="text-xs text-orange-600 mb-1">Shopping Exposure</div>
                      <div className="font-semibold text-orange-700 text-xs sm:text-sm md:text-base">₦{Number(eligibility.loanExposure || 0).toLocaleString()}</div>
                    </div>
                    <div className="bg-red-50 rounded-lg p-2 sm:p-3 md:p-4">
                      <div className="text-xs text-red-600 mb-1">Outstanding Total</div>
                      <div className="font-semibold text-red-700 text-xs sm:text-sm md:text-base">₦{Number(eligibility.outstandingLoansTotal || 0).toLocaleString()}</div>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-2 sm:p-3 md:p-4">
                      <div className="text-xs text-purple-600 mb-1">Global Limit</div>
                      <div className="font-semibold text-purple-700 text-xs sm:text-sm md:text-base">₦{Number(member.global_limit || 0).toLocaleString()}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Branches & Department */}
            <div className="bg-white rounded-xl p-4 md:p-6 shadow-lg border border-gray-100 mb-2 lg:mb-3">
              <h2 className="text-base sm:text-lg md:text-xl font-semibold text-gray-800 mb-2 lg:mb-3 flex items-center">
                <svg className="w-4 h-4 md:w-5 md:h-5 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Branch & Department Selection
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 md:gap-6">
                <div>
                  <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1 md:mb-2">Member Branch</label>
                  <input 
                    value={memberBranchCode || ''} 
                    readOnly 
                    className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 md:px-4 md:py-3 bg-gray-50 text-gray-600 text-sm" 
                  />
                </div>
                <div>
                  <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1 md:mb-2">Delivery Location</label>
                  <select
                    value={deliveryBranchCode}
                    onChange={e => setDeliveryBranchCode(e.target.value)}
                    className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 md:px-4 md:py-3 focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all duration-200 text-sm"
                  >
                    <option key="select-delivery-branch" value="">Select delivery branch</option>
                    {branches.map(b => (
                      <option key={b.code} value={b.code}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1 md:mb-2">Department</label>
                  <select
                    value={departmentName}
                    onChange={e => setDepartmentName(e.target.value)}
                    className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 md:px-4 md:py-3 focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all duration-200 text-sm"
                  >
                    <option key="select-department" value="">Select department</option>
                    {departments.map(d => (
                      <option key={d.name} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>
                   <div className="mt-3 md:mt-4 grid grid-cols-2 gap-3 md:gap-4">
                     <div className="bg-green-50 rounded-lg p-3 md:p-4 border border-green-200">
                       <div className="text-xs md:text-sm text-green-600 mb-1">Savings Limit</div>
                       <div className="text-base md:text-lg font-semibold text-green-700">₦{savingsEligible.toLocaleString()}</div>
                     </div>
                     <div className="bg-blue-50 rounded-lg p-3 md:p-4 border border-blue-200">
                       <div className="text-xs md:text-sm text-blue-600 mb-1">Loan Limit</div>
                       <div className="text-base md:text-lg font-semibold text-blue-700">₦{loanEligible.toLocaleString()}</div>
                     </div>
                   </div>
                 </div>
               </div>
             </div>

             {/* Payment Method */}
            <div className="bg-white rounded-xl p-4 md:p-6 shadow-lg border border-gray-100 mb-2 lg:mb-3">
              <h2 className="text-base sm:text-lg md:text-xl font-semibold text-gray-800 mb-2 lg:mb-3 flex items-center">
                <svg className="w-4 h-4 md:w-5 md:h-5 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                Payment Method
              </h2>
               <div className="max-w-md">
                 <select
                   value={paymentOption}
                   onChange={e => setPaymentOption(e.target.value)}
                   className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 md:px-4 md:py-3 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all duration-200 text-sm"
                 >
                   <option key="savings" value="Savings" disabled={savingsEligible <= 0}>Savings {savingsEligible <= 0 ? '(Insufficient Balance)' : ''}</option>
                <option key="loan" value="Loan">Loan</option>
                <option key="cash" value="Cash">Cash</option>
                 </select>
               </div>
             </div>

            {/* Items */}
            <div className="bg-white rounded-xl p-4 md:p-6 shadow-lg border border-gray-100 mb-2 lg:mb-3">
              <h2 className="text-base sm:text-lg md:text-xl font-semibold text-gray-800 mb-2 lg:mb-3 flex items-center">
                <svg className="w-4 h-4 md:w-5 md:h-5 mr-2 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                Available Items — {deliveryBranchCode || 'Select delivery branch'}
              </h2>
              {items.length === 0 && (
                <div className="text-center py-8 sm:py-12">
                  <svg className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-gray-300 mb-2 lg:mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  <p className="text-sm sm:text-base text-gray-500">No items configured for this branch.</p>
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-2 lg:gap-3 xl:gap-4">
                {React.useMemo(() => items.map(it => {
                  // Pre-calculate all values to avoid repeated calculations in render
                  const currentQty = qty[it.sku] || 0
                  const availableStock = it.remaining_after_posted || it.initial_stock || 0
                  // Calculate remaining stock after current cart quantity
                  const remainingStock = Math.max(0, availableStock - currentQty)
                  const isLoading = loadingItems.has(it.sku)
                  const canDecrease = currentQty > 0
                  const canIncrease = availableStock > 0 && currentQty < availableStock
                  
                  const stockColorClass = remainingStock > 10 ? 'bg-green-100 text-green-700' : 
                                         remainingStock > 0 ? 'bg-yellow-100 text-yellow-700' : 
                                         'bg-red-100 text-red-700'
                  
                  const decreaseButtonClass = 'shop-button w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 rounded-full font-bold transition-colors duration-200 flex items-center justify-center text-sm md:text-base ' + (canDecrease ? 'bg-gray-100 hover:bg-gray-200 text-gray-700 cursor-pointer' : 'bg-gray-100 text-gray-400 cursor-not-allowed')
                  
                  const increaseButtonClass = 'shop-button w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 rounded-full font-bold transition-colors duration-200 flex items-center justify-center text-sm md:text-base ' + (canIncrease ? 'bg-orange-100 hover:bg-orange-200 text-orange-700 cursor-pointer' : 'bg-orange-100 text-orange-400 cursor-not-allowed')
                  
                  return (
                  <div key={it.sku} className="shop-item-card bg-gradient-to-br from-white to-gray-50 border-2 border-gray-100 rounded-lg xl:rounded-xl p-2 lg:p-3 xl:p-4 shadow-sm hover:shadow-lg hover:border-orange-200 transition-all duration-300">
                    {/* Item Image */}
                    <div className="mb-2 lg:mb-3">
                      <div className="w-full h-28 lg:h-32 xl:h-36 bg-gray-100 rounded-lg overflow-hidden mb-2 lg:mb-3 flex items-center justify-center">
                        <img
                          src={it.image_url || '/images/items/placeholder.svg'}
                          alt={it.name}
                          className="max-w-full max-h-full object-contain"
                          onError={(e) => {
                            e.target.src = '/images/items/placeholder.svg'
                          }}
                        />
                      </div>
                      <div className="font-bold text-sm md:text-lg text-gray-900 mb-1 leading-tight break-words">{it.name}</div>
                      <div className="text-xs md:text-sm text-gray-500 mb-2 break-words">{it.unit} • {it.category}</div>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                        <div className="text-base md:text-xl font-bold text-orange-600">₦{it.price.toLocaleString()}</div>
                        <div className={`text-xs sm:text-xs md:text-sm px-2 py-1 rounded-full text-center whitespace-nowrap font-medium ${stockColorClass}`}>
                          Stock: {remainingStock}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-2 md:gap-3">
                      <>
                        <button 
                           className={decreaseButtonClass}
                           onClick={() => setQtySafe(it.sku, currentQty - 1)}
                           type="button"
                         >
                           <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                           </svg>
                             </button>
                         <input
                            type="number"
                            min={0}
                            max={availableStock}
                            value={currentQty}
                            onChange={(e) => handleInputChange(it.sku, e.target.value)}

                            className="w-12 h-7 sm:w-16 sm:h-8 md:w-20 md:h-10 border-2 border-gray-200 rounded-lg text-center font-semibold focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all duration-200 text-xs sm:text-sm disabled:opacity-50"
                          />
                         <button 
                             className={increaseButtonClass}
                             onClick={() => setQtySafe(it.sku, currentQty + 1)}
                             type="button"
                           >
                             <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                             </svg>
                           </button>
                       </>
                     </div>
                   </div>
                 )
               }), [items, qty, loadingItems])}
              </div>
            </div>

             {/* Cart */}
             <div className="sticky bottom-2 md:bottom-4 bg-white rounded-xl shadow-lg border border-gray-200 p-3 md:p-4 backdrop-blur-sm">
               <div className="flex items-center justify-between mb-2 md:mb-3">
                 <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-800 flex items-center">
                   <svg className="w-4 h-4 md:w-5 md:h-5 mr-1 md:mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.5 5M7 13l2.5 5m0 0h8.5" />
                   </svg>
                   Shopping Cart
                 </h3>
               </div>
               
               <div className="grid grid-cols-4 gap-1 sm:gap-2 md:gap-3 mb-2 lg:mb-3">
                 <div className="bg-blue-50 rounded-lg p-1.5 sm:p-2 md:p-3 text-center">
                   <div className="text-xs text-blue-600 mb-0.5 lg:mb-1">Items in Cart</div>
                   <div className="text-xs sm:text-xs md:text-sm font-bold text-blue-700">{cartLines.length}</div>
                 </div>
                 <div className="bg-green-50 rounded-lg p-1.5 sm:p-2 md:p-3 text-center">
                   <div className="text-xs text-green-600 mb-0.5 lg:mb-1">Cart Total</div>
                   <div className="text-xs sm:text-xs md:text-sm font-bold text-green-700">₦{cartTotal.toLocaleString()}</div>
                 </div>
                 <div className={`rounded-lg p-1.5 sm:p-2 md:p-3 text-center ${
                   overLimit ? 'bg-red-50' : 'bg-purple-50'
                 }`}>
                   <div className={`text-xs mb-0.5 lg:mb-1 ${
                     overLimit ? 'text-red-600' : 'text-purple-600'
                   }`}>Remaining ({paymentOption})</div>
                   <div className={`text-xs sm:text-xs md:text-sm font-bold ${
                     overLimit ? 'text-red-700' : 'text-purple-700'
                   }`}>
                     {paymentOption === 'Cash' ? 'No limit' : `₦${remainingLimit.toLocaleString()}`}
                   </div>
                 </div>
                 <div className="flex items-center justify-center">
                   <button
                     disabled={cartLines.length === 0}
                     onClick={() => router.push(`/cart?member_id=${memberId}${isAdmin ? '&admin=true' : ''}`)}
                     className={`w-full py-2 md:py-3 px-2 md:px-3 rounded-lg font-semibold text-xs md:text-sm transition-all duration-200 ${
                       cartLines.length > 0
                         ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-md hover:shadow-lg transform hover:scale-105' 
                         : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                     }`}
                   >
                     <div className="flex items-center justify-center">
                       <svg className="w-3 h-3 md:w-4 md:h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.5 5M7 13l2.5 5m0 0h8.5" />
                       </svg>
                       Go to Cart
                     </div>
                   </button>
                 </div>
               </div>
               </div>
        {overLimit && (
          <div className="text-red-600 text-sm mt-2">
            Total exceeds {paymentOption} limit. Reduce quantities or switch payment method.
          </div>
        )}
        {message && (
          <div className={`mt-3 text-sm ${message.type === 'success' ? 'text-green-700' : 'text-red-700'}`}>
            {message.text}
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
}

export default function ShopPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ShopPageContent />
    </Suspense>
  )
}