// app/shop/page.jsx
'use client'

import React, { useEffect, useMemo, useState, useCallback, Suspense } from 'react'
import Image from 'next/image'
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
  const [deliveryBranchCode, setDeliveryBranchCode] = useState('') // Remove default to show placeholder
  const [departmentName, setDepartmentName] = useState('') // Remove default to show placeholder

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
  const [goingToCart, setGoingToCart] = useState(false)
  const [message, setMessage] = useState(null)
  const [loadingItems, setLoadingItems] = useState(new Set()) // Track items with pending API calls
  const [inputTimeouts, setInputTimeouts] = useState(new Map()) // Debounce input changes
  const [lookingUpMember, setLookingUpMember] = useState(false) // Track member lookup loading

  // Safe JSON helper
  const safeJson = async (res, label) => {
    const ct = res.headers.get('content-type') || ''
    if (ct.includes('application/json')) return await res.json()
    const text = await res.text()
    throw new Error(`Non-JSON response from ${label} (${res.status}): ${text.slice(0, 300)}`)
  }

  // Update member home branch
  const updateMemberBranch = async (newCode) => {
    try {
      if (!memberId) {
        setMessage({ type: 'error', text: 'Please select a member first' })
        return
      }
      const res = await fetch('/api/members/update-branch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, branchCode: newCode })
      })
      const json = await safeJson(res, '/api/members/update-branch')
      if (!json.ok) throw new Error(json.error || 'Failed to update member branch')
      setMemberBranchCode(newCode)
      setMessage({ type: 'success', text: `Member branch updated to ${json.branch?.name || newCode}` })
    } catch (e) {
      setMessage({ type: 'error', text: e.message })
    }
  }

  // Update member department
  const updateMemberDepartment = async (newName) => {
    try {
      if (!memberId) {
        setMessage({ type: 'error', text: 'Please select a member first' })
        return
      }
      const res = await fetch('/api/members/update-department', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, departmentName: newName })
      })
      const json = await safeJson(res, '/api/members/update-department')
      if (!json.ok) throw new Error(json.error || 'Failed to update member department')
      setDepartmentName(newName)
      setMessage({ type: 'success', text: `Member department updated to ${json.department?.name || newName}` })
    } catch (e) {
      setMessage({ type: 'error', text: e.message })
    }
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
      
      // Don't auto-load saved values on login - let member make fresh selections
    })()
  }, [memberId])

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

        // Get items with demand tracking data from inventory status view (fallback to branch_item_prices if view doesn't exist)
        // Filter out zero-price items
        let { data: rows, error } = await supabase
          .from('v_inventory_status')
          .select(`
            sku,
            item_name,
            unit,
            category,
            image_url,
            price,
            demand_tracking_mode,
            total_demand,
            pending_demand,
            confirmed_demand,
            delivered_demand
          `)
          .eq('branch_code', deliveryBranchCode)
          .gt('price', 0)
          .order('item_name')
        

        
        // Fallback to original query if view doesn't exist
        if (error && error.message.includes('does not exist')) {

          const { data: fallbackRows, error: fallbackError } = await supabase
            .from('branch_item_prices')
            .select(`
              price,
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
            .gt('price', 0)
            .order('name', { foreignTable: 'items' })
          
          rows = fallbackRows
          error = fallbackError

        }
        

        
        if (error) {
  
          setItems([])
          return
        }
        
        // Process items for demand tracking mode
        const itemsWithDemand = (rows || []).map(row => {
          // Handle both v_inventory_status view format and fallback format
          if (row.item_name) {
            // v_inventory_status view format
            return {
              sku: row.sku,
              name: row.item_name,
              unit: row.unit,
              category: row.category,
              price: Number(row.price),
              image_url: row.image_url,
              demand_tracking_mode: row.demand_tracking_mode,
              total_demand: row.total_demand || 0,
              pending_demand: row.pending_demand || 0,
              confirmed_demand: row.confirmed_demand || 0,
              delivered_demand: (row.delivered_demand ?? row.delivered_qty ?? 0)
            }
          } else {
            // Fallback branch_item_prices format - pure demand tracking
            return {
              sku: row.items.sku,
              name: row.items.name,
              unit: row.items.unit,
              category: row.items.category,
              price: Number(row.price),
              image_url: row.items.image_url,
              demand_tracking_mode: true, // Always use demand tracking
              total_demand: 0,
              pending_demand: 0,
              confirmed_demand: 0,
              delivered_demand: 0
            }
          }
        })

        setItems(itemsWithDemand)
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

  // Load saved preferences from localStorage (only during session navigation, not on fresh login)
  useEffect(() => {
    if (memberId) {
      const savedPayment = localStorage.getItem(`paymentOption_${memberId}`)
      
      if (savedPayment) {
        setPaymentOption(savedPayment)
      }
      
      // Only load delivery branch and department if coming from cart (session navigation)
      // Check if we have a referrer or navigation state indicating we're coming from cart
      const isFromCart = document.referrer.includes('/cart') || sessionStorage.getItem('navigatingFromCart')
      
      if (isFromCart) {
        const savedDeliveryBranch = localStorage.getItem(`deliveryBranch_${memberId}`)
        const savedDepartment = localStorage.getItem(`department_${memberId}`)
        
        if (savedDeliveryBranch) {
          setDeliveryBranchCode(savedDeliveryBranch)
        }
        if (savedDepartment) {
          setDepartmentName(savedDepartment)
        }
      }
      
      // Clear the navigation flag
      sessionStorage.removeItem('navigatingFromCart')
    }
  }, [memberId])

  // Lookup member + eligibility
  const lookupMember = async () => {
    setMessage(null)
    if (!memberId) return

    setLookingUpMember(true)
    
    try {
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
        // Don't auto-set delivery branch - let member choose
      }
      // Don't auto-set department - let member choose

      try {
        const res = await fetch(`/api/members/eligibility?member_id=${encodeURIComponent(normalizedMemberId)}`)
        const json = await safeJson(res, '/api/members/eligibility')
        if (json.ok) setEligibility(json.eligibility)
      } catch (e) {
        console.warn('eligibility fetch failed:', e.message)
      }
    } catch (error) {
      console.error('Member lookup error:', error)
      setMessage({ type: 'error', text: 'Error looking up member. Please try again.' })
    } finally {
      setLookingUpMember(false)
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

  // Loan interest computation (13% applied to cart total when payment=Loan)
  const LOAN_INTEREST_RATE = 0.13
  const loanInterest = useMemo(() => (
    paymentOption === 'Loan' ? Math.round(cartTotal * LOAN_INTEREST_RATE) : 0
  ), [paymentOption, cartTotal])
  const totalWithInterest = useMemo(() => (
    paymentOption === 'Loan' ? cartTotal + loanInterest : cartTotal
  ), [paymentOption, cartTotal, loanInterest])

  const currentLimit = paymentOption === 'Savings'
    ? savingsEligible
    : paymentOption === 'Loan'
    ? loanEligible
    : Number.POSITIVE_INFINITY

  // Remaining limit should respect selected payment option.
  // For Loan, factor 13% interest into the remaining limit calculation;
  // For Savings, use principal cart total;
  // For Cash, there is no limit.
  const remainingLimit = useMemo(() => {
    if (paymentOption === 'Cash') return Number.POSITIVE_INFINITY
    if (paymentOption === 'Loan') {
      return Math.max(0, loanEligible - totalWithInterest)
    }
    // Savings
    return Math.max(0, savingsEligible - cartTotal)
  }, [paymentOption, loanEligible, savingsEligible, cartTotal, totalWithInterest])

  const overLimit = paymentOption !== 'Cash' && (
    paymentOption === 'Loan' ? totalWithInterest > currentLimit : cartTotal > currentLimit
  )
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
    
    // Demand tracking mode - no stock limits, allow unlimited ordering
    
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
                    disabled={lookingUpMember}
                    className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 md:px-4 md:py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 text-sm disabled:bg-gray-50 disabled:cursor-not-allowed"
                    placeholder="e.g. A12345"
                  />
                </div>
                <div className="col-span-1 flex items-end">
                  <button 
                    onClick={lookupMember} 
                    disabled={lookingUpMember || !memberId.trim()}
                    className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-4 py-2 md:px-6 md:py-3 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl text-sm disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:from-blue-500 disabled:hover:to-blue-600"
                  >
                    {lookingUpMember ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2 inline-block"></div>
                        Looking up...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        Lookup
                      </>
                    )}
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
                  <select
                    value={memberBranchCode || ''}
                    onChange={e => updateMemberBranch(e.target.value)}
                    className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 md:px-4 md:py-3 focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all duration-200 text-sm"
                  >
                    <option key="select-member-branch" value="">Select member branch</option>
                    {branches.map(b => (
                      <option key={b.code} value={b.code}>{b.name}</option>
                    ))}
                  </select>
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
                    onChange={e => updateMemberDepartment(e.target.value)}
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
               
               {/* Savings Payment Instructions */}
               {paymentOption === 'Savings' && savingsEligible > 0 && (
                 <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                   <div className="flex items-start">
                     <svg className="w-5 h-5 text-green-600 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                     </svg>
                     <div>
                       <h3 className="text-sm font-semibold text-green-800 mb-2">Savings Payment Information</h3>
                       <p className="text-sm text-green-700">
                         <strong>Important:</strong> Members can only use 50% of their total savings balance for purchases. Your current available savings limit is ₦{savingsEligible.toLocaleString()}.
                       </p>
                     </div>
                   </div>
                 </div>
               )}

               {/* Loan Payment Instructions */}
               {paymentOption === 'Loan' && (
                 <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                   <div className="flex items-start">
                     <svg className="w-5 h-5 text-orange-600 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                     </svg>
                     <div>
                       <h3 className="text-sm font-semibold text-orange-800 mb-2">Loan Payment Information</h3>
                       <p className="text-sm text-orange-700">
                         Interest Rate: A 13% interest will be charged on all items purchased using the loan payment option.
                       </p>
                       <p className="text-sm text-orange-700 mt-2">
                         Kindly note that all members have access to an additional N300,000 shopping loan facility. The total shopping loan amount available to eligible member when using the loan option is capped at N1,000,000.
                       </p>
                     </div>
                   </div>
                 </div>
               )}

               {/* Cash Payment Instructions */}
               {paymentOption === 'Cash' && (
                 <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                   <div className="flex items-start">
                     <svg className="w-5 h-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                     </svg>
                     <div>
                       <h3 className="text-sm font-semibold text-blue-800 mb-2">Cash Payment Instructions</h3>
                       <p className="text-sm text-blue-700 mb-3">
                         After placing your order, kindly send your payment receipt to the Cooperative for verification.
                       </p>
                       <div className="mb-3 p-3 bg-white border border-blue-200 rounded-lg">
                         <div className="text-xs font-semibold text-gray-700 mb-1">Bank Transfer Details</div>
                         <div className="text-sm text-gray-800">Fidelity Bank</div>
                         <div className="text-sm text-gray-800">Account Number: 5080056982</div>
                         <div className="text-sm text-gray-800">Account Name: CBN Staff Multipurpose Coop. Soc. Ltd.</div>
                       </div>
                       <a 
                         href="https://wa.me/+2349061388502" 
                         target="_blank" 
                         rel="noopener noreferrer"
                         className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors duration-200"
                       >
                         <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                           <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.097z"/>
                         </svg>
                         Send Receipt via WhatsApp
                       </a>
                     </div>
                   </div>
                 </div>
               )}
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
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-6 2xl:grid-cols-7 gap-2 lg:gap-3 xl:gap-4">
                {React.useMemo(() => items.map(it => {
                  // Pre-calculate all values to avoid repeated calculations in render
                  const currentQty = qty[it.sku] || 0
                  const isLoading = loadingItems.has(it.sku)
                  const canDecrease = currentQty > 0
                  // In demand tracking mode, always allow ordering (no stock constraints)
                  const canIncrease = it.demand_tracking_mode || false // For traditional stock mode, would need stock data
                  
                  // Different color logic for demand tracking vs stock tracking
                  const stockColorClass = it.demand_tracking_mode ? 
                    // For demand tracking: consistent green color for all demand values
                    'bg-green-100 text-green-700' :
                    // For stock tracking: would need stock data to determine color
                    'bg-gray-100 text-gray-700'
                  
                  const decreaseButtonClass = 'shop-button w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 rounded-full font-bold transition-colors duration-200 flex items-center justify-center text-sm md:text-base ' + (canDecrease ? 'bg-gray-100 hover:bg-gray-200 text-gray-700 cursor-pointer' : 'bg-gray-100 text-gray-400 cursor-not-allowed')
                  
                  const increaseButtonClass = 'shop-button w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 rounded-full font-bold transition-colors duration-200 flex items-center justify-center text-sm md:text-base ' + (canIncrease ? 'bg-orange-100 hover:bg-orange-200 text-orange-700 cursor-pointer' : 'bg-orange-100 text-orange-400 cursor-not-allowed')
                  
                  return (
                  <div key={it.sku} className="shop-item-card bg-gradient-to-br from-white to-gray-50 border-2 border-gray-100 rounded-lg xl:rounded-xl p-2 lg:p-3 xl:p-4 shadow-sm hover:shadow-lg hover:border-orange-200 transition-all duration-300">
                    {/* Item Image */}
                    <div className="mb-2 lg:mb-3">
                      <div className="relative w-full h-28 lg:h-32 xl:h-36 bg-gray-100 rounded-lg overflow-hidden mb-2 lg:mb-3 flex items-center justify-center">
                        <Image
                          src={it.image_url || '/images/items/placeholder.svg'}
                          alt={it.name}
                          fill
                          sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 15vw"
                          className="object-contain"
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.src = '/images/items/placeholder.svg'
                          }}
                        />
                      </div>
                      <div className="font-bold text-sm md:text-lg text-gray-900 mb-1 leading-tight break-words">{it.name}</div>
                      <div className="text-xs md:text-sm text-gray-500 mb-2 break-words">{it.unit} • {it.category}</div>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                        <div className="text-sm lg:text-base xl:text-lg font-bold text-orange-600">₦{it.price.toLocaleString()}</div>
                        <div className={`text-xs sm:text-xs md:text-sm px-2 py-1 rounded-full text-center whitespace-nowrap font-medium ${stockColorClass}`}>
                          {it.demand_tracking_mode ? `Demand: ${it.total_demand || 0}` : `No Stock Data`}
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
                            max={it.demand_tracking_mode ? 999 : availableStock}
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
               
               <div className={`${paymentOption === 'Loan' ? 'grid grid-cols-5' : 'grid grid-cols-4'} gap-1 sm:gap-2 md:gap-3 mb-2 lg:mb-3`}>
                 <div className="bg-blue-50 rounded-lg p-1.5 sm:p-2 md:p-3 text-center">
                   <div className="text-xs text-blue-600 mb-0.5 lg:mb-1">Items in Cart</div>
                   <div className="text-xs sm:text-xs md:text-sm font-bold text-blue-700">{cartLines.length}</div>
                 </div>
                 <div className="bg-green-50 rounded-lg p-1.5 sm:p-2 md:p-3 text-center">
                   <div className="text-xs text-green-600 mb-0.5 lg:mb-1">Cart Total</div>
                   <div className="text-xs sm:text-xs md:text-sm font-bold text-green-700">₦{cartTotal.toLocaleString()}</div>
                 </div>
                 {paymentOption === 'Loan' && (
                   <div className="bg-orange-50 rounded-lg p-1.5 sm:p-2 md:p-3 text-center">
                     <div className="text-xs text-orange-600 mb-0.5 lg:mb-1">Interest (13%)</div>
                     <div className="text-xs sm:text-xs md:text-sm font-bold text-orange-700">₦{loanInterest.toLocaleString()}</div>
                   </div>
                 )}
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
                     disabled={cartLines.length === 0 || goingToCart}
                     onClick={async () => {
                       setGoingToCart(true)
                       router.push(`/cart?member_id=${memberId}${isAdmin ? '&admin=true' : ''}`)
                     }}
                     className={`w-full py-2 md:py-3 px-2 md:px-3 rounded-lg font-semibold text-xs md:text-sm transition-all duration-200 ${
                       cartLines.length > 0 && !goingToCart
                         ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-md hover:shadow-lg transform hover:scale-105' 
                         : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                     }`}
                   >
                     {goingToCart ? (
                       <div className="flex items-center justify-center">
                         <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                           <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                           <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                         </svg>
                         Loading...
                       </div>
                     ) : (
                       <div className="flex items-center justify-center">
                         <svg className="w-3 h-3 md:w-4 md:h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.5 5M7 13l2.5 5m0 0h8.5" />
                         </svg>
                         Go to Cart
                       </div>
                     )}
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