import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'

export default async function HomePage() {
  // ถ้ายังมี session ที่ใช้งานได้ (เช่น ติ๊ก "จดจำฉันไว้ในระบบ") ให้เข้าสู่ระบบต่อทันที
  const session = await getSession()
  redirect(session ? '/overview' : '/login')
}
