'use client'

import { useAuth } from '../contexts/AuthContext'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'

export default function ProtectedRoute({ children, allowedRoles = [] }) {
  const { user, userType, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const redirectRef = useRef(false)

  useEffect(() => {
    if (loading) return // Wait for auth to load
    
    // If no user is authenticated, redirect to home
    if (!user || !user.authenticated) {
      if (pathname !== '/') router.replace('/')
      return
    }
    
    // If user type is not in allowed roles, redirect to appropriate page (once)
    if (allowedRoles.length > 0 && !allowedRoles.includes(userType)) {
      if (redirectRef.current) return
      redirectRef.current = true

      let dest = '/'
      switch (userType) {
        case 'member':
          dest = '/shop'
          break
        case 'rep':
          dest = '/rep/pending'
          break
        case 'admin':
          dest = '/admin/pending'
          break
        default:
          dest = '/'
      }

      if (dest !== pathname) router.replace(dest)
      return
    }
  }, [user, userType, loading, router, allowedRoles, pathname])

  // Show loading while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-gray-100 px-6 py-6"
        >
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-600 to-emerald-600 flex items-center justify-center shadow-md">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-gray-900">Loading</div>
              <div className="text-xs text-gray-600">Preparing your session…</div>
            </div>
          </div>
        </motion.div>
      </div>
    )
  }

  // Don't render children if user is not authenticated or doesn't have permission
  if (!user || !user.authenticated || (allowedRoles.length > 0 && !allowedRoles.includes(userType))) {
    return null
  }

  return children
}
