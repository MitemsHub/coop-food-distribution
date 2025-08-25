// app/components/Navbar.jsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function Navbar() {
  const pathname = usePathname()
  const [lowCount, setLowCount] = useState(0)

  // Simple active style helper
  const isActive = (href) => pathname === href || pathname.startsWith(href + '/')

  // Low-stock poll (every 90s)
  useEffect(() => {
    let t
    const load = async () => {
      try {
        const res = await fetch('/api/admin/inventory/low?threshold=20', { cache: 'no-store' })
        const j = await res.json()
        if (j?.ok) setLowCount(j.count || 0)
      } catch {}
      t = setTimeout(load, 90_000)
    }
    load()
    return () => t && clearTimeout(t)
  }, [])

  return (
    <header className="sticky top-0 z-50 bg-white border-b shadow-sm">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-3">
        <Link href="/shop" className="font-semibold tracking-tight">CBN Coop</Link>
        <span className="text-gray-400">•</span>
        <span className="text-sm text-gray-500">Food Distribution</span>

        <nav className="ml-auto flex items-center gap-1">
          <Link
            href="/shop"
            className={`px-3 py-2 rounded-md text-sm font-medium transition ${
              isActive('/shop') ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-blue-50'
            }`}
          >
            Shop
          </Link>

          <Link
            href="/admin/pending"
            className={`px-3 py-2 rounded-md text-sm font-medium transition ${
              isActive('/admin/pending') ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-blue-50'
            }`}
          >
            Pending
          </Link>

          <Link
            href="/admin/posted"
            className={`px-3 py-2 rounded-md text-sm font-medium transition ${
              isActive('/admin/posted') ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-blue-50'
            }`}
          >
            Posted
          </Link>

          <Link
            href="/admin/delivered"
            className={`px-3 py-2 rounded-md text-sm font-medium transition ${
              isActive('/admin/delivered') ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-blue-50'
            }`}
          >
            Delivered
          </Link>

          <Link
            href="/admin/import"
            className={`px-3 py-2 rounded-md text-sm font-medium transition ${
              isActive('/admin/import') ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-blue-50'
            }`}
          >
            Import
          </Link>

          {/* Inventory with low-stock badge */}
          <Link
            href="/admin/inventory"
            className={`px-3 py-2 rounded-md text-sm font-medium transition ${
              isActive('/admin/inventory') ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-blue-50'
            }`}
          >
            Inventory
            {lowCount > 0 && (
              <span className="ml-1 inline-block min-w-[1.25rem] text-center text-xs bg-red-600 text-white rounded-full px-1">
                {lowCount}
              </span>
            )}
          </Link>

          <Link
            href="/admin/reports"
            className={`px-3 py-2 rounded-md text-sm font-medium transition ${
              isActive('/admin/reports') ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-blue-50'
            }`}
          >
            Reports
          </Link>
        </nav>
      </div>
    </header>
  )
}