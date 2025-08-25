// app/admin/pin/page.jsx
'use client'

import { useState } from 'react'

export default function AdminPinPage() {
  const [pin, setPin] = useState('')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    setLoading(true); setMsg('')
    try {
      const res = await fetch('/api/admin/pin/session', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ passcode: pin })
      })
      const j = await res.json()
      if (!res.ok || !j.ok) throw new Error(j.error || 'Invalid passcode')
      // default landing for admin:
      window.location.href = '/admin/pending'
    } catch (e) {
      setMsg(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-md mx-auto">
      <h1 className="text-2xl font-semibold mb-2">Admin Passcode</h1>
      <p className="text-sm text-gray-600 mb-4">Enter passcode to continue. (Default: Coop@2025)</p>
      <input
        className="border rounded px-3 py-2 w-full mb-2"
        placeholder="Enter passcode"
        type="password"
        value={pin}
        onChange={e=>setPin(e.target.value)}
      />
      <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={submit} disabled={!pin || loading}>
        {loading ? 'Checking…' : 'Continue'}
      </button>
      {msg && <div className="mt-3 text-sm text-red-700">{msg}</div>}
    </div>
  )
}