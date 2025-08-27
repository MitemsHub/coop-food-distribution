// lib/supabaseServer.js
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function createSupabaseServerClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get: (name) => cookieStore.get(name)?.value,
        set: () => {},
        remove: () => {},
      },
    }
  )
}

// middleware.js

export async function middleware(req) {
  const res = NextResponse.next()
  const pathname = req.nextUrl.pathname

  // Only guard admin routes
  const guard =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/api/admin')

  if (!guard) return res

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

  // Allow calling if request is server-to-server (service key is used in /api/admin),
  // but middleware still runs. We’ll use a simple rule: if no user, redirect to login.
  if (!user) {
    const loginUrl = new URL('/auth/login', req.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  const role = user.app_metadata?.role
  if (role !== 'admin') {
    return NextResponse.redirect(new URL('/auth/login?e=not_admin', req.url))
  }

  return res
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
}

