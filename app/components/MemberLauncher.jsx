// app/components/MemberLauncher.jsx
'use client'

import { useAuth } from '../contexts/AuthContext'
import { useRouter } from 'next/navigation'

export default function MemberLauncher() {
  const { login } = useAuth()
  const router = useRouter()
  
  const submit = (e) => {
    e.preventDefault()
    const mid = new FormData(e.currentTarget).get('mid')?.toString().trim().toUpperCase()
    if (!mid) return
    
    // Set user as authenticated member
    login({
      type: 'member',
      id: mid,
      authenticated: true
    })
    
    router.push(`/shop?mid=${encodeURIComponent(mid)}`)
  }

  return (
    <form className="space-y-3 md:space-y-4" onSubmit={submit}>
      <div className="relative">
        <input
          name="mid"
          className="w-full px-3 py-2 md:px-4 md:py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 outline-none text-sm md:text-base text-gray-700 placeholder-gray-400"
          placeholder="Enter your Member ID (e.g., A12345)"
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-2 md:pr-3">
          <svg className="w-4 h-4 md:w-5 md:h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
      </div>
      <button className="w-full inline-flex items-center justify-center px-4 py-2 md:px-6 md:py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm md:text-base font-semibold rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl">
        <svg className="w-4 h-4 md:w-5 md:h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.5 5M7 13l2.5 5m0 0h8.5" />
        </svg>
        Start Shopping
      </button>
    </form>
  )
}