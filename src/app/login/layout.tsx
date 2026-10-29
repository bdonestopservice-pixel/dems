import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'

export const metadata: Metadata = {
  title: 'เข้าสู่ระบบ — DEMS',
  description: 'ระบบจัดการพนักงานรายวัน',
}

export default async function LoginLayout({ children }: { children: React.ReactNode }) {
  // ถ้าล็อกอินค้างไว้อยู่แล้ว (จดจำฉันไว้ในระบบ) ไม่ต้องแสดงหน้า login ซ้ำ
  const session = await getSession()
  if (session) redirect('/overview')
  return children
}
