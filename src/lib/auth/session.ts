import { cache } from 'react'
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import type { AuthSession } from '@/types'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'dems-fallback-secret-change-in-production'
)

export const COOKIE_NAME = 'dems_session'

/**
 * สร้าง JWT Token สำหรับ Session
 * - หากติ๊ก rememberMe: Token จะมีอายุยาวนาน 10 ปี (3650d) จนกว่าผู้ใช้จะ logout หรือเปลี่ยนรหัสผ่าน
 * - หากไม่ติ๊ก rememberMe: Token มีอายุ 8 ชั่วโมง (หรือตาม Session ของเบราว์เซอร์)
 */
export async function createSession(payload: AuthSession, customExpiration?: string): Promise<string> {
  const expiration = customExpiration || (payload.rememberMe ? '3650d' : '8h')

  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiration)
    .sign(SECRET)
  return token
}

export async function verifySession(token: string): Promise<AuthSession | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    return payload as unknown as AuthSession
  } catch {
    return null
  }
}

/**
 * ดึงข้อมูล Session ปัจจุบัน:
 * 1. ตรวจสอบ JWT Token จากคุกกี้
 * 2. ตรวจสอบกับฐานข้อมูล (Database) เพื่อดึงสิทธิ์คลัง (Warehouses) และ Role ล่าสุดแบบ Realtime
 * 3. หากรหัสผ่านถูกเปลี่ยนแปลง หรือผู้ใช้ถูกระงับสิทธิ์ จะคืนค่า null เพื่อให้หลุดออกจากระบบทันที
 *
 * ห่อด้วย React.cache() เพื่อ Request-level Deduplication ใน Server Components
 * ใน 1 Page Request (เช่น layout.tsx + page.tsx) จะ Query ฐานข้อมูลเพียง 1 ครั้งเท่านั้น
 */
export const getSession = cache(async (): Promise<AuthSession | null> => {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null

  const payload = await verifySession(token)
  if (!payload || !payload.userId) return null

  try {
    const supabase = createServerSupabaseClient()
    const { data: dbUser, error } = await supabase
      .from('users')
      .select('id, name, email, role, warehouses, is_active, password')
      .eq('id', payload.userId)
      .maybeSingle()

    if (error || !dbUser) {
      return payload
    }

    // หากบัญชีถูกปิดใช้งาน -> บังคับออกจากระบบ
    if (dbUser.is_active === false) {
      return null
    }

    // หากมีการเปลี่ยนรหัสผ่าน (Hash เปลี่ยนทำให้ signature 10 ตัวท้ายไม่ตรงกัน) -> บังคับออกจากระบบทันที
    const currentPwSig = typeof dbUser.password === 'string' ? dbUser.password.slice(-10) : ''
    if (payload.pwSig && currentPwSig && payload.pwSig !== currentPwSig) {
      return null
    }

    // ส่งคืนข้อมูลผู้ใช้ที่เป็นปัจจุบันที่สุด (Realtime Permissions / Warehouses)
    return {
      userId: dbUser.id || payload.userId,
      name: dbUser.name || payload.name,
      email: dbUser.email || payload.email,
      role: dbUser.role || payload.role,
      warehouses: Array.isArray(dbUser.warehouses) ? dbUser.warehouses : (payload.warehouses || []),
      rememberMe: payload.rememberMe,
      pwSig: currentPwSig || payload.pwSig,
    }
  } catch {
    // ในกรณีที่เกิดปัญหาการเชื่อมต่อชั่วคราว ให้ fallback ใช้ payload จาก JWT
    return payload
  }
})

export async function setSessionCookie(token: string, rememberMe = false) {
  const cookieStore = await cookies()
  const maxAge = rememberMe ? 60 * 60 * 24 * 365 * 10 : 60 * 60 * 8 // 10 years or 8 hours
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: rememberMe ? maxAge : undefined, // หากไม่ติ๊ก rememberMe ให้เป็น Session Cookie ที่หมดอายุเมื่อปิดเบราว์เซอร์
    path: '/',
  })
}

export async function clearSessionCookie() {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

