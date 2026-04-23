'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useMemo } from 'react'
import ProtectedRoute from '../components/ProtectedRoute'
import { useAuth } from '../contexts/AuthContext'

function RamPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()

  const memberId = useMemo(() => {
    const mid = (searchParams.get('mid') || '').trim().toUpperCase()
    return mid || (user?.id || '')
  }, [searchParams, user?.id])

  return (
    <main className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50">
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-8 md:py-12">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 md:p-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Ram Sales (Sallah)</h1>
          <div className="mt-2 text-sm md:text-base text-gray-600">
            Member ID: <span className="font-semibold text-gray-800">{memberId || '—'}</span>
          </div>

          <div className="mt-6 bg-green-50 border border-green-200 rounded-xl p-4 text-sm md:text-base text-green-900">
            This is the Ram Sales module entry page. Nationwide pricing will apply per member category (Junior/Senior/Executive).
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => router.push(`/ram/shop?mid=${encodeURIComponent(memberId)}`)}
              className="w-full inline-flex items-center justify-center px-4 py-3 text-white text-sm md:text-base font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
            >
              Start Ram Shopping
            </button>
            <button
              type="button"
              onClick={() => router.push(`/shop?mid=${encodeURIComponent(memberId)}`)}
              className="w-full inline-flex items-center justify-center px-4 py-3 text-white text-sm md:text-base font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
            >
              Go to Food Distribution
            </button>
          </div>
          <button
            type="button"
            onClick={() => router.push('/portal')}
            className="mt-3 w-full inline-flex items-center justify-center px-4 py-3 text-gray-700 text-sm md:text-base font-semibold rounded-xl transition-all duration-200 border border-gray-300 hover:bg-gray-50"
          >
            Back to Portal
          </button>
        </div>
      </div>
    </main>
  )
}

export default function RamPage() {
  return (
    <ProtectedRoute allowedRoles={['member']}>
      <RamPageContent />
    </ProtectedRoute>
  )
}
