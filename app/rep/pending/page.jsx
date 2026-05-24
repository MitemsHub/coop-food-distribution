'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../contexts/AuthContext'
import ProtectedRoute from '../../components/ProtectedRoute'

function RepPendingRedirect() {
  const router = useRouter()
  const { user } = useAuth()

  useEffect(() => {
    if (user?.type !== 'rep' || !user?.authenticated) return
    router.replace('/rep/posted')
  }, [router, user])

  return (
    <div className="p-3 sm:p-6 max-w-3xl mx-auto">
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="text-sm text-gray-700">Redirecting…</div>
      </div>
    </div>
  )
}

export default function RepPendingPage() {
  return (
    <ProtectedRoute allowedRoles={['rep']}>
      <RepPendingRedirect />
    </ProtectedRoute>
  )
}

