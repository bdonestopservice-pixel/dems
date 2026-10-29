import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { AuthSession } from '@/types'

/**
 * In-memory TTL cache for user warehouses
 * Caches live database checks for 30 seconds to eliminate redundant network round-trips
 */
const userWarehouseCache = new Map<string, { warehouses: string[]; expiresAt: number }>()
const CACHE_TTL_MS = 30 * 1000 // 30 seconds

/**
 * Check if the current session has access to a specific warehouse.
 * 1. Super Admin has access to all warehouses (0ms)
 * 2. If present in JWT session, returns immediately (0ms)
 * 3. Otherwise, checks cached or live database permissions
 */
export async function hasWarehouseAccess(
  session: AuthSession,
  warehouse: string
): Promise<boolean> {
  if (session.role === 'super_admin') return true
  if (session.warehouses && session.warehouses.includes(warehouse)) return true

  const liveWarehouses = await getLiveUserWarehouses(session)
  return liveWarehouses.includes(warehouse)
}

/**
 * Get the latest list of warehouses for a session.
 * Optimized:
 * 1. Super Admin always gets access immediately without querying DB (0ms)
 * 2. If session JWT already contains warehouses, returns directly (0ms)
 * 3. Checks in-memory cache to prevent repeated database queries
 * 4. Fallback to querying DB only when session has no warehouses at all
 */
export async function getLiveUserWarehouses(
  session: AuthSession
): Promise<string[]> {
  // Super admin has access to everything
  if (session.role === 'super_admin') {
    return session.warehouses || []
  }

  // 1. If session JWT already contains permitted warehouses, use it directly (0ms network cost)
  if (Array.isArray(session.warehouses) && session.warehouses.length > 0) {
    return session.warehouses
  }

  // 2. Check in-memory cache
  if (session.userId) {
    const cached = userWarehouseCache.get(session.userId)
    if (cached && cached.expiresAt > Date.now()) {
      return cached.warehouses
    }
  }

  // 3. Fallback: Query DB only when session has no warehouses at all
  try {
    const supabase = createServerSupabaseClient()
    const { data: dbUser } = await supabase
      .from('users')
      .select('warehouses')
      .eq('id', session.userId)
      .single()

    if (dbUser?.warehouses && Array.isArray(dbUser.warehouses)) {
      if (session.userId) {
        userWarehouseCache.set(session.userId, {
          warehouses: dbUser.warehouses,
          expiresAt: Date.now() + CACHE_TTL_MS,
        })
      }
      return dbUser.warehouses
    }
  } catch {
    // fallback
  }

  return session.warehouses || []
}
