import { NextRequest, NextResponse } from 'next/server'
import { verifySession, COOKIE_NAME } from '@/lib/auth/session'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value
  if (!token) {
    return NextResponse.json({ user: null }, { status: 401 })
  }
  const session = await verifySession(token)
  if (!session) {
    const res = NextResponse.json({ user: null }, { status: 401 })
    res.cookies.delete(COOKIE_NAME)
    return res
  }

  try {
    const supabase = createServerSupabaseClient()
    const { data: dbUser } = await supabase
      .from('users')
      .select('id, name, email, role, warehouses, is_active, password')
      .eq('id', session.userId)
      .maybeSingle()

    if (!dbUser || !dbUser.is_active) {
      const res = NextResponse.json({ user: null, error: 'บัญชีถูกปิดใช้งาน' }, { status: 401 })
      res.cookies.delete(COOKIE_NAME)
      return res
    }

    // หากรหัสผ่านถูกเปลี่ยนแปลง ให้บังคับ logout
    const currentPwSig = dbUser.password.slice(-10)
    if (session.pwSig && session.pwSig !== currentPwSig) {
      const res = NextResponse.json({ user: null, error: 'รหัสผ่านถูกเปลี่ยนแปลง กรุณาเข้าสู่ระบบใหม่' }, { status: 401 })
      res.cookies.delete(COOKIE_NAME)
      return res
    }

    return NextResponse.json(
      {
        user: {
          userId: dbUser.id,
          name: dbUser.name,
          email: dbUser.email,
          role: dbUser.role,
          warehouses: dbUser.warehouses || [],
          rememberMe: session.rememberMe,
          pwSig: currentPwSig,
        },
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    )
  } catch {}

  return NextResponse.json(
    { user: session },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  )
}
