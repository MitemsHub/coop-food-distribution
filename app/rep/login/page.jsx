'use client'
import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useRouter } from 'next/navigation'

export default function RepLoginPage() {
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const router = useRouter()

  const submit = async () => {
    setLoading(true); setMsg('')
    try {
      const res = await fetch('/api/rep/session', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ passcode: code.trim().toUpperCase() })
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || 'Failed')
      
      // Set user as authenticated rep
      login({
        type: 'rep',
        id: code.trim().toUpperCase(),
        authenticated: true,
        branchCode: code.trim().toUpperCase()
      })
      
      router.push('/rep/pending')
    } catch (e) {
      setMsg(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-md mx-auto">
      <h1 className="text-2xl font-semibold mb-2">Branch Rep Portal</h1>
      <p className="text-sm text-gray-600 mb-4">
        Enter your passcode (Delivery Branch Code, e.g., DUTSE).
      </p>
      <input
        className="border rounded px-3 py-2 w-full mb-2"
        value={code}
        onChange={e=>setCode(e.target.value)}
        placeholder="Passcode (e.g. DUTSE)"
      />
      <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={submit} disabled={loading || !code.trim()}>
        {loading ? 'Checking…' : 'Continue'}
      </button>
      {msg && <div className="mt-3 text-sm text-red-700">{msg}</div>}
    </div>
  )
}