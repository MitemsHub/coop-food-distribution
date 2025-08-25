// app/shop/page.jsx
'use client'

import { useEffect, useMemo, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../lib/supabaseClient'
import ProtectedRoute from '../components/ProtectedRoute'

function ShopPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

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

  // Safe JSON helper
  const safeJson = async (res, label) => {
    const ct = res.headers.get('content-type') || ''
    if (ct.includes('application/json')) return await res.json()
    const text = await res.text()
    throw new Error(`Non-JSON response from ${label} (${res.status}): ${text.slice(0, 300)}`)
  }

  // Auto-fill member ID from ?mid= and lookup
  useEffect(() => {
    const mid = searchParams?.get('mid')
    if (mid) {
      setMemberId(mid)
      // let the state set then lookup
      setTimeout(() => { lookupMember() }, 0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

        const { data: rows, error } = await supabase
          .from('v_branch_item_prices_active') // cycle-scoped view
          .select(`
            price,
            initial_stock,
            items:item_id(name, sku, unit, category)
          `)
          .eq('branch_id', br.id)
          .order('name', { foreignTable: 'items' })

        if (error) {
          console.error('items load error:', error.message)
          setItems([])
          return
        }

        const mapped = (rows || []).map(r => ({
          sku: r.items.sku,
          name: r.items.name,
          unit: r.items.unit,
          category: r.items.category,
          price: Number(r.price),
          initial_stock: Number(r.initial_stock),
        }))
        setItems(mapped)
        setQty({})
      } catch (e) {
        console.error('items fetch failed:', e)
        setItems([])
      }
    })()
  }, [deliveryBranchCode])

  // Lookup member + eligibility
  const lookupMember = async () => {
    setMessage(null)
    if (!memberId) return

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
      .eq('member_id', memberId.trim())
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
      const res = await fetch(`/api/members/eligibility?id=${encodeURIComponent(memberId.trim())}`)
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

  const overLimit = cartTotal > currentLimit && paymentOption !== 'Cash'
  const canSubmit = !!member && !!deliveryBranchCode && !!departmentName && cartLines.length > 0 && !overLimit && !submitting

  const setQtySafe = (sku, val) => {
    const n = Math.max(0, Math.min(9999, Number(val) || 0))
    setQty(prev => ({ ...prev, [sku]: n }))
  }

  const submitOrder = async () => {
    setSubmitting(true)
    setMessage(null)
    try {
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

      // Optional: refresh eligibility
      try {
        const eRes = await fetch(`/api/members/eligibility?id=${encodeURIComponent(member.member_id)}`)
        const eJson = await safeJson(eRes, '/api/members/eligibility (post-submit)')
        if (eJson.ok) setEligibility(eJson.eligibility)
      } catch {}

      setMessage({ type: 'success', text: `Order submitted! ID: ${json.order_id}. Status: Pending.` })
      setQty({})
      router.push(`/shop/success/${json.order_id}?mid=${encodeURIComponent(member.member_id)}`)
    } catch (e) {
      console.error('submitOrder error:', e)
      setMessage({ type: 'error', text: e.message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ProtectedRoute allowedRoles={['member']}>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="p-6 max-w-7xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                  Coop Food Distribution
                </h1>
                <p className="text-gray-600">Member Shopping Portal</p>
              </div>
              <a href="/" className="inline-flex items-center px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition-all duration-200">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Home
              </a>
            </div>
            {/* Member Lookup */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Member Lookup
              </h2>
              <div className="flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-64">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Member ID</label>
                  <input
                    value={memberId}
                    onChange={e => setMemberId(e.target.value)}
                    className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200"
                    placeholder="e.g. A12345"
                  />
                </div>
                <button 
                  onClick={lookupMember} 
                  className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  <svg className="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Lookup
                </button>
              </div>

              {member && (
                <div className="mt-6 bg-white rounded-lg p-6 shadow-sm border border-gray-100">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Member Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="text-sm text-gray-600 mb-1">Full Name</div>
                      <div className="font-semibold text-gray-900">{member.full_name}</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4">
                      <div className="text-sm text-green-600 mb-1">Savings (Core)</div>
                      <div className="font-semibold text-green-700">₦{Number(member.savings || 0).toLocaleString()}</div>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-4">
                      <div className="text-sm text-blue-600 mb-1">Loans (Core)</div>
                      <div className="font-semibold text-blue-700">₦{Number(member.loans || 0).toLocaleString()}</div>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-4">
                      <div className="text-sm text-orange-600 mb-1">Loan Exposure (Orders)</div>
                      <div className="font-semibold text-orange-700">₦{Number(eligibility.loanExposure || 0).toLocaleString()}</div>
                    </div>
                    <div className="bg-red-50 rounded-lg p-4">
                      <div className="text-sm text-red-600 mb-1">Outstanding Total</div>
                      <div className="font-semibold text-red-700">₦{Number(eligibility.outstandingLoansTotal || 0).toLocaleString()}</div>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-4">
                      <div className="text-sm text-purple-600 mb-1">Global Limit</div>
                      <div className="font-semibold text-purple-700">₦{Number(member.global_limit || 0).toLocaleString()}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Branches & Department */}
            <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100 mb-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                <svg className="w-5 h-5 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Branch & Department Selection
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Member Branch</label>
                  <input 
                    value={memberBranchCode || ''} 
                    readOnly 
                    className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 bg-gray-50 text-gray-600" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Location</label>
                  <select
                    value={deliveryBranchCode}
                    onChange={e => setDeliveryBranchCode(e.target.value)}
                    className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all duration-200"
                  >
                    <option value="">Select delivery branch</option>
                    {branches.map(b => (
                      <option key={b.code} value={b.code}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
                  <select
                    value={departmentName}
                    onChange={e => setDepartmentName(e.target.value)}
                    className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all duration-200"
                  >
                    <option value="">Select department</option>
                    {departments.map(d => (
                      <option key={d.name} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>
                   <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                       <div className="text-sm text-green-600 mb-1">Savings Limit</div>
                       <div className="text-lg font-semibold text-green-700">₦{savingsEligible.toLocaleString()}</div>
                     </div>
                     <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                       <div className="text-sm text-blue-600 mb-1">Loan Limit</div>
                       <div className="text-lg font-semibold text-blue-700">₦{loanEligible.toLocaleString()}</div>
                     </div>
                   </div>
                 </div>
               </div>
             </div>

             {/* Payment Method */}
             <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100 mb-6">
               <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                 <svg className="w-5 h-5 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                 </svg>
                 Payment Method
               </h2>
               <div className="max-w-md">
                 <select
                   value={paymentOption}
                   onChange={e => setPaymentOption(e.target.value)}
                   className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all duration-200"
                 >
                   <option value="Savings" disabled={savingsEligible <= 0}>Savings {savingsEligible <= 0 ? '(Insufficient Balance)' : ''}</option>
                   <option value="Loan">Loan</option>
                   <option value="Cash">Cash</option>
                 </select>
               </div>
             </div>

            {/* Items */}
            <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100 mb-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                <svg className="w-5 h-5 mr-2 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                Available Items — {deliveryBranchCode || 'Select delivery branch'}
              </h2>
              {items.length === 0 && (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  <p className="text-gray-500">No items configured for this branch.</p>
                </div>
              )}
              <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {items.map(it => (
                  <div key={it.sku} className="bg-gradient-to-br from-white to-gray-50 border-2 border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-lg hover:border-orange-200 transition-all duration-300">
                    <div className="mb-4">
                      <div className="font-bold text-lg text-gray-900 mb-1">{it.name}</div>
                      <div className="text-sm text-gray-500 mb-2">{it.unit} • {it.category}</div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xl font-bold text-orange-600">₦{it.price.toLocaleString()}</div>
                        <div className={`text-xs px-2 py-1 rounded-full ${
                          it.initial_stock > 10 ? 'bg-green-100 text-green-700' : 
                          it.initial_stock > 0 ? 'bg-yellow-100 text-yellow-700' : 
                          'bg-red-100 text-red-700'
                        }`}>
                          Stock: {it.initial_stock}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-3">
                      <button 
                        className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold transition-colors duration-200 flex items-center justify-center" 
                        onClick={() => setQtySafe(it.sku, (qty[it.sku] || 0) - 1)}
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={0}
                        value={qty[it.sku] || 0}
                        onChange={e => setQtySafe(it.sku, e.target.value)}
                        className="w-20 h-10 border-2 border-gray-200 rounded-lg text-center font-semibold focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all duration-200"
                      />
                      <button 
                        className="w-10 h-10 rounded-full bg-orange-100 hover:bg-orange-200 text-orange-700 font-bold transition-colors duration-200 flex items-center justify-center" 
                        onClick={() => setQtySafe(it.sku, (qty[it.sku] || 0) + 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

             {/* Cart */}
             <div className="sticky bottom-4 bg-white rounded-2xl shadow-2xl border-2 border-gray-100 p-6 backdrop-blur-sm">
               <div className="flex items-center justify-between mb-4">
                 <h3 className="text-xl font-bold text-gray-800 flex items-center">
                   <svg className="w-6 h-6 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.5 5M7 13l2.5 5m0 0h8.5" />
                   </svg>
                   Shopping Cart
                 </h3>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                 <div className="bg-blue-50 rounded-lg p-4 text-center">
                   <div className="text-sm text-blue-600 mb-1">Items in Cart</div>
                   <div className="text-2xl font-bold text-blue-700">{cartLines.length}</div>
                 </div>
                 <div className="bg-green-50 rounded-lg p-4 text-center">
                   <div className="text-sm text-green-600 mb-1">Cart Total</div>
                   <div className="text-2xl font-bold text-green-700">₦{cartTotal.toLocaleString()}</div>
                 </div>
                 <div className={`rounded-lg p-4 text-center ${
                   overLimit ? 'bg-red-50' : 'bg-purple-50'
                 }`}>
                   <div className={`text-sm mb-1 ${
                     overLimit ? 'text-red-600' : 'text-purple-600'
                   }`}>Limit ({paymentOption})</div>
                   <div className={`text-2xl font-bold ${
                     overLimit ? 'text-red-700' : 'text-purple-700'
                   }`}>
                     {paymentOption === 'Cash' ? 'No limit' : `₦${currentLimit.toLocaleString()}`}
                   </div>
                 </div>
                 <div className="flex items-center justify-center">
                   <button
                     disabled={!canSubmit}
                     onClick={submitOrder}
                     className={`w-full py-4 px-6 rounded-xl font-bold text-lg transition-all duration-200 ${
                       canSubmit 
                         ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105' 
                         : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                     }`}
                   >
                     {submitting ? (
                       <div className="flex items-center justify-center">
                         <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                           <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                           <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                         </svg>
                         Submitting...
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