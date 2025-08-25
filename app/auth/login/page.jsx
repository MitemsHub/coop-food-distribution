'use client'
import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  const sendLink = async () => {
    setLoading(true); setMsg('')
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/verify`,
        }
      })
      if (error) throw error
      setMsg('Check your email for the login link.')
    } catch (e) {
      setMsg(`Error: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-md mx-auto">
      <h1 className="text-2xl font-semibold mb-2">Admin Login</h1>
      <p className="text-sm text-gray-600 mb-4">Enter your email to receive a magic link.</p>
      <input
        className="border rounded w-full px-3 py-2 mb-2"
        placeholder="you@cbn.coop"
        type="email"
        value={email}
        onChange={e=>setEmail(e.target.value)}
      />
      <button
        disabled={!email || loading}
        onClick={sendLink}
        className="px-4 py-2 bg-blue-600 text-white rounded"
      >
        {loading ? 'Sending…' : 'Send Magic Link'}
      </button>
      {msg && <div className="mt-3 text-sm">{msg}</div>}
    </div>
  )
}