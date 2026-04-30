'use client'
import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { motion } from 'framer-motion'

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
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="w-full max-w-md"
      >
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="px-6 py-6 bg-gradient-to-r from-blue-600 to-emerald-600 text-white">
            <div className="text-sm font-semibold opacity-95">CBN Coop</div>
            <h1 className="mt-1 text-2xl font-bold">Admin Login</h1>
            <div className="mt-2 text-sm text-white/90">Enter your email to receive a secure magic link.</div>
          </div>

          <div className="px-6 py-6">
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-sm outline-none focus:border-blue-500"
              placeholder="you@cbn.coop"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              inputMode="email"
            />

            <button
              disabled={!email || loading}
              onClick={sendLink}
              className={`mt-4 w-full inline-flex items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg transition-all ${
                !email || loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800'
              }`}
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Sending…</span>
                </span>
              ) : (
                'Send Magic Link'
              )}
            </button>

            {!!msg && (
              <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3 text-sm text-gray-800">{msg}</div>
            )}

            <div className="mt-5 text-xs text-gray-500 leading-relaxed">
              Use your official email address. If you don’t receive the email, check your spam folder.
            </div>
          </div>
        </div>
      </motion.div>
    </main>
  )
}
