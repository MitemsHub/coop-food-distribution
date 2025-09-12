// lib/supabaseServer.js
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

// Optimized server client for connection pooling
export function createClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
      db: {
        schema: 'public',
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      global: {
        fetch: fetch,
      }
    }
  )
}

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

