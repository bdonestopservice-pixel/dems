import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { NamelistClient } from './NamelistClient'

function todayLocal() {
  const d = new Date()
  // เซิร์ฟเวอร์ใช้ UTC → บวก 7 ชม. ให้เป็นวันที่ตามเวลาไทย
  const th = new Date(d.getTime() + 7 * 60 * 60 * 1000)
  return th.toISOString().slice(0, 10)
}

export default async function NamelistPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; warehouse?: string }>
}) {
  const session = await getSession()
  if (!session) redirect('/login')

  const sp = await searchParams
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : todayLocal()

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <NamelistClient session={session} initialDate={date} initialWarehouse={sp.warehouse} />
    </div>
  )
}
