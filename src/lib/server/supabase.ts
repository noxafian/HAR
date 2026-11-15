/**
 * Server-only Supabase clients.
 * User client uses SSR cookies; service-role client is stateless and must never
 * be imported by client components or returned to the browser.
 */
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { CookieOptions } from '@supabase/ssr'

function getSupabaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!value) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured')
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost') {
      throw new Error('Supabase URL must use HTTPS outside localhost')
    }
  } catch {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL must be a valid URL')
  }
  return value
}

export async function createSupabaseClient() {
  const url = getSupabaseUrl()
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!anonKey) throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not configured')

  const cookieStore = await cookies()
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Server Components may be unable to mutate cookies; Route Handlers can.
        }
      },
    },
  })
}

/**
 * Stateless service-role client for trusted server workflows only.
 * Supabase documents disabling persistence/refresh for server-side admin clients.
 */
export function createServiceRoleClient() {
  const url = getSupabaseUrl()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: { headers: { 'X-Client-Info': 'keryvion-studyhub-server' } },
  })
}

export async function getUserSession() {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}

export async function getCurrentUser() {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase.auth.getUser()
  if (error) return null
  return data.user
}
