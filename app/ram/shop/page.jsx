'use client'

import { useEffect, useMemo, useRef, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import ProtectedRoute from '../../components/ProtectedRoute'
import { useAuth } from '../../contexts/AuthContext'
import DraggableModal from '../../components/DraggableModal'
import { supabase } from '@/lib/supabaseClient'

function RamShopPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, logout } = useAuth()

  const memberId = useMemo(() => {
    const mid = (searchParams.get('mid') || '').trim().toUpperCase()
    return mid || (user?.id || '')
  }, [searchParams, user?.id])

  const [member, setMember] = useState(null)
  const [eligibility, setEligibility] = useState(null)
  const [deliveryLocations, setDeliveryLocations] = useState([])
  const [deliveryLocationId, setDeliveryLocationId] = useState('')
  const [paymentOption, setPaymentOption] = useState('')
  const [qty, setQty] = useState('')
  const [selectedRamCategory, setSelectedRamCategory] = useState('')
  const [categoryTouched, setCategoryTouched] = useState(false)
  const [shoppingOpen, setShoppingOpen] = useState(true)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState(null)
  const [popupText, setPopupText] = useState('')
  const retireePopupKeyRef = useRef('')
  const [phoneDraft, setPhoneDraft] = useState('')
  const [phoneSaving, setPhoneSaving] = useState(false)

  const qtyNumber = Number(qty)
  const safeQty = Number.isFinite(qtyNumber) ? Math.trunc(qtyNumber) : 0

  const unitPrice = Number(eligibility?.pricing?.unit_price || 0)
  const interestRate = Number(eligibility?.rules?.loan_interest_rate || 0.06)
  const principal = unitPrice * Number(safeQty || 0)
  const interest = paymentOption === 'Loan' ? Math.round(principal * interestRate) : 0
  const total = principal + interest

  const maxRamsAllowed =
    paymentOption === 'Savings'
      ? Number(eligibility?.eligibility?.maxRamsAllowedForSavings ?? eligibility?.eligibility?.maxRamsAllowedForLoanOrSavings ?? 0)
      : Number(eligibility?.eligibility?.maxRamsAllowedForLoan ?? eligibility?.eligibility?.maxRamsAllowedForLoanOrSavings ?? 0)
  const savingsEligible = Number(eligibility?.eligibility?.savingsEligible || 0)
  const loanEligible = Number(eligibility?.eligibility?.loanEligible || 0)
  const isRetiree = !!eligibility?.member?.is_retiree
  const isPensioner = !!eligibility?.member?.is_pensioner
  const savingsBalance = Number(eligibility?.financial?.savings ?? member?.savings ?? 0)
  const loansBalance = Number(eligibility?.financial?.loans ?? member?.loans ?? 0)
  const phoneMissing = !String(member?.phone || '').trim()

  const derivedRamCategory = String(eligibility?.member?.derived_ram_category || eligibility?.member?.ram_category || '')
  const canOverrideRamCategory =
    (paymentOption === 'Cash' || paymentOption === 'Savings') && (paymentOption !== 'Savings' || savingsEligible > 0)

  const allowLoanFallbackOne =
    !isRetiree && !isPensioner && paymentOption === 'Loan' && safeQty === 1 && loanEligible > 0 && unitPrice > 0 && loanEligible < unitPrice

  const selectedLocation = useMemo(() => {
    const idNum = Number(deliveryLocationId)
    if (!Number.isFinite(idNum) || idNum <= 0) return null
    return deliveryLocations.find((l) => Number(l.id) === idNum) || null
  }, [deliveryLocationId, deliveryLocations])

  const qtyCapApplies = paymentOption === 'Loan' || paymentOption === 'Savings'
  const qtyExceeded = qtyCapApplies && safeQty > 0 && safeQty > maxRamsAllowed
  const retireeLoanShortfall = useMemo(() => {
    if (!isRetiree) return 0
    if (paymentOption !== 'Loan') return 0
    if (!Number.isFinite(principal) || principal <= 0) return 0
    return Math.max(0, principal - loanEligible)
  }, [isRetiree, paymentOption, principal, loanEligible])
  const notEligibleForPayment =
    paymentOption === 'Savings'
      ? total > savingsEligible
      : paymentOption === 'Loan'
        ? principal > loanEligible && !allowLoanFallbackOne
        : false

  useEffect(() => {
    if (!isRetiree) return
    if (paymentOption !== 'Loan') return
    if (!Number.isFinite(safeQty) || safeQty <= 0) return
    if (!Number.isFinite(retireeLoanShortfall) || retireeLoanShortfall <= 0) return

    const nextText = `Your purchase will exceed your loan limit by ₦${Number(retireeLoanShortfall).toLocaleString()}. Increase savings by ₦${Number(retireeLoanShortfall).toLocaleString()} to qualify.`
    const key = `${paymentOption}|${safeQty}|${loanEligible}|${unitPrice}`
    if (retireePopupKeyRef.current === key) return
    retireePopupKeyRef.current = key
    setPopupText(nextText)
  }, [isRetiree, paymentOption, safeQty, retireeLoanShortfall, loanEligible, unitPrice])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (!memberId) return
      setLoading(true)
      setMessage(null)
      try {
        const shoppingRes = await fetch('/api/system/ram-shopping', { cache: 'no-store' })
        const shoppingJson = await shoppingRes.json().catch(() => null)
        const open = !!(shoppingRes.ok && shoppingJson?.ok && shoppingJson.open)
        if (!cancelled) setShoppingOpen(open)
        if (!open) {
          if (!cancelled) setMessage({ type: 'error', text: 'Ram shopping is currently closed. Please check back later.' })
          if (!cancelled) setMember(null)
          if (!cancelled) setEligibility(null)
          if (!cancelled) setDeliveryLocations([])
          return
        }

        const { data: memberData, error: mErr } = await supabase
          .from('members')
          .select('member_id,full_name,grade,savings,loans,global_limit,phone')
          .eq('member_id', memberId)
          .single()

        if (mErr || !memberData) {
          if (!cancelled) setMessage({ type: 'error', text: 'Member not found' })
          if (!cancelled) setMember(null)
          return
        }
        if (!cancelled) setMember(memberData)
        if (!cancelled) setPhoneDraft(String(memberData?.phone || ''))

        const res = await fetch(`/api/ram/eligibility?member_id=${encodeURIComponent(memberId)}`, { cache: 'no-store' })
        const json = await res.json().catch(() => null)
        if (!res.ok || !json?.ok) {
          if (!cancelled) setMessage({ type: 'error', text: json?.error || 'Failed to load ram eligibility' })
          if (!cancelled) setEligibility(null)
          return
        }
        if (!cancelled) {
          setEligibility(json)
          setSelectedRamCategory(String(json?.member?.ram_category || ''))
          setCategoryTouched(false)
        }

        const locRes = await fetch('/api/ram/delivery-locations', { cache: 'no-store' })
        const locJson = await locRes.json().catch(() => null)
        if (locRes.ok && locJson?.ok && Array.isArray(locJson.locations)) {
          const list = locJson.locations
          if (!cancelled) {
            setDeliveryLocations(list)
            if (list.length === 0) setMessage({ type: 'error', text: 'No ram delivery locations configured yet.' })
          }
        } else {
          if (!cancelled) setDeliveryLocations([])
          if (!cancelled) setMessage({ type: 'error', text: 'Failed to load ram delivery locations.' })
        }
      } catch (e) {
        if (!cancelled) setMessage({ type: 'error', text: e.message || 'Failed to load' })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [memberId])

  const savePhone = async () => {
    if (phoneSaving) return
    const phone = String(phoneDraft || '').trim()
    if (!phone) {
      setMessage({ type: 'error', text: 'Please enter a phone number' })
      return
    }
    if (!/^\d{11}$/.test(phone)) {
      setMessage({ type: 'error', text: 'Phone number must be exactly 11 digits' })
      return
    }
    setPhoneSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/members/update-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: memberId, phone }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Failed to save phone number')
      setMember((prev) => ({ ...(prev || {}), phone: String(json?.member?.phone || phone) }))
      setPhoneDraft(String(json?.member?.phone || phone))
      setMessage({ type: 'success', text: 'Phone number saved' })
    } catch (e) {
      setMessage({ type: 'error', text: e?.message || 'Failed to save phone number' })
    } finally {
      setPhoneSaving(false)
    }
  }

  useEffect(() => {
    if (paymentOption === 'Savings' && savingsEligible <= 0) {
      setPaymentOption('Loan')
    }
  }, [paymentOption, savingsEligible])

  useEffect(() => {
    const run = async () => {
      if (!memberId) return
      if (!categoryTouched) return
      if (!selectedRamCategory) return
      try {
        const res = await fetch(
          `/api/ram/eligibility?member_id=${encodeURIComponent(memberId)}&ram_category=${encodeURIComponent(selectedRamCategory)}`,
          { cache: 'no-store' }
        )
        const json = await res.json().catch(() => null)
        if (!res.ok || !json?.ok) return
        setEligibility(json)
      } catch {}
    }
    run()
  }, [categoryTouched, memberId, selectedRamCategory])

  useEffect(() => {
    const run = async () => {
      if (paymentOption !== 'Loan') return
      if (!memberId) return
      const derived = derivedRamCategory
      if (!derived) return
      if (selectedRamCategory !== derived) setSelectedRamCategory(derived)
      if (categoryTouched) setCategoryTouched(false)
      try {
        const res = await fetch(
          `/api/ram/eligibility?member_id=${encodeURIComponent(memberId)}&ram_category=${encodeURIComponent(derived)}`,
          { cache: 'no-store' }
        )
        const json = await res.json().catch(() => null)
        if (!res.ok || !json?.ok) return
        setEligibility(json)
      } catch {}
    }
    run()
  }, [categoryTouched, derivedRamCategory, memberId, paymentOption, selectedRamCategory])

  const placeOrder = async () => {
    setMessage(null)

    const memberPhone = String(member?.phone || '').trim()
    if (!memberPhone) {
      setMessage({ type: 'error', text: 'Phone number is required. Please enter and save your phone number before placing an order.' })
      return
    }

    if (!paymentOption) {
      setMessage({ type: 'error', text: 'Please select a payment option' })
      return
    }

    if (!Number.isFinite(safeQty) || safeQty <= 0) {
      setMessage({ type: 'error', text: 'Please enter a valid quantity' })
      return
    }

    if (!deliveryLocationId) {
      setMessage({ type: 'error', text: 'Please select a delivery location' })
      return
    }

    if (qtyExceeded) {
      setMessage({ type: 'error', text: `Maximum allowed is ${maxRamsAllowed} ram(s) for ${paymentOption}` })
      return
    }

    if (retireeLoanShortfall > 0) {
      setPopupText(
        `Your purchase will exceed your loan limit by ₦${Number(retireeLoanShortfall).toLocaleString()}. Increase savings by ₦${Number(retireeLoanShortfall).toLocaleString()} to qualify.`
      )
      return
    }

    if (paymentOption === 'Savings' && total > savingsEligible) {
      setMessage({ type: 'error', text: 'Insufficient savings eligibility for this purchase' })
      return
    }
    if (paymentOption === 'Loan' && principal > loanEligible && !allowLoanFallbackOne) {
      setMessage({ type: 'error', text: 'Insufficient loan eligibility for this purchase' })
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/ram/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_id: memberId,
          payment_option: paymentOption,
          qty: Number(safeQty),
          delivery_location_id: Number(deliveryLocationId),
          ...(canOverrideRamCategory && selectedRamCategory ? { ram_category: selectedRamCategory } : {}),
        }),
      })

      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) {
        const errText = String(json?.error || 'Failed to place order')
        if (isRetiree && errText.toLowerCase().includes('increase savings by')) {
          setPopupText(errText)
        } else {
          setMessage({ type: 'error', text: errText })
        }
        return
      }

      router.push(`/ram/success/${encodeURIComponent(json.order.id)}?mid=${encodeURIComponent(memberId)}`)
    } catch (e) {
      setMessage({ type: 'error', text: e.message || 'Network error' })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50">
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-8 md:py-12">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Ram Sales (Sallah)</h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push(`/orders?member_id=${encodeURIComponent(memberId)}&tab=ram`)}
              className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-sm font-semibold text-gray-700"
            >
              View Orders
            </button>
            <button
              type="button"
              onClick={logout}
              className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-sm font-semibold text-gray-700"
            >
              Logout
            </button>
          </div>
        </div>

        {!!message && (
          <div
            className={`mb-4 rounded-xl border p-3 text-sm ${
              message.type === 'error'
                ? 'bg-red-50 border-red-200 text-red-800'
                : 'bg-green-50 border-green-200 text-green-800'
            }`}
          >
            {message.text}
          </div>
        )}

        <DraggableModal
          open={!!popupText}
          onClose={() => setPopupText('')}
          title="Loan Limit"
          overlayClassName="bg-black/40"
          footer={
            <div className="flex justify-end">
              <button
                type="button"
                className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm"
                onClick={() => setPopupText('')}
              >
                OK
              </button>
            </div>
          }
        >
          <div className="text-sm text-gray-800">{popupText}</div>
        </DraggableModal>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-lg border border-gray-100 p-5 md:p-6">
            <div className="text-sm font-semibold text-gray-800">Member</div>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              <div className="bg-gray-50 rounded-xl p-2">
                <div className="text-[11px] text-gray-600">Full Name</div>
                <div className="font-semibold text-sm text-gray-900">{member?.full_name || '—'}</div>
              </div>
              <div className="bg-gray-50 rounded-xl p-2">
                <div className="text-[11px] text-gray-600">Grade</div>
                <div className="font-semibold text-sm text-gray-900">{eligibility?.member?.grade || member?.grade || '—'}</div>
              </div>
              <div className="bg-gray-50 rounded-xl p-2">
                <div className="text-[11px] text-gray-600">Savings</div>
                <div className="font-semibold text-sm text-gray-900">₦{Number(savingsBalance || 0).toLocaleString()}</div>
              </div>
              <div className="bg-gray-50 rounded-xl p-2">
                <div className="text-[11px] text-gray-600">Loans</div>
                <div className="font-semibold text-sm text-gray-900">₦{Number(loansBalance || 0).toLocaleString()}</div>
              </div>
              <div className="bg-gray-50 rounded-xl p-2">
                <div className="text-[11px] text-gray-600">Phone</div>
                {String(member?.phone || '').trim() ? (
                  <div className="font-semibold text-sm text-gray-900">{String(member?.phone || '').trim()}</div>
                ) : (
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      className="w-full border rounded-lg px-2 py-1 text-sm bg-white"
                      placeholder="Enter phone number"
                      value={phoneDraft}
                      onChange={(e) => {
                        const digitsOnly = String(e.target.value || '').replace(/\D/g, '').slice(0, 11)
                        setPhoneDraft(digitsOnly)
                      }}
                      inputMode="numeric"
                      pattern="[0-9]{11}"
                      maxLength={11}
                      disabled={phoneSaving}
                    />
                    <button
                      type="button"
                      className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm disabled:opacity-50"
                      onClick={savePhone}
                      disabled={phoneSaving || String(phoneDraft || '').trim().length !== 11}
                    >
                      {phoneSaving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                )}
              </div>
              <div className="bg-gray-50 rounded-xl p-2">
                <div className="text-[11px] text-gray-600">Ram Category</div>
                {canOverrideRamCategory ? (
                  <select
                    value={selectedRamCategory || derivedRamCategory || ''}
                    onChange={(e) => {
                      setCategoryTouched(true)
                      setSelectedRamCategory(e.target.value)
                    }}
                    className="mt-1 w-full border-2 border-gray-200 rounded-xl px-3 py-1.5 focus:border-green-600 focus:ring-2 focus:ring-green-200 transition-all duration-200 text-sm bg-white"
                  >
                    <option value="Junior">Junior</option>
                    <option value="Senior">Senior</option>
                    <option value="Executive">Executive</option>
                  </select>
                ) : (
                  <div className="font-semibold text-sm text-gray-900">{derivedRamCategory || '—'}</div>
                )}
              </div>
              <div className="bg-gray-50 rounded-xl p-2">
                <div className="text-[11px] text-gray-600">Unit Price per Category</div>
                <div className="font-semibold text-sm text-gray-900">₦{unitPrice.toLocaleString()}</div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">How do you want to pay</label>
                <select
                  value={paymentOption}
                  onChange={(e) => setPaymentOption(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 focus:border-green-600 focus:ring-2 focus:ring-green-200 transition-all duration-200 text-sm"
                >
                  <option value="" disabled>
                    Select payment option
                  </option>
                  <option value="Loan">Loan (6% interest)</option>
                  <option value="Savings" disabled={savingsEligible <= 0}>Savings {savingsEligible <= 0 ? '(Not eligible)' : ''}</option>
                  <option value="Cash">Cash (Unlimited)</option>
                </select>
                <div className="mt-2 text-xs text-gray-600">
                  Savings Eligible: ₦{savingsEligible.toLocaleString()} · Loan Eligible: ₦{loanEligible.toLocaleString()}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Quantity</label>
                <input
                  type="number"
                  min={1}
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className={`w-full border-2 rounded-xl px-3 py-2 focus:ring-2 transition-all duration-200 text-sm ${
                    qtyExceeded ? 'border-red-400 focus:border-red-500 focus:ring-red-200' : 'border-gray-200 focus:border-green-600 focus:ring-green-200'
                  }`}
                />
                {qtyCapApplies && (
                  <div className={`mt-2 text-xs ${qtyExceeded ? 'text-red-700' : 'text-gray-600'}`}>
                    Max for {paymentOption}: {maxRamsAllowed} ram(s)
                  </div>
                )}
                {retireeLoanShortfall > 0 && (
                  <div className="mt-2 text-xs text-red-700">
                    Increase savings by ₦{Number(retireeLoanShortfall).toLocaleString()} to qualify for this loan purchase.
                  </div>
                )}
              </div>

              <div className="md:col-span-2">
                {paymentOption === 'Savings' && savingsEligible > 0 && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                    <div className="flex items-start">
                      <svg
                        className="w-5 h-5 text-green-600 mr-3 mt-0.5 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-green-800 mb-2">Savings Payment Information</div>
                        <div className="text-sm text-green-700">
                          Members can only use 50% of their total savings balance for purchases. Your current available savings
                          limit is ₦{savingsEligible.toLocaleString()}.
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {paymentOption === 'Loan' && (
                  <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl">
                    <div className="flex items-start">
                      <svg
                        className="w-5 h-5 text-orange-600 mr-3 mt-0.5 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                      </svg>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-orange-800 mb-2">Loan Payment Information</div>
                        <div className="text-sm text-orange-700">
                          Interest Rate: A 6% interest will be charged on all ram purchases using the loan payment option.
                        </div>
                        <div className="text-sm text-orange-700 mt-2">
                          Loan purchase is limited to a maximum of 2 rams per member per ram cycle. Once exhausted, you cannot shop
                          again using loan for this cycle.
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {paymentOption === 'Cash' && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                    <div className="flex items-start">
                      <svg
                        className="w-5 h-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <div className="min-w-0 w-full">
                        <div className="text-sm font-semibold text-blue-800 mb-2">Cash Payment Instructions</div>
                        <div className="text-sm text-blue-700 mb-3">
                          After placing your order, kindly send your payment receipt to the Cooperative (09061388502) for
                          verification.
                        </div>
                        <div className="mb-3 p-3 bg-white border border-blue-200 rounded-lg w-full">
                          <div className="text-xs font-semibold text-gray-700 mb-1">Bank Transfer Details</div>
                          <div className="text-sm text-gray-800">Fidelity Bank</div>
                          <div className="text-sm text-gray-800">Account Number: 5080056982</div>
                          <div className="text-sm text-gray-800">Account Name: CBN Staff Multipurpose Coop. Soc. Ltd.</div>
                        </div>
                        <a
                          href="https://wa.me/+2349061388502"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center w-full sm:w-auto px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors duration-200"
                        >
                          <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.097z" />
                          </svg>
                          Send Receipt via WhatsApp
                        </a>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Delivery Location</label>
                <select
                  value={deliveryLocationId}
                  onChange={(e) => setDeliveryLocationId(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 focus:border-green-600 focus:ring-2 focus:ring-green-200 transition-all duration-200 text-sm"
                >
                  <option value="" disabled>
                    Select delivery location
                  </option>
                  {deliveryLocations.map((l) => (
                    <option key={l.id} value={String(l.id)}>
                      {l.delivery_location || l.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={placeOrder}
              disabled={
                !shoppingOpen ||
                submitting ||
                unitPrice <= 0 ||
                phoneMissing ||
                !paymentOption ||
                !deliveryLocationId ||
                safeQty <= 0 ||
                qtyExceeded ||
                notEligibleForPayment
              }
              className={`mt-6 w-full inline-flex items-center justify-center px-4 py-3 text-white text-sm md:text-base font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl ${
                !shoppingOpen ||
                submitting ||
                unitPrice <= 0 ||
                phoneMissing ||
                !paymentOption ||
                !deliveryLocationId ||
                safeQty <= 0 ||
                qtyExceeded ||
                notEligibleForPayment
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700'
              }`}
            >
              {submitting ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Submitting...</span>
                </span>
              ) : (
                'Place Order'
              )}
            </button>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5 md:p-6">
            <div className="text-sm font-semibold text-gray-800">Summary</div>
            <div className="mt-3 space-y-2 text-sm text-gray-700">
              <div className="flex items-center justify-between">
                <div>Quantity</div>
                  <div className="font-semibold">{Number(safeQty || 0).toLocaleString()}</div>
              </div>
              <div className="flex items-center justify-between">
                <div>Unit Price per Category</div>
                <div className="font-semibold">₦{unitPrice.toLocaleString()}</div>
              </div>
              <div className="flex items-center justify-between">
                <div>Principal</div>
                <div className="font-semibold">₦{principal.toLocaleString()}</div>
              </div>
              <div className="flex items-center justify-between">
                <div>Interest</div>
                <div className="font-semibold">₦{interest.toLocaleString()}</div>
              </div>
              <div className="pt-2 border-t border-gray-200 flex items-center justify-between">
                <div className="font-semibold">Total</div>
                <div className="font-bold text-gray-900">₦{total.toLocaleString()}</div>
              </div>
            </div>

            <div className="mt-6">
              <div className="text-sm font-semibold text-gray-800">Vendor Details</div>
              <div className="mt-3 space-y-2 text-sm text-gray-700">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-gray-600">Name</div>
                  <div className="font-semibold text-right break-words">{selectedLocation?.name || '—'}</div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-gray-600">Phone No</div>
                  <div className="font-semibold text-right break-words">{selectedLocation?.phone || '—'}</div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-gray-600">Address</div>
                  <div className="font-semibold text-right break-words">{selectedLocation?.address || '—'}</div>
                </div>
              </div>
            </div>

            {!!eligibility?.eligibility?.ramOrdersTableMissing && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                Ram Sales tables are not created yet in the database. Orders will fail until the migration is applied.
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}

export default function RamShopPage() {
  return (
    <ProtectedRoute allowedRoles={['member']}>
      <Suspense>
        <RamShopPageContent />
      </Suspense>
    </ProtectedRoute>
  )
}
