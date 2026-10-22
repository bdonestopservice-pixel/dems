import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createSession } from '@/lib/auth/session'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const { email, password, rememberMe } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'กรุณากรอกอีเมลและรหัสผ่าน' }, { status: 400 })
    }

    const supabase = createServerSupabaseClient()

    // Find user by email
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, password, role, warehouses, is_active')
      .eq('email', email)
      .single()

    if (error || !user) {
      return NextResponse.json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' }, { status: 401 })
    }

    if (!user.is_active) {
      return NextResponse.json({ error: 'บัญชีนี้ถูกปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ' }, { status: 403 })
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password)
    if (!isValidPassword) {
      return NextResponse.json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' }, { status: 401 })
    }

    // Create session token with password signature for invalidation on password change
    const pwSig = user.password.slice(-10)
    const session = {
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      warehouses: user.warehouses || [],
      rememberMe: !!rememberMe,
      pwSig,
    }

    const token = await createSession(session)

    // Set cookie
    const response = NextResponse.json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    })

    // If rememberMe: keep until manual logout / password change (10 years)
    // If not rememberMe: session cookie (expires when browser is closed)
    const cookieOptions: any = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    }

    if (rememberMe) {
      const tenYears = 60 * 60 * 24 * 365 * 10 // 10 years
      cookieOptions.maxAge = tenYears
      cookieOptions.expires = new Date(Date.now() + tenYears * 1000)
    }

    response.cookies.set('dems_session', token, cookieOptions)

    return response
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Login error:', message, err)
    return NextResponse.json(
      {
        error: 'เกิดข้อผิดพลาดภายในระบบ',
        message,
      },
      { status: 500 }
    )
  }
}
