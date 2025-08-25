'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

const AuthContext = createContext()

export function AuthProvider({ children }) {
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
        setUser(JSON.parse(storedUser))
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

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}