// app/shop/page.jsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../lib/supabaseClient'

export default function ShopPage() {
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
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Shop — Coop Food Distribution</h1>
      <div className="mb-2">
      <a href="/" className="text-sm text-blue-600 hover:underline">← Back to Home</a>
      </div>
      {/* Member Lookup */}
      <div className="flex gap-2 items-end mb-4">
        <div>
          <label className="block text-sm mb-1">Member ID</label>
          <input
            value={memberId}
            onChange={e => setMemberId(e.target.value)}
            className="border rounded px-3 py-2 w-56"
            placeholder="e.g. A12345"
          />
        </div>
        <button onClick={lookupMember} className="bg-blue-600 text-white px-4 py-2 rounded">
          Lookup
        </button>

        {member && (
          <div className="ml-4 text-sm">
            <div><span className="font-medium">Name:</span> {member.full_name}</div>
            <div><span className="font-medium">Savings (core):</span> ₦{Number(member.savings || 0).toLocaleString()}</div>
            <div><span className="font-medium">Loans (core):</span> ₦{Number(member.loans || 0).toLocaleString()}</div>
            <div><span className="font-medium">Loan exposure (orders):</span> ₦{Number(eligibility.loanExposure || 0).toLocaleString()}</div>
            <div><span className="font-medium">Outstanding (core + exposure):</span> ₦{Number(eligibility.outstandingLoansTotal || 0).toLocaleString()}</div>
            <div><span className="font-medium">Global Limit:</span> ₦{Number(member.global_limit || 0).toLocaleString()}</div>
          </div>
        )}
      </div>

      {/* Branches & Department */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div>
          <label className="block text-sm mb-1">Member Branch</label>
          <input value={memberBranchCode || ''} readOnly className="border rounded px-3 py-2 w-full bg-gray-100" />
        </div>
        <div>
          <label className="block text-sm mb-1">Delivery Location</label>
          <select
            value={deliveryBranchCode}
            onChange={e => setDeliveryBranchCode(e.target.value)}
            className="border rounded px-3 py-2 w-full"
          >
            <option value="">Select delivery branch</option>
            {branches.map(b => (
              <option key={b.code} value={b.code}>{b.name}</option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm mb-1">Department</label>
          <select
            value={departmentName}
            onChange={e => setDepartmentName(e.target.value)}
            className="border rounded px-3 py-2 w-full"
          >
            <option value="">Select department</option>
            {departments.map(d => (
              <option key={d.name} value={d.name}>{d.name}</option>
            ))}
          </select>

          <div className="text-xs text-gray-600 mt-2">
            Savings limit: ₦{savingsEligible.toLocaleString()} | Loan limit: ₦{loanEligible.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Payment Method */}
      <div className="mb-4">
        <label className="block text-sm mb-1">Payment Method</label>
        <select
          value={paymentOption}
          onChange={e => setPaymentOption(e.target.value)}
          className="border rounded px-3 py-2 w-full md:w-64"
        >
          <option value="Savings" disabled={savingsEligible <= 0}>Savings</option>
          <option value="Loan">Loan</option>
          <option value="Cash">Cash</option>
        </select>
      </div>

      {/* Items */}
      <div>
        <h2 className="text-lg font-medium mb-2">Items — {deliveryBranchCode || 'Select delivery branch'}</h2>
        {items.length === 0 && <p className="text-sm text-gray-600">No items configured for this branch.</p>}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(it => (
            <div key={it.sku} className="border rounded-xl p-4 bg-white shadow-sm hover:shadow-md transition">
              <div className="font-semibold">{it.name}</div>
              <div className="text-sm text-gray-600">{it.unit} • {it.category}</div>
              <div className="mt-1 text-gray-900">Price: ₦{it.price.toLocaleString()}</div>
              <div className="text-xs text-gray-500">Stock: {it.initial_stock}</div>
              <div className="flex items-center gap-2 mt-2">
                <button className="px-2 py-1 border rounded" onClick={() => setQtySafe(it.sku, (qty[it.sku] || 0) - 1)}>-</button>
                <input
                  type="number"
                  min={0}
                  value={qty[it.sku] || 0}
                  onChange={e => setQtySafe(it.sku, e.target.value)}
                  className="border rounded px-2 py-1 w-16 text-center"
                />
                <button className="px-2 py-1 border rounded" onClick={() => setQtySafe(it.sku, (qty[it.sku] || 0) + 1)}>+</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cart */}
      <div className="mt-6 sticky bottom-2 p-4 border rounded-xl bg-gray-50 shadow-sm">
        <div className="flex flex-wrap gap-6 items-end">
          <div>
            <div className="text-sm text-gray-600">Items in cart</div>
            <div className="text-xl font-semibold">{cartLines.length}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Cart total</div>
            <div className="text-xl font-semibold">₦{cartTotal.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Limit ({paymentOption})</div>
            <div className={`text-xl font-semibold ${overLimit ? 'text-red-600' : ''}`}>
              {paymentOption === 'Cash' ? 'No limit' : `₦${currentLimit.toLocaleString()}`}
            </div>
          </div>
          <button
            disabled={!canSubmit}
            onClick={submitOrder}
            className={`ml-auto px-5 py-2 rounded ${canSubmit ? 'bg-green-600 text-white' : 'bg-gray-300 text-gray-600 cursor-not-allowed'}`}
          >
            {submitting ? 'Submitting…' : 'Submit Order (Pending)'}
          </button>
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
  )
}