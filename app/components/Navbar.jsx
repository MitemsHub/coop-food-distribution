// app/components/Navbar.jsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function Navbar() {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const [lowCount, setLowCount] = useState(0)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isDemandTrackingMode, setIsDemandTrackingMode] = useState(false)

  const userType = user?.type

  const isActive = (path) => {
    if (path === '/') return pathname === '/'
    return pathname.startsWith(path)
  }

  const closeMobileMenu = () => setMobileMenuOpen(false)

  // Check demand tracking mode - only for admin
  useEffect(() => {
    if (userType !== 'admin') return
    
    const checkMode = async () => {
      try {
        const res = await fetch('/api/admin/system/mode')
        const data = await res.json()
        if (data?.ok) {
          setIsDemandTrackingMode(data.isDemandTrackingMode || false)
        }
      } catch {}
    }
    checkMode()
  }, [userType])

  // Low-stock poll (every 90s) - only for admin and only in stock tracking mode
  useEffect(() => {
    if (userType !== 'admin' || isDemandTrackingMode) {
      // Reset low count when in demand tracking mode or not admin
      setLowCount(0)
      return
    }
    
    let t
    const load = async () => {
      try {
        const res = await fetch('/api/admin/inventory/low?threshold=20', { cache: 'no-store' })
        const j = await res.json()
        if (j?.ok) setLowCount(j.count || 0)
      } catch {
        setLowCount(0)
      }
      t = setTimeout(load, 90_000)
    }
    load()
    return () => t && clearTimeout(t)
  }, [userType, isDemandTrackingMode])

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-lg">
      <div className="max-w-7xl mx-auto px-3 lg:px-4 xl:px-6 h-12 lg:h-14 flex items-center gap-2 lg:gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center space-x-2 group">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-green-500 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.5 5M7 13l2.5 5m0 0h8.5" />
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-base sm:text-lg md:text-xl lg:text-2xl bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent group-hover:from-blue-700 group-hover:to-green-700 transition-all duration-200 leading-tight">CBN Coop</span>
            <span className="text-xs sm:text-sm text-gray-500 -mt-1">Food Distribution</span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="ml-auto hidden lg:flex items-center gap-2">
          {/* Member Navigation */}
          {userType === 'member' && (
            <>
              <Link
                href={`/shop?mid=${user?.id}`}
                className={`inline-flex items-center px-2 lg:px-3 py-1 lg:py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                  isActive('/shop') 
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg' 
                    : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600'
                }`}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.5 5M7 13l2.5 5m0 0h8.5" />
                </svg>
                Shop
              </Link>
              <button
                onClick={logout}
                className="inline-flex items-center px-2 lg:px-3 py-1 lg:py-1.5 rounded-full text-sm font-medium text-gray-700 hover:bg-red-50 hover:text-red-600 transition-all duration-200"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Logout
              </button>
            </>
          )}

          {/* Rep Navigation */}
          {userType === 'rep' && (
            <>
              <Link
                href="/rep/pending"
                className={`inline-flex items-center px-2 lg:px-3 py-1 lg:py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                  isActive('/rep/pending') 
                    ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg' 
                    : 'text-gray-700 hover:bg-green-50 hover:text-green-600'
                }`}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Pending
              </Link>
              <Link
                href="/rep/posted"
                className={`inline-flex items-center px-2 lg:px-3 py-1 lg:py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                  isActive('/rep/posted') 
                    ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg' 
                    : 'text-gray-700 hover:bg-green-50 hover:text-green-600'
                }`}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Posted
              </Link>
              <Link
                href="/rep/delivered"
                className={`inline-flex items-center px-2 lg:px-3 py-1 lg:py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                  isActive('/rep/delivered') 
                    ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg' 
                    : 'text-gray-700 hover:bg-green-50 hover:text-green-600'
                }`}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Delivered
              </Link>
              <button
                onClick={logout}
                className="inline-flex items-center px-2 lg:px-3 py-1 lg:py-1.5 rounded-full text-sm font-medium text-gray-700 hover:bg-red-50 hover:text-red-600 transition-all duration-200"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Logout
              </button>
            </>
          )}

          {/* Admin Navigation */}
          {userType === 'admin' && (
            <>
              <Link
                href="/admin/pending"
                className={`inline-flex items-center px-2 lg:px-3 py-1 lg:py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                  isActive('/admin/pending') 
                    ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg' 
                    : 'text-gray-700 hover:bg-purple-50 hover:text-purple-600'
                }`}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Pending
              </Link>
              <Link
                href="/admin/posted"
                className={`inline-flex items-center px-2 lg:px-3 py-1 lg:py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                  isActive('/admin/posted') 
                    ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg' 
                    : 'text-gray-700 hover:bg-purple-50 hover:text-purple-600'
                }`}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Posted
              </Link>
              <Link
                href="/admin/delivered"
                className={`inline-flex items-center px-2 lg:px-3 py-1 lg:py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                  isActive('/admin/delivered') 
                    ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg' 
                    : 'text-gray-700 hover:bg-purple-50 hover:text-purple-600'
                }`}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Delivered
              </Link>
              <Link
                href="/admin/import"
                className={`inline-flex items-center px-2 lg:px-3 py-1 lg:py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                  isActive('/admin/import') 
                    ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg' 
                    : 'text-gray-700 hover:bg-purple-50 hover:text-purple-600'
                }`}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                </svg>
                Import
              </Link>
              <Link
                href="/admin/inventory"
                className={`inline-flex items-center px-2 lg:px-3 py-1 lg:py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                  isActive('/admin/inventory') 
                    ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg' 
                    : 'text-gray-700 hover:bg-purple-50 hover:text-purple-600'
                }`}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                Inventory
                {!isDemandTrackingMode && lowCount > 0 && (
                  <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-xs bg-red-500 text-white rounded-full animate-pulse">
                    {lowCount}
                  </span>
                )}
              </Link>
              <Link
                href="/admin/reports"
                className={`inline-flex items-center px-2 lg:px-3 py-1 lg:py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                  isActive('/admin/reports') 
                    ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg' 
                    : 'text-gray-700 hover:bg-purple-50 hover:text-purple-600'
                }`}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Reports
              </Link>
              <Link
                href="/admin/data-management"
                className={`inline-flex items-center px-2 lg:px-3 py-1 lg:py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                  isActive('/admin/data-management') 
                    ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg' 
                    : 'text-gray-700 hover:bg-purple-50 hover:text-purple-600'
                }`}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                </svg>
                Data
              </Link>
              <button
                onClick={logout}
                className="inline-flex items-center px-2 lg:px-3 py-1 lg:py-1.5 rounded-full text-sm font-medium text-gray-700 hover:bg-red-50 hover:text-red-600 transition-all duration-200"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Logout
              </button>
            </>
          )}

          {/* No user logged in - show login options */}
          {!userType && (
            <Link
              href="/"
              className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                pathname === '/' 
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg' 
                  : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600'
              }`}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              Home
            </Link>
          )}
        </nav>

        {/* Mobile Hamburger Menu Button */}
        <div className="lg:hidden ml-auto">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="inline-flex items-center justify-center p-2 rounded-md text-gray-700 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
            aria-expanded="false"
          >
            <span className="sr-only">Open main menu</span>
            {!mobileMenuOpen ? (
              <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            ) : (
              <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-white border-t border-gray-200 shadow-lg">
            {/* Member Mobile Navigation */}
            {userType === 'member' && (
              <>
                <Link
                  href={`/shop?mid=${user?.id}`}
                  onClick={closeMobileMenu}
                  className={`block px-3 py-2 rounded-md text-base font-medium transition-all duration-200 ${
                    isActive('/shop') 
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white' 
                      : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600'
                  }`}
                >
                  Shop
                </Link>
                <button
                  onClick={() => { logout(); closeMobileMenu(); }}
                  className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-red-50 hover:text-red-600 transition-all duration-200"
                >
                  Logout
                </button>
              </>
            )}

            {/* Rep Mobile Navigation */}
            {userType === 'rep' && (
              <>
                <Link
                  href="/rep/pending"
                  onClick={closeMobileMenu}
                  className={`block px-3 py-2 rounded-md text-base font-medium transition-all duration-200 ${
                    isActive('/rep/pending') 
                      ? 'bg-gradient-to-r from-green-500 to-green-600 text-white' 
                      : 'text-gray-700 hover:bg-green-50 hover:text-green-600'
                  }`}
                >
                  Pending
                </Link>
                <Link
                  href="/rep/posted"
                  onClick={closeMobileMenu}
                  className={`block px-3 py-2 rounded-md text-base font-medium transition-all duration-200 ${
                    isActive('/rep/posted') 
                      ? 'bg-gradient-to-r from-green-500 to-green-600 text-white' 
                      : 'text-gray-700 hover:bg-green-50 hover:text-green-600'
                  }`}
                >
                  Posted
                </Link>
                <Link
                  href="/rep/delivered"
                  onClick={closeMobileMenu}
                  className={`block px-3 py-2 rounded-md text-base font-medium transition-all duration-200 ${
                    isActive('/rep/delivered') 
                      ? 'bg-gradient-to-r from-green-500 to-green-600 text-white' 
                      : 'text-gray-700 hover:bg-green-50 hover:text-green-600'
                  }`}
                >
                  Delivered
                </Link>
                <button
                  onClick={() => { logout(); closeMobileMenu(); }}
                  className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-red-50 hover:text-red-600 transition-all duration-200"
                >
                  Logout
                </button>
              </>
            )}

            {/* Admin Mobile Navigation */}
            {userType === 'admin' && (
              <>
                <Link
                  href="/admin/pending"
                  onClick={closeMobileMenu}
                  className={`block px-3 py-2 rounded-md text-base font-medium transition-all duration-200 ${
                    isActive('/admin/pending') 
                      ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white' 
                      : 'text-gray-700 hover:bg-purple-50 hover:text-purple-600'
                  }`}
                >
                  Pending
                </Link>
                <Link
                  href="/admin/posted"
                  onClick={closeMobileMenu}
                  className={`block px-3 py-2 rounded-md text-base font-medium transition-all duration-200 ${
                    isActive('/admin/posted') 
                      ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white' 
                      : 'text-gray-700 hover:bg-purple-50 hover:text-purple-600'
                  }`}
                >
                  Posted
                </Link>
                <Link
                  href="/admin/delivered"
                  onClick={closeMobileMenu}
                  className={`block px-3 py-2 rounded-md text-base font-medium transition-all duration-200 ${
                    isActive('/admin/delivered') 
                      ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white' 
                      : 'text-gray-700 hover:bg-purple-50 hover:text-purple-600'
                  }`}
                >
                  Delivered
                </Link>
                <Link
                  href="/admin/import"
                  onClick={closeMobileMenu}
                  className={`block px-3 py-2 rounded-md text-base font-medium transition-all duration-200 ${
                    isActive('/admin/import') 
                      ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white' 
                      : 'text-gray-700 hover:bg-purple-50 hover:text-purple-600'
                  }`}
                >
                  Import
                </Link>
                <Link
                  href="/admin/inventory"
                  onClick={closeMobileMenu}
                  className={`flex items-center px-3 py-2 rounded-md text-base font-medium transition-all duration-200 ${
                    isActive('/admin/inventory') 
                      ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white' 
                      : 'text-gray-700 hover:bg-purple-50 hover:text-purple-600'
                  }`}
                >
                  Inventory
                  {!isDemandTrackingMode && lowCount > 0 && (
                    <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-xs bg-red-500 text-white rounded-full animate-pulse">
                      {lowCount}
                    </span>
                  )}
                </Link>
                <Link
                  href="/admin/reports"
                  onClick={closeMobileMenu}
                  className={`block px-3 py-2 rounded-md text-base font-medium transition-all duration-200 ${
                    isActive('/admin/reports') 
                      ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white' 
                      : 'text-gray-700 hover:bg-purple-50 hover:text-purple-600'
                  }`}
                >
                  Reports
                </Link>
                <Link
                  href="/admin/data-management"
                  onClick={closeMobileMenu}
                  className={`block px-3 py-2 rounded-md text-base font-medium transition-all duration-200 ${
                    isActive('/admin/data-management') 
                      ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white' 
                      : 'text-gray-700 hover:bg-purple-50 hover:text-purple-600'
                  }`}
                >
                  Data Management
                </Link>
                <button
                  onClick={() => { logout(); closeMobileMenu(); }}
                  className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-red-50 hover:text-red-600 transition-all duration-200"
                >
                  Logout
                </button>
              </>
            )}

            {/* No user logged in - mobile */}
            {!userType && (
              <Link
                href="/"
                onClick={closeMobileMenu}
                className={`block px-3 py-2 rounded-md text-base font-medium transition-all duration-200 ${
                  pathname === '/' 
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white' 
                    : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600'
                }`}
              >
                Home
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  )
}