import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { AuthSession } from '@/types'

/**
 * Check if the current session has access to a specific warehouse.
 * If not present in the current JWT session, checks the live database
 * to handle real-time warehouse permission updates without requiring re-login.
 */
export async function hasWarehouseAccess(
  session: AuthSession,
  warehouse: string
): Promise<boolean> {
  if (session.role === 'super_admin') return true
  if (session.warehouses && session.warehouses.includes(warehouse)) return true

  try {
    const supabase = createServerSupabaseClient()
    const { data: dbUser } = await supabase
      .from('users')
      .select('warehouses')
      .eq('id', session.userId)
      .single()

    if (dbUser?.warehouses && Array.isArray(dbUser.warehouses)) {
      return dbUser.warehouses.includes(warehouse)
    }
  } catch {
    // fallback
  }

  return false
}

/**
 * Get the latest list of warehouses for a session, checking DB if needed.
 */
export async function getLiveUserWarehouses(
  session: AuthSession
): Promise<string[]> {
  try {
    const supabase = createServerSupabaseClient()
    const { data: dbUser } = await supabase
      .from('users')
      .select('warehouses')
      .eq('id', session.userId)
      .single()

    if (dbUser?.warehouses && Array.isArray(dbUser.warehouses)) {
      return dbUser.warehouses
    }
  } catch {
    // fallback
  }

  return session.warehouses || []
}
