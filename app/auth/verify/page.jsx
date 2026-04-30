'use client'
import { useEffect, useState, Suspense } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useSearchParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

function VerifyContent() {
  const [msg, setMsg] = useState('Verifying…')
  const search = useSearchParams()
  const router = useRouter()
  useEffect(() => {
    ;(async () => {
      const token_hash = search.get('token_hash')
      const type = search.get('type') // 'magiclink' | 'recovery' etc.
      const next = search.get('next') || '/admin/pending'
      if (!token_hash) { setMsg('Invalid token'); return }
      const { error } = await supabase.auth.verifyOtp({ type: type || 'magiclink', token_hash })
      if (error) { setMsg(`Error: ${error.message}`); return }
      setMsg('Login successful. Redirecting…')
      router.replace(next)
    })()
  }, [search, router])
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
            <h1 className="mt-1 text-2xl font-bold">Verifying Login</h1>
            <div className="mt-2 text-sm text-white/90">Please wait while we confirm your session.</div>
          </div>
          <div className="px-6 py-6">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              <div className="text-sm text-gray-800">{msg}</div>
            </div>
          </div>
        </div>
      </motion.div>
    </main>
  )
}

export default function Verify() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center px-4 py-10">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100 px-6 py-6 text-sm text-gray-700">
            Loading...
          </div>
        </main>
      }
    >
      <VerifyContent />
    </Suspense>
  )
}
