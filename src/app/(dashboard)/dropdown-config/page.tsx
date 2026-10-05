import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { DropdownConfigClient } from './DropdownConfigClient'
import type { AuthSession } from '@/types'

export const metadata = {
  title: 'จัดการข้อมูล Dropdown — DEMS',
}

export default async function DropdownConfigPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  // Fetch the latest user info from the database in real-time
  const supabase = createServerSupabaseClient()
  const { data: dbUser } = await supabase
    .from('users')
    .select('id, name, email, role, warehouses, is_active')
    .eq('id', session.userId)
    .single()

  if (dbUser && !dbUser.is_active) {
    redirect('/login')
  }

  const liveSession: AuthSession = {
    userId: session.userId,
    email: dbUser?.email ?? session.email,
    name: dbUser?.name ?? session.name,
    role: (dbUser?.role as AuthSession['role']) ?? session.role,
    warehouses: dbUser?.warehouses ?? session.warehouses ?? [],
  }

  return <DropdownConfigClient session={liveSession} />
}

