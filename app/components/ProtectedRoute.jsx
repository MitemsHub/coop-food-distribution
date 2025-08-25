'use client'

import { useAuth } from '../contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function ProtectedRoute({ children, allowedRoles = [] }) {
  const { user, userType, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return // Wait for auth to load
    
    // If no user is authenticated, redirect to home
    if (!user || !user.authenticated) {
      router.push('/')
      return
    }
    
    // If user type is not in allowed roles, redirect to appropriate page
    if (allowedRoles.length > 0 && !allowedRoles.includes(userType)) {
      switch (userType) {
        case 'member':
          router.push(`/shop?mid=${user.id}`)
          break
        case 'rep':
          router.push('/rep/pending')
          break
        case 'admin':
          router.push('/admin/pending')
          break
        default:
          router.push('/')
      }
      return
    }
  }, [user, userType, loading, router, allowedRoles])

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