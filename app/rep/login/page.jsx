'use client'
import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useRouter, useSearchParams } from 'next/navigation'

export default function RepLoginPage() {
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const portalModule = (searchParams.get('module') || 'food').toLowerCase() === 'ram' ? 'ram' : 'food'

  const submit = async () => {
    setLoading(true); setMsg('')
    try {
      const res = await fetch('/api/rep/session', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ module: portalModule, passcode: code.trim().toUpperCase() })
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || 'Failed')
      
      // Set user as authenticated rep
      const base = {
        type: 'rep',
        id: code.trim().toUpperCase(),
        authenticated: true,
        module: portalModule,
      }
      if (json.module === 'ram') {
        login({
          ...base,
          vendorId: json.vendor?.id ?? null,
          vendorName: json.vendor?.name ?? '',
          vendorCode: json.vendor?.code ?? '',
        })
        router.push('/rep/ram/approved')
        return
      }
      login({
        ...base,
        branchCode: json.branch?.code ?? code.trim().toUpperCase(),
        branchName: json.branch?.name ?? '',
        branchId: json.branch?.id ?? null,
      })
      
      router.push('/rep/pending')
    } catch (e) {
      setMsg(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-2 lg:p-3 xl:p-4 max-w-md mx-auto">
      <h1 className="text-xl sm:text-2xl font-semibold mb-2">
        {portalModule === 'ram' ? 'Ram Sales Rep Portal' : 'Food Distribution Rep Portal'}
      </h1>
      <p className="text-xs sm:text-sm text-gray-600 mb-4">
        Enter your passcode.
      </p>
      <input
        className="border rounded px-3 py-2 w-full mb-3 text-sm sm:text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        value={code}
        onChange={e=>setCode(e.target.value)}
        placeholder="Enter your passcode"
      />
      <button className="px-4 py-2 bg-blue-600 text-white rounded w-full sm:w-auto hover:bg-blue-700 transition-colors duration-200 text-sm sm:text-base font-medium" onClick={submit} disabled={loading || !code.trim()}>
        {loading ? 'Checking…' : 'Continue'}
      </button>
      {msg && <div className="mt-3 text-xs sm:text-sm text-red-700">{msg}</div>}
    </div>
  )
}
