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

function readBool(key, fallback) {
  try {
    const v = localStorage.getItem(key)
    if (v === null) return fallback
    return v === '1'
  } catch {
    return fallback
  }
}

function writeBool(key, value) {
  try {
    localStorage.setItem(key, value ? '1' : '0')
  } catch {}
}

export default function AdminLayout({ children }) {
  const pathname = usePathname()
  const { logout } = useAuth()
  const isPinPage = pathname.startsWith('/admin/pin')

  const [foodOpen, setFoodOpen] = useState(false)
  const [ramOpen, setRamOpen] = useState(false)

  const activeKey = useMemo(() => {
    if (pathname.startsWith('/admin/pending')) return 'food_pending'
    if (pathname.startsWith('/admin/posted')) return 'food_posted'
    if (pathname.startsWith('/admin/delivered')) return 'food_delivered'
    if (pathname.startsWith('/admin/import')) return 'food_import'
    if (pathname.startsWith('/admin/inventory')) return 'food_inventory'
    if (pathname.startsWith('/admin/markups')) return 'food_markups'
    if (pathname.startsWith('/admin/reports')) return 'food_reports'
    if (pathname.startsWith('/admin/data-management')) return 'food_data'
    if (pathname.startsWith('/admin/ram/pending')) return 'ram_pending'
    if (pathname.startsWith('/admin/ram/delivered')) return 'ram_delivered'
    if (pathname.startsWith('/admin/ram/inventory')) return 'ram_inventory'
    if (pathname.startsWith('/admin/ram/reports')) return 'ram_reports'
    if (pathname.startsWith('/admin/ram/data')) return 'ram_data'
    if (pathname.startsWith('/admin/ram-orders')) return 'ram_orders'
    if (pathname.startsWith('/admin/ram/posted')) return 'ram_pending'
    return ''
  }, [pathname])

  const title = useMemo(() => {
    if (activeKey.startsWith('food_')) {
      const rest = activeKey.replace('food_', '')
      const label = rest === 'data' ? 'Data' : rest.charAt(0).toUpperCase() + rest.slice(1)
      return `Food Distribution — ${label}`
    }
    if (activeKey.startsWith('ram_')) {
      const rest = activeKey.replace('ram_', '')
      const label =
        rest === 'data' ? 'Data' : rest === 'delivered' ? 'Approved' : rest.charAt(0).toUpperCase() + rest.slice(1)
      return `Ram Sales — ${label}`
    }
    return 'Admin'
  }, [activeKey])

  useEffect(() => {
    setFoodOpen(readBool('admin.nav.foodOpen', false))
    setRamOpen(readBool('admin.nav.ramOpen', false))
  }, [])

  useEffect(() => {
    writeBool('admin.nav.foodOpen', foodOpen)
  }, [foodOpen])

  useEffect(() => {
    writeBool('admin.nav.ramOpen', ramOpen)
  }, [ramOpen])

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
    <div className="fixed inset-0 bg-gray-50 flex overflow-hidden">
      <aside className="w-60 sm:w-64 shrink-0 bg-white border-r border-gray-200 flex flex-col">
        <div className="px-4 py-4 border-b border-gray-200 shrink-0">
          <div className="text-base font-semibold text-gray-900">Admin</div>
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
                <Link href="/admin/pending" className={navItemClass(activeKey === 'food_pending')}>
                  Pending
                </Link>
                <Link href="/admin/posted" className={navItemClass(activeKey === 'food_posted')}>
                  Posted
                </Link>
                <Link href="/admin/delivered" className={navItemClass(activeKey === 'food_delivered')}>
                  Delivered
                </Link>
                <Link href="/admin/import" className={navItemClass(activeKey === 'food_import')}>
                  Import
                </Link>
                <Link href="/admin/inventory" className={navItemClass(activeKey === 'food_inventory')}>
                  Inventory
                </Link>
                <Link href="/admin/markups" className={navItemClass(activeKey === 'food_markups')}>
                  Markups
                </Link>
                <Link href="/admin/reports" className={navItemClass(activeKey === 'food_reports')}>
                  Report
                </Link>
                <Link href="/admin/data-management" className={navItemClass(activeKey === 'food_data')}>
                  Data
                </Link>
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
                <Link href="/admin/ram/pending" className={navItemClass(activeKey === 'ram_pending')}>
                  Pending
                </Link>
                <Link href="/admin/ram/delivered" className={navItemClass(activeKey === 'ram_delivered')}>
                  Approved
                </Link>
                <Link href="/admin/ram/inventory" className={navItemClass(activeKey === 'ram_inventory')}>
                  Inventory
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

          <div className="pt-2 border-t border-gray-200 space-y-1">
            <Link href="/portal" className={navItemClass(false)}>
              Back to Portal
            </Link>
            <button type="button" onClick={doLogout} className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-red-50 hover:text-red-700">
              Logout
            </button>
          </div>
        </nav>
      </aside>

      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <div className="shrink-0 bg-white border-b border-gray-200">
          <div className="px-4 sm:px-6 py-3 flex items-center justify-between">
            <div className="text-sm font-semibold text-gray-900">{title}</div>
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
