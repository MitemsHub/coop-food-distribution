'use client'

import { useAuth } from '../contexts/AuthContext'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

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
          dest = `/shop?mid=${user.id}`
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Don't render children if user is not authenticated or doesn't have permission
  if (!user || !user.authenticated || (allowedRoles.length > 0 && !allowedRoles.includes(userType))) {
    return null
  }

  return children
}