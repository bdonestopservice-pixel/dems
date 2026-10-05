import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const token = request.cookies.get('dems_session')?.value
  if (!token) {
    return NextResponse.json({ user: null }, { status: 401 })
  }
  const session = await verifySession(token)
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 })
  }

  try {
    const supabase = createServerSupabaseClient()
    const { data: dbUser } = await supabase
      .from('users')
      .select('id, name, email, role, warehouses, is_active')
      .eq('id', session.userId)
      .single()

    if (dbUser) {
      return NextResponse.json({
        user: {
          userId: dbUser.id,
          name: dbUser.name,
          email: dbUser.email,
          role: dbUser.role,
          warehouses: dbUser.warehouses || [],
        },
      })
    }
  } catch {}

  return NextResponse.json({ user: session })
}
