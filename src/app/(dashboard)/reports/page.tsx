import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { Topbar } from '@/components/layout/Topbar'

export default async function ReportsPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  return (
    <>
      <Topbar session={session} title="รายงาน" subtitle="Export CSV และสรุปข้อมูล" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="card p-8 text-center text-gray-400">
          <p className="text-lg font-medium">รายงาน & Export</p>
          <p className="text-sm mt-1">— Phase 7 กำลังพัฒนา —</p>
        </div>
      </div>
    </>
  )
}
