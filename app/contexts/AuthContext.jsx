'use client'

import { createContext, useContext, useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

const AuthContext = createContext()

function AuthProviderContent({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    // Check for member ID in URL params
    const mid = searchParams.get('mid')
    if (mid) {
      setUser({
        type: 'member',
        id: mid,
        authenticated: true
      })
      setLoading(false)
      return
    }

    // Check for stored user data
    const storedUser = localStorage.getItem('user')
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser)
        // Clear admin/rep authentication when on home page
        if (window.location.pathname === '/' && (userData.type === 'admin' || userData.type === 'rep')) {
          localStorage.removeItem('user')
          setUser(null)
        } else {
          setUser(userData)
        }
      } catch (e) {
        localStorage.removeItem('user')
      }
    }
    setLoading(false)
  }, [searchParams])

  const login = (userData) => {
    setUser(userData)
    localStorage.setItem('user', JSON.stringify(userData))
    setLoading(false)
  }

  const logout = () => {
    const currentUserType = user?.type
    setUser(null)
    localStorage.removeItem('user')
    setLoading(false)
    
    // Redirect to appropriate login page based on user type
    if (currentUserType === 'rep') {
      router.push('/rep/login')
    } else if (currentUserType === 'admin') {
      router.push('/admin/pin')
    } else {
      // For members or any other user type, redirect to main login
      router.push('/auth/login')
    }
  }

  const userType = user?.type || null

  return (
    <AuthContext.Provider value={{ user, userType, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function AuthProvider({ children }) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AuthProviderContent>{children}</AuthProviderContent>
    </Suspense>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}