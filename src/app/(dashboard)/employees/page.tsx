import { getSession } from '@/lib/auth/session'
import { Topbar } from '@/components/layout/Topbar'

export default async function EmployeesPage() {
  const session = await getSession()
  return (
    <>
      <Topbar session={session!} title="ข้อมูลพนักงาน" subtitle="ฐานข้อมูลพนักงานรวมทุกคลัง" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="card p-8 text-center text-gray-400">
          <p className="text-lg font-medium">ข้อมูลพนักงาน</p>
          <p className="text-sm mt-1">— Phase 4 กำลังพัฒนา —</p>
        </div>
      </div>
    </>
  )
}
