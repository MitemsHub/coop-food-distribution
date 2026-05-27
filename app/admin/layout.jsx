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

function subSectionButtonClass(open) {
  return `w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold ${
    open ? 'bg-gray-50 text-gray-800' : 'text-gray-600 hover:bg-gray-50'
  }`
}

export default function AdminLayout({ children }) {
  const pathname = usePathname()
  const { logout } = useAuth()
  const isPinPage = pathname.startsWith('/admin/pin')

  const [sidebarVisible, setSidebarVisible] = useState(() => {
    if (typeof window === 'undefined') return true
    const v = window.localStorage.getItem('admin_sidebar_visible')
    if (v === null) return true
    return v === '1'
  })
  const [foodOpen, setFoodOpen] = useState(false)
  const [ramOpen, setRamOpen] = useState(false)
  const [foodOrdersOpen, setFoodOrdersOpen] = useState(() => false)
  const [ramOrdersOpen, setRamOrdersOpen] = useState(() => false)
  const [foodOpsOpen, setFoodOpsOpen] = useState(() => false)
  const [ramOpsOpen, setRamOpsOpen] = useState(() => false)

  useEffect(() => {
    try {
      window.localStorage.setItem('admin_sidebar_visible', sidebarVisible ? '1' : '0')
    } catch {}
  }, [sidebarVisible])

  const activeKey = useMemo(() => {
    if (pathname.startsWith('/admin/food/pending')) return 'food_pending'
    if (pathname.startsWith('/admin/food/cancelled')) return 'food_cancelled'
    if (pathname.startsWith('/admin/food/posted')) return 'food_posted'
    if (pathname.startsWith('/admin/food/delivered')) return 'food_delivered'
    if (pathname.startsWith('/admin/food/banks')) return 'food_banks'
    if (pathname.startsWith('/admin/food/import')) return 'food_import'
    if (pathname.startsWith('/admin/food/inventory')) return 'food_inventory'
    if (pathname.startsWith('/admin/food/markups')) return 'food_markups'
    if (pathname.startsWith('/admin/food/reports')) return 'food_reports'
    if (pathname.startsWith('/admin/food/data-management')) return 'food_data'
    if (pathname.startsWith('/admin/ram/pending')) return 'ram_pending'
    if (pathname.startsWith('/admin/ram/cancelled')) return 'ram_cancelled'
    if (pathname.startsWith('/admin/ram/approved')) return 'ram_approved'
    if (pathname.startsWith('/admin/ram/delivered')) return 'ram_delivered'
    if (pathname.startsWith('/admin/ram/banks')) return 'ram_banks'
    if (pathname.startsWith('/admin/ram/inventory')) return 'ram_banks'
    if (pathname.startsWith('/admin/ram/reports')) return 'ram_reports'
    if (pathname.startsWith('/admin/ram/data')) return 'ram_data'
    if (pathname.startsWith('/admin/ram/posted')) return 'ram_pending'
    return ''
  }, [pathname])

  useEffect(() => {
    const foodOrders =
      pathname.startsWith('/admin/food/pending') ||
      pathname.startsWith('/admin/food/posted') ||
      pathname.startsWith('/admin/food/delivered') ||
      pathname.startsWith('/admin/food/cancelled')
    const foodOps =
      pathname.startsWith('/admin/food/banks') ||
      pathname.startsWith('/admin/food/import') ||
      pathname.startsWith('/admin/food/inventory') ||
      pathname.startsWith('/admin/food/markups') ||
      pathname.startsWith('/admin/food/reports') ||
      pathname.startsWith('/admin/food/data-management')
    const ramOrders =
      pathname.startsWith('/admin/ram/pending') ||
      pathname.startsWith('/admin/ram/approved') ||
      pathname.startsWith('/admin/ram/delivered') ||
      pathname.startsWith('/admin/ram/cancelled')
    const ramOps =
      pathname.startsWith('/admin/ram/banks') ||
      pathname.startsWith('/admin/ram/inventory') ||
      pathname.startsWith('/admin/ram/reports') ||
      pathname.startsWith('/admin/ram/data')
    if (foodOrders) setFoodOrdersOpen(true)
    if (foodOps) setFoodOpsOpen(true)
    if (ramOrders) setRamOrdersOpen(true)
    if (ramOps) setRamOpsOpen(true)
  }, [pathname])

  const breadcrumb = useMemo(() => {
    if (!activeKey) return 'Admin'
    const [group, rest] = activeKey.split('_')
    const groupLabel = group === 'food' ? 'Food Distribution' : group === 'ram' ? 'Ram Sales' : 'Admin'
    const pageLabel =
      group === 'ram' && (rest === 'inventory' || rest === 'banks')
        ? 'Banks'
        : group === 'food' && rest === 'banks'
          ? 'Banks'
        : rest === 'data'
          ? 'Data'
          : rest
            ? rest.charAt(0).toUpperCase() + rest.slice(1)
            : ''
    return pageLabel ? `Admin / ${groupLabel} / ${pageLabel}` : `Admin / ${groupLabel}`
  }, [activeKey])

  const title = useMemo(() => {
    if (activeKey.startsWith('food_')) {
      const rest = activeKey.replace('food_', '')
      const label = rest === 'data' ? 'Data' : rest === 'banks' ? 'Banks' : rest.charAt(0).toUpperCase() + rest.slice(1)
      return `Food Distribution — ${label}`
    }
    if (activeKey.startsWith('ram_')) {
      const rest = activeKey.replace('ram_', '')
      const label = rest === 'inventory' || rest === 'banks' ? 'Banks' : rest === 'data' ? 'Data' : rest.charAt(0).toUpperCase() + rest.slice(1)
      return `Ram Sales — ${label}`
    }
    return 'Admin'
  }, [activeKey])

  const doLogout = async () => {
    try {
      await fetch('/api/admin/pin/session', { method: 'DELETE', credentials: 'include' }).catch(() => null)
      logout()
    } catch {
      logout()
    }
  }

  if (isPinPage) return children

  return (
    <div className="fixed inset-0 ui-surface flex overflow-hidden">
      {sidebarVisible && (
        <aside className="w-60 sm:w-64 shrink-0 bg-white border-r border-gray-200 flex flex-col">
          <div className="px-4 py-4 border-b border-gray-200 shrink-0">
            <div className="flex items-center justify-between gap-2">
              <div className="text-base font-semibold text-gray-900">Admin</div>
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
            <div className="text-xs text-gray-500">Food Distribution & Ram Sales</div>
          </div>

          <nav className="px-3 py-4 space-y-4 flex-1 overflow-y-auto">
            <div>
              <button type="button" className={sectionButtonClass(foodOpen)} onClick={() => setFoodOpen((v) => !v)}>
                <span>Food Distribution</span>
                <span className="text-gray-500">{foodOpen ? '−' : '+'}</span>
              </button>
              {foodOpen && (
                <div className="mt-2 space-y-1">
                  <button
                    type="button"
                    className={subSectionButtonClass(foodOrdersOpen)}
                    onClick={() => setFoodOrdersOpen((v) => !v)}
                  >
                    <span>Food Orders</span>
                    <span className="text-gray-500">{foodOrdersOpen ? '−' : '+'}</span>
                  </button>
                  {foodOrdersOpen && (
                    <div className="ml-2 space-y-1">
                      <Link href="/admin/food/pending" className={navItemClass(activeKey === 'food_pending')}>
                        Pending
                      </Link>
                      <Link href="/admin/food/posted" className={navItemClass(activeKey === 'food_posted')}>
                        Posted
                      </Link>
                      <Link href="/admin/food/delivered" className={navItemClass(activeKey === 'food_delivered')}>
                        Delivered
                      </Link>
                      <Link href="/admin/food/cancelled" className={navItemClass(activeKey === 'food_cancelled')}>
                        Cancelled
                      </Link>
                    </div>
                  )}
                  <button
                    type="button"
                    className={subSectionButtonClass(foodOpsOpen)}
                    onClick={() => setFoodOpsOpen((v) => !v)}
                  >
                    <span>Food Operations</span>
                    <span className="text-gray-500">{foodOpsOpen ? '−' : '+'}</span>
                  </button>
                  {foodOpsOpen && (
                    <div className="ml-2 space-y-1">
                      <Link href="/admin/food/banks" className={navItemClass(activeKey === 'food_banks')}>
                        Banks
                      </Link>
                      <Link href="/admin/food/import" className={navItemClass(activeKey === 'food_import')}>
                        Import
                      </Link>
                      <Link href="/admin/food/inventory" className={navItemClass(activeKey === 'food_inventory')}>
                        Inventory
                      </Link>
                      <Link href="/admin/food/markups" className={navItemClass(activeKey === 'food_markups')}>
                        Markups
                      </Link>
                      <Link href="/admin/food/reports" className={navItemClass(activeKey === 'food_reports')}>
                        Report
                      </Link>
                      <Link href="/admin/food/data-management" className={navItemClass(activeKey === 'food_data')}>
                        Data
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <button type="button" className={sectionButtonClass(ramOpen)} onClick={() => setRamOpen((v) => !v)}>
                <span>Ram Sales</span>
                <span className="text-gray-500">{ramOpen ? '−' : '+'}</span>
              </button>
              {ramOpen && (
                <div className="mt-2 space-y-1">
                  <button
                    type="button"
                    className={subSectionButtonClass(ramOrdersOpen)}
                    onClick={() => setRamOrdersOpen((v) => !v)}
                  >
                    <span>Ram Orders</span>
                    <span className="text-gray-500">{ramOrdersOpen ? '−' : '+'}</span>
                  </button>
                  {ramOrdersOpen && (
                    <div className="ml-2 space-y-1">
                      <Link href="/admin/ram/pending" className={navItemClass(activeKey === 'ram_pending')}>
                        Pending
                      </Link>
                      <Link href="/admin/ram/approved" className={navItemClass(activeKey === 'ram_approved')}>
                        Approved
                      </Link>
                      <Link href="/admin/ram/delivered" className={navItemClass(activeKey === 'ram_delivered')}>
                        Delivered
                      </Link>
                      <Link href="/admin/ram/cancelled" className={navItemClass(activeKey === 'ram_cancelled')}>
                        Cancelled
                      </Link>
                    </div>
                  )}
                  <button
                    type="button"
                    className={subSectionButtonClass(ramOpsOpen)}
                    onClick={() => setRamOpsOpen((v) => !v)}
                  >
                    <span>Ram Operations</span>
                    <span className="text-gray-500">{ramOpsOpen ? '−' : '+'}</span>
                  </button>
                  {ramOpsOpen && (
                    <div className="ml-2 space-y-1">
                      <Link href="/admin/ram/banks" className={navItemClass(activeKey === 'ram_banks')}>
                        Banks
                      </Link>
                      <Link href="/admin/ram/reports" className={navItemClass(activeKey === 'ram_reports')}>
                        Report
                      </Link>
                      <Link href="/admin/ram/data" className={navItemClass(activeKey === 'ram_data')}>
                        Data
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>

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
            <div className="min-w-0">
              <div className="flex items-center gap-2">
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
              <div className="mt-0.5 text-xs text-gray-500 truncate">{breadcrumb}</div>
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
