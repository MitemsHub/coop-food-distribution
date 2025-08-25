// app/api/admin/pin/session/route.js
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { verify } from '@/lib/signing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req) {
  try {
    const { passcode } = await req.json()
    const PIN = process.env.ADMIN_PASSCODE || 'Coop@2025'
    if ((passcode || '') !== PIN) {
      return NextResponse.json({ ok:false, error:'Invalid passcode' }, { status:401 })
    }
    const token = sign({ role:'admin' }, 60 * 60 * 8) // 8h
    const res = NextResponse.json({ ok:true })
    res.cookies.set('admin_token', token, { httpOnly:true, sameSite:'lax', path:'/', maxAge:60*60*8 })
    return res
  } catch (e) {
    return NextResponse.json({ ok:false, error:e.message }, { status:500 })
  }
}

// middleware.js (only the admin guard part shown)

export async function middleware(req) {
  const res = NextResponse.next()
  const { pathname } = req.nextUrl

  const isAdminPath = pathname.startsWith('/admin') || pathname.startsWith('/api/admin')
  const isRepApi = pathname.startsWith('/api/rep')

  if (!isAdminPath && !isRepApi) return res

  if (isAdminPath) {
    // 1) accept admin_token cookie
    const token = req.cookies.get('admin_token')?.value
    const claim = token && verify(token)
    if (claim?.role === 'admin') return res

    // 2) fallback to Supabase Auth role=admin
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          get: (name) => req.cookies.get(name)?.value,
          set: (name, value, options) => res.cookies.set({ name, value, ...options }),
          remove: (name, options) => res.cookies.set({ name, value: '', ...options }),
        }
      }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.app_metadata?.role === 'admin') return res

    const loginUrl = new URL('/admin/pin', req.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Rep API: handled inside route by verifying rep_token
  return res
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*', '/api/rep/:path*'],
}