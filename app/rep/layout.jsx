'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '../contexts/AuthContext'

export const dynamic = 'force-dynamic'

function navItemClass(active) {
  return `block px-3 py-2 rounded-lg text-sm ${active ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'}`
}

function sectionButtonClass(open) {
  return `w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold tracking-wide uppercase ${
    open ? 'bg-gray-100 text-gray-700' : 'text-gray-500 hover:bg-gray-50'
  }`
}

export default function RepLayout({ children }) {
  const pathname = usePathname()
  const { logout, user } = useAuth()
  const isLoginPage = pathname.startsWith('/rep/login') || pathname.startsWith('/rep/access')
  const portalModule = user?.module || null

  const [sidebarVisible, setSidebarVisible] = useState(() => {
    if (typeof window === 'undefined') return true
    const v = window.localStorage.getItem('rep_sidebar_visible')
    if (v === null) return true
    return v === '1'
  })
  const [foodOpen, setFoodOpen] = useState(false)
  const [ramOpen, setRamOpen] = useState(false)

  useEffect(() => {
    try {
      window.localStorage.setItem('rep_sidebar_visible', sidebarVisible ? '1' : '0')
    } catch {}
  }, [sidebarVisible])

  const activeKey = useMemo(() => {
    if (pathname.startsWith('/rep/pending')) return 'food_pending'
    if (pathname.startsWith('/rep/posted')) return 'food_posted'
    if (pathname.startsWith('/rep/delivered')) return 'food_delivered'
    if (pathname.startsWith('/rep/ram/approved')) return 'ram_approved'
    return ''
  }, [pathname])

  const title = useMemo(() => {
    if (activeKey.startsWith('food_')) {
      const rest = activeKey.replace('food_', '')
      const label = rest.charAt(0).toUpperCase() + rest.slice(1)
      return `Food Distribution — ${label}`
    }
    if (activeKey.startsWith('ram_')) {
      const rest = activeKey.replace('ram_', '')
      const label = rest.charAt(0).toUpperCase() + rest.slice(1)
      return `Ram Sales — ${label}`
    }
    return 'Rep'
  }, [activeKey])

  const doLogout = async () => {
    try {
      await fetch('/api/rep/session', { method: 'DELETE', credentials: 'include' }).catch(() => null)
      logout()
    } catch {
      logout()
    }
  }

  if (isLoginPage) return children

  return (
    <div className="fixed inset-0 bg-gray-50 flex overflow-hidden">
      {sidebarVisible && (
        <aside className="w-60 sm:w-64 shrink-0 bg-white border-r border-gray-200 flex flex-col">
          <div className="px-4 py-4 border-b border-gray-200 shrink-0">
            <div className="flex items-center justify-between gap-2">
              <div className="text-base font-semibold text-gray-900">Rep</div>
              <button
                type="button"
                onClick={() => setSidebarVisible(false)}
                className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-gray-700 hover:bg-gray-50"
                aria-label="Hide sidebar"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="text-xs text-gray-500">
              {portalModule === 'ram' ? 'Ram Sales' : portalModule === 'food' ? 'Food Distribution' : 'Food Distribution & Ram Sales'}
            </div>
          </div>

          <nav className="px-3 py-4 space-y-4 flex-1 overflow-y-auto">
            {(portalModule === null || portalModule === 'food') && (
              <div>
                <button type="button" className={sectionButtonClass(foodOpen)} onClick={() => setFoodOpen((v) => !v)}>
                  <span>Food Distribution</span>
                  <span className="text-gray-500">{foodOpen ? '−' : '+'}</span>
                </button>
                {foodOpen && (
                  <div className="mt-2 space-y-1">
                    <Link href="/rep/pending" className={navItemClass(activeKey === 'food_pending')}>
                      Pending
                    </Link>
                    <Link href="/rep/posted" className={navItemClass(activeKey === 'food_posted')}>
                      Posted
                    </Link>
                    <Link href="/rep/delivered" className={navItemClass(activeKey === 'food_delivered')}>
                      Delivered
                    </Link>
                  </div>
                )}
              </div>
            )}

            {(portalModule === null || portalModule === 'ram') && (
              <div>
                <button type="button" className={sectionButtonClass(ramOpen)} onClick={() => setRamOpen((v) => !v)}>
                  <span>Ram Sales</span>
                  <span className="text-gray-500">{ramOpen ? '−' : '+'}</span>
                </button>
                {ramOpen && (
                  <div className="mt-2 space-y-1">
                    <Link href="/rep/ram/approved" className={navItemClass(activeKey === 'ram_approved')}>
                      Approved
                    </Link>
                  </div>
                )}
              </div>
            )}

            <div className="pt-2 border-t border-gray-200 space-y-1">
              <Link href="/portal" className={navItemClass(false)}>
                Back to Portal
              </Link>
              <button
                type="button"
                onClick={doLogout}
                className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-red-50 hover:text-red-700"
              >
                Logout
              </button>
            </div>
          </nav>
        </aside>
      )}

      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <div className="shrink-0 bg-white border-b border-gray-200">
          <div className="px-4 sm:px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              {!sidebarVisible && (
                <button
                  type="button"
                  onClick={() => setSidebarVisible(true)}
                  className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-gray-700 hover:bg-gray-50"
                  aria-label="Show sidebar"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              )}
              <div className="text-sm font-semibold text-gray-900 truncate">{title}</div>
            </div>
            <button
              type="button"
              onClick={doLogout}
              className="px-3 py-1.5 rounded-lg text-sm text-gray-700 hover:bg-red-50 hover:text-red-700"
            >
              Logout
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </main>
    </div>
  )
}
