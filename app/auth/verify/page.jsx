'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useSearchParams, useRouter } from 'next/navigation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default function Verify() {
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
  return <div className="p-6">{msg}</div>
}